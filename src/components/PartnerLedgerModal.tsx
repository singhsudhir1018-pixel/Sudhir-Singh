import React, { useState, useEffect } from 'react';
import { Partner, PartnerContribution } from '../types';
import { X, FileText, Download, Loader2 } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';

interface PartnerLedgerModalProps {
  partner: Partner;
  isOpen: boolean;
  onClose: () => void;
}

export default function PartnerLedgerModal({ partner, isOpen, onClose }: PartnerLedgerModalProps) {
  const { language, farmId } = useAppStore();
  const t = translations[language];
  const [contributions, setContributions] = useState<PartnerContribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !farmId) return;
    
    setIsLoading(true);
    const q = query(
      collection(db, 'partner_contributions'), 
      where('farmId', '==', farmId),
      where('partnerId', '==', partner.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data: PartnerContribution[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as PartnerContribution));
      // Sort by createdAt ascending to calculate running total
      data.sort((a, b) => a.createdAt - b.createdAt);
      setContributions(data);
      setIsLoading(false);
    }, (error) => {
      console.error(error);
      setIsLoading(false);
    });

    return () => unsub();
  }, [isOpen, farmId, partner.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-stone-100 bg-stone-50/50">
          <div>
            <h2 className="text-xl font-bold text-stone-800">{t.contributionHistory || 'Contribution History'}</h2>
            <p className="text-sm text-stone-500 mt-1">{partner.name} • {t.runningTotal || 'Total'}: <span className="font-bold text-green-700">Rs. {partner.investmentAmount.toLocaleString()}</span></p>
          </div>
          <div className="flex items-center space-x-3">
            <button className="flex items-center space-x-2 px-4 py-2 bg-white border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 rounded-xl transition-colors">
              <Download size={16} />
              <span>{t.printExport || 'Export'}</span>
            </button>
            <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-100 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-green-600" />
            </div>
          ) : contributions.length === 0 ? (
            <div className="text-center py-12 text-stone-500 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
              <FileText size={48} className="mx-auto mb-4 text-stone-300" />
              <p>{t.noContributions || 'No contributions found for this partner.'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="py-3 px-4 text-sm font-semibold text-stone-600 bg-stone-50 rounded-tl-xl">{t.contributionDate || 'Date (B.S.)'}</th>
                    <th className="py-3 px-4 text-sm font-semibold text-stone-600 bg-stone-50">{t.contributionAmount || 'Amount'}</th>
                    <th className="py-3 px-4 text-sm font-semibold text-stone-600 bg-stone-50">{t.paymentMethod || 'Method'}</th>
                    <th className="py-3 px-4 text-sm font-semibold text-stone-600 bg-stone-50">{t.remarksNotes || 'Remarks'}</th>
                    <th className="py-3 px-4 text-sm font-semibold text-stone-600 bg-stone-50 rounded-tr-xl">{t.runningTotal || 'Running Total'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {(() => {
                    let runningTotal = 0;
                    return contributions.map((contrib) => {
                      runningTotal += contrib.amount;
                      return (
                        <tr key={contrib.id} className="hover:bg-stone-50/50 transition-colors">
                          <td className="py-3 px-4 text-sm text-stone-700 font-medium">{contrib.dateBS}</td>
                          <td className="py-3 px-4 text-sm font-bold text-green-600">+Rs. {contrib.amount.toLocaleString()}</td>
                          <td className="py-3 px-4 text-sm text-stone-600">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-800">
                              {contrib.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-stone-600 max-w-[200px] truncate" title={contrib.notes}>
                            {contrib.notes || '-'}
                          </td>
                          <td className="py-3 px-4 text-sm font-bold text-stone-900">
                            Rs. {runningTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
