import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Partner, PartnerContribution } from '../types';
import { translations } from '../lib/translations';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, FileText } from 'lucide-react';

interface Props {
  partner: Partner;
  isOpen: boolean;
  onClose: () => void;
}

export default function PartnerLedgerModal({ partner, isOpen, onClose }: Props) {
  const { farmId, language } = useAppStore();
  const t = translations[language];

  const [contributions, setContributions] = useState<PartnerContribution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!farmId || !partner.id) return;
    
    // Fallback if index isn't ready
    const q = query(
      collection(db, 'partnerContributions'), 
      where('farmId', '==', farmId),
      where('partnerId', '==', partner.id)
    );
    
    const unsub = onSnapshot(q, snap => {
      const data: PartnerContribution[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as PartnerContribution));
      // Sort in memory to avoid missing index errors
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setContributions(data);
      setLoading(false);
    });
    
    return () => unsub();
  }, [farmId, partner.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-3xl h-[80vh] flex flex-col shadow-xl">
        <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><FileText size={20} /></div>
            <div>
              <h2 className="text-xl font-bold text-stone-800">Partner Ledger</h2>
              <p className="text-sm text-stone-500">{partner.name} &bull; Total Capital: Rs. {partner.investmentAmount?.toLocaleString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>
        
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center text-stone-500 p-8">Loading...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
                  <th className="p-4 w-16">S.N.</th>
                  <th className="p-4">{t.dateBS}</th>
                  <th className="p-4">Payment Method</th>
                  <th className="p-4">Remarks</th>
                  <th className="p-4 text-right">Amount (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {contributions.map((c, idx) => (
                  <tr key={c.id} className="border-b border-stone-100 hover:bg-stone-50">
                    <td className="p-4 text-stone-600">{contributions.length - idx}</td>
                    <td className="p-4 text-stone-800 whitespace-nowrap">{c.dateBS}</td>
                    <td className="p-4 text-stone-600">
                      <span className="inline-flex px-2 py-1 rounded-md text-xs font-medium bg-stone-100 text-stone-700">
                        {c.paymentMethod}
                      </span>
                    </td>
                    <td className="p-4 text-stone-600">{c.notes || '-'}</td>
                    <td className="p-4 text-right font-bold text-emerald-600">
                      + {c.amount.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {contributions.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-stone-500">No contributions found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
