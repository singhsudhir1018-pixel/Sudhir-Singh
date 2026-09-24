import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Partner, PartnerContribution, BankAccount } from '../types';
import { translations } from '../lib/translations';
import { 
  collection, query, where, onSnapshot, doc, runTransaction, getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  X, FileText, Edit2, Trash2, Save, AlertTriangle, Wallet, Landmark, Loader2, ArrowRight
} from 'lucide-react';
import NepaliDatePicker from './NepaliDatePicker';
import { sortTransactionsDesc } from '../lib/nepaliDateHelper';

interface Props {
  partner: Partner;
  accounts?: BankAccount[];
  isOpen: boolean;
  onClose: () => void;
}

export default function PartnerLedgerModal({ partner, accounts: initialAccounts, isOpen, onClose }: Props) {
  const { farmId, language } = useAppStore();
  const t = translations[language];

  const [contributions, setContributions] = useState<PartnerContribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePartner, setLivePartner] = useState<Partner>(partner);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(initialAccounts || []);

  // Edit State
  const [editingContrib, setEditingContrib] = useState<PartnerContribution | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDateBS, setEditDateBS] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('CASH');
  const [editAccountId, setEditAccountId] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Delete State
  const [deletingContrib, setDeletingContrib] = useState<PartnerContribution | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Real-time listener for this partner to keep total capital fresh
  useEffect(() => {
    if (!partner?.id) return;
    const unsub = onSnapshot(doc(db, 'partners', partner.id), (docSnap) => {
      if (docSnap.exists()) {
        setLivePartner({ id: docSnap.id, ...docSnap.data() } as Partner);
      }
    });
    return () => unsub();
  }, [partner?.id]);

  // Real-time listener for bank accounts if not supplied
  useEffect(() => {
    if (!farmId) return;
    const q = query(collection(db, 'bankAccounts'), where('farmId', '==', farmId));
    const unsub = onSnapshot(q, (snap) => {
      const list: BankAccount[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as BankAccount));
      setBankAccounts(list);
    });
    return () => unsub();
  }, [farmId]);

  // Real-time listener for partner contributions
  useEffect(() => {
    if (!farmId || !partner.id) return;

    const q = query(
      collection(db, 'partnerContributions'),
      where('farmId', '==', farmId),
      where('partnerId', '==', partner.id)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: PartnerContribution[] = [];
        snap.forEach((d) => data.push({ id: d.id, ...d.data() } as PartnerContribution));
        // Sort newest dateBS first, then newest createdAt
        data.sort(sortTransactionsDesc);
        setContributions(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to partner contributions:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [farmId, partner.id]);

  if (!isOpen) return null;

  // Open Edit Modal
  const handleOpenEdit = (c: PartnerContribution) => {
    setEditingContrib(c);
    setEditAmount(c.amount.toString());
    setEditDateBS(c.dateBS || '');
    setEditPaymentMethod(c.paymentMethod || 'CASH');
    setEditAccountId(c.targetAccountId || (bankAccounts[0]?.id || ''));
    setEditNotes(c.notes || '');
  };

  // Submit Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContrib || !farmId || !livePartner.id) return;

    const newAmount = Number(editAmount);
    if (!newAmount || newAmount <= 0) {
      alert(language === 'ne' ? 'कृपया मान्य लगानी रकम प्रविष्ट गर्नुहोस्।' : 'Please enter a valid amount.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const oldAmount = editingContrib.amount;
      const oldAccountId = editingContrib.targetAccountId;
      const newAccountId = editAccountId;
      const partnerId = livePartner.id;

      // 1. Locate linked transaction if not explicitly stored
      let linkedTxId = editingContrib.transactionId;
      if (!linkedTxId) {
        try {
          const txQ = query(
            collection(db, 'transactions'),
            where('farmId', '==', farmId),
            where('partyId', '==', partnerId),
            where('type', '==', 'CAPITAL_INFLOW')
          );
          const txSnap = await getDocs(txQ);
          const match = txSnap.docs.find((d) => {
            const data = d.data();
            return Math.abs((data.amount || 0) - oldAmount) < 0.01;
          });
          if (match) {
            linkedTxId = match.id;
          }
        } catch (err) {
          console.warn('Could not query linked transaction for edit:', err);
        }
      }

      // 2. Atomic update in transaction
      await runTransaction(db, async (tx) => {
        // --- READS ---
        const partnerRef = doc(db, 'partners', partnerId);
        const partnerDoc = await tx.get(partnerRef);
        if (!partnerDoc.exists()) throw new Error('Partner document not found');

        let oldAccDoc = null;
        let newAccDoc = null;

        if (oldAccountId) {
          const oldAccRef = doc(db, 'bankAccounts', oldAccountId);
          oldAccDoc = await tx.get(oldAccRef);
        }

        if (newAccountId && newAccountId !== oldAccountId) {
          const newAccRef = doc(db, 'bankAccounts', newAccountId);
          newAccDoc = await tx.get(newAccRef);
        }

        let linkedTxDoc = null;
        if (linkedTxId) {
          const txRef = doc(db, 'transactions', linkedTxId);
          linkedTxDoc = await tx.get(txRef);
        }

        // --- WRITES ---
        // 1. Update Partner total capital
        const currentCapital = partnerDoc.data().investmentAmount || 0;
        const diff = newAmount - oldAmount;
        tx.update(partnerRef, {
          investmentAmount: Math.max(0, currentCapital + diff),
        });

        // 2. Adjust Bank Accounts
        if (oldAccountId === newAccountId) {
          if (oldAccDoc && oldAccDoc.exists()) {
            const currentBal = oldAccDoc.data().currentBalance || 0;
            tx.update(oldAccDoc.ref, {
              currentBalance: currentBal + diff,
            });
          }
        } else {
          // Changed destination account
          if (oldAccDoc && oldAccDoc.exists()) {
            const oldBal = oldAccDoc.data().currentBalance || 0;
            tx.update(oldAccDoc.ref, {
              currentBalance: oldBal - oldAmount,
            });
          }
          if (newAccDoc && newAccDoc.exists()) {
            const newBal = newAccDoc.data().currentBalance || 0;
            tx.update(newAccDoc.ref, {
              currentBalance: newBal + newAmount,
            });
          }
        }

        // 3. Update Contribution record
        const contribRef = doc(db, 'partnerContributions', editingContrib.id);
        tx.update(contribRef, {
          amount: newAmount,
          dateBS: editDateBS,
          paymentMethod: editPaymentMethod,
          targetAccountId: newAccountId,
          notes: editNotes,
          transactionId: linkedTxId || null,
          updatedAt: Date.now(),
        });

        // 4. Update linked transaction if found
        if (linkedTxDoc && linkedTxDoc.exists()) {
          tx.update(linkedTxDoc.ref, {
            amount: newAmount,
            dateBS: editDateBS,
            paymentMethod: editPaymentMethod,
            accountId: newAccountId || linkedTxDoc.data().accountId || '',
            notes: editNotes || `Capital Contribution by ${livePartner.name}`,
          });
        }
      });

      setEditingContrib(null);
    } catch (err: any) {
      console.error('Failed to edit contribution:', err);
      alert((language === 'ne' ? 'सम्पादन गर्न असफल भयो: ' : 'Failed to edit contribution: ') + err.message);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Submit Delete
  const handleConfirmDelete = async () => {
    if (!deletingContrib || !farmId || !livePartner.id) return;

    setIsDeleting(true);
    try {
      const oldAmount = deletingContrib.amount;
      const targetAccountId = deletingContrib.targetAccountId;
      const partnerId = livePartner.id;

      // 1. Locate linked transaction if not explicitly stored
      let linkedTxId = deletingContrib.transactionId;
      if (!linkedTxId) {
        try {
          const txQ = query(
            collection(db, 'transactions'),
            where('farmId', '==', farmId),
            where('partyId', '==', partnerId),
            where('type', '==', 'CAPITAL_INFLOW')
          );
          const txSnap = await getDocs(txQ);
          const match = txSnap.docs.find((d) => {
            const data = d.data();
            return Math.abs((data.amount || 0) - oldAmount) < 0.01;
          });
          if (match) {
            linkedTxId = match.id;
          }
        } catch (err) {
          console.warn('Could not query linked transaction for deletion:', err);
        }
      }

      // 2. Atomic deletion
      await runTransaction(db, async (tx) => {
        // --- READS ---
        const partnerRef = doc(db, 'partners', partnerId);
        const partnerDoc = await tx.get(partnerRef);
        if (!partnerDoc.exists()) throw new Error('Partner not found');

        let accDoc = null;
        if (targetAccountId) {
          const accRef = doc(db, 'bankAccounts', targetAccountId);
          accDoc = await tx.get(accRef);
        }

        let linkedTxDoc = null;
        if (linkedTxId) {
          const txRef = doc(db, 'transactions', linkedTxId);
          linkedTxDoc = await tx.get(txRef);
        }

        // --- WRITES ---
        // 1. Deduct capital from partner
        const currentCapital = partnerDoc.data().investmentAmount || 0;
        tx.update(partnerRef, {
          investmentAmount: Math.max(0, currentCapital - oldAmount),
        });

        // 2. Revert bank account balance
        if (accDoc && accDoc.exists()) {
          const curBal = accDoc.data().currentBalance || 0;
          tx.update(accDoc.ref, {
            currentBalance: curBal - oldAmount,
          });
        }

        // 3. Delete linked transaction
        if (linkedTxDoc && linkedTxDoc.exists()) {
          tx.delete(linkedTxDoc.ref);
        }

        // 4. Delete the contribution doc
        const contribRef = doc(db, 'partnerContributions', deletingContrib.id);
        tx.delete(contribRef);
      });

      setDeletingContrib(null);
    } catch (err: any) {
      console.error('Failed to delete contribution:', err);
      alert((language === 'ne' ? 'मेटाउन असफल भयो: ' : 'Failed to delete contribution: ') + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const getAccountName = (accId?: string) => {
    if (!accId) return '-';
    const acc = bankAccounts.find((a) => a.id === accId);
    return acc ? acc.name : '-';
  };

  return (
    <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-stone-100">
        {/* Header */}
        <div className="flex justify-between items-center p-5 sm:p-6 border-b border-stone-100 bg-stone-50/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
              <FileText size={22} />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-stone-800">
                {language === 'ne' ? 'साझेदार लेजर' : 'Partner Ledger'}
              </h2>
              <p className="text-xs sm:text-sm text-stone-500 font-medium">
                <span className="font-semibold text-stone-700">{livePartner.name}</span>
                <span className="mx-2 text-stone-300">&bull;</span>
                <span>
                  {language === 'ne' ? 'कुल लगानी पूँजी' : 'Total Capital'}:{' '}
                  <strong className="text-emerald-700 font-bold">
                    Rs. {(livePartner.investmentAmount || 0).toLocaleString()}
                  </strong>
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-2 text-stone-500">
              <Loader2 className="animate-spin text-blue-600" size={28} />
              <span className="text-sm">{language === 'ne' ? 'लोड हुँदैछ...' : 'Loading entries...'}</span>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-stone-200">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-50/90 border-b border-stone-200 text-stone-600 font-semibold text-xs uppercase tracking-wider">
                    <th className="py-3.5 px-4 w-14 text-center">S.N.</th>
                    <th className="py-3.5 px-4">{t.dateBS || 'Date (B.S.)'}</th>
                    <th className="py-3.5 px-4">{t.paymentMethod || 'Payment Method'}</th>
                    <th className="py-3.5 px-4">{language === 'ne' ? 'जम्मा खाता' : 'Account'}</th>
                    <th className="py-3.5 px-4">{t.notes || 'Remarks'}</th>
                    <th className="py-3.5 px-4 text-right">{t.amount || 'Amount'} (Rs.)</th>
                    <th className="py-3.5 px-4 text-center w-28">{t.actions || 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 text-sm">
                  {contributions.map((c, idx) => (
                    <tr key={c.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="py-3.5 px-4 text-center text-stone-500 font-medium">
                        {contributions.length - idx}
                      </td>
                      <td className="py-3.5 px-4 text-stone-800 font-medium whitespace-nowrap">
                        {c.dateBS}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-stone-100 text-stone-700">
                          {c.paymentMethod}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 text-xs whitespace-nowrap">
                        {getAccountName(c.targetAccountId)}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 max-w-[180px] truncate" title={c.notes}>
                        {c.notes || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-emerald-600 whitespace-nowrap">
                        + {c.amount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t.edit || 'Edit'}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeletingContrib(c)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={t.delete || 'Delete'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {contributions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-stone-400">
                        <Wallet className="mx-auto mb-2 opacity-40" size={32} />
                        <p>{language === 'ne' ? 'कुनै योगदान भेटिएन।' : 'No contributions recorded.'}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-4 border-t border-stone-100 bg-stone-50/60 flex flex-col sm:flex-row justify-between items-center text-xs text-stone-500 gap-2">
          <span>
            {language === 'ne'
              ? 'यहाँ गरिएको सम्पादन वा मेटाउने कार्यले साझेदारको कुल पूँजी र सम्बन्धित बैंक खातामा स्वतः मिलान गर्दछ।'
              : 'Edits and deletions here automatically update partner capital and corresponding account balances.'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 font-medium rounded-lg transition-colors"
          >
            {language === 'ne' ? 'बन्द गर्नुहोस्' : 'Close'}
          </button>
        </div>
      </div>

      {/* Edit Contribution Sub-Modal */}
      {editingContrib && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden border border-stone-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center p-5 border-b border-stone-100 bg-stone-50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Edit2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-stone-800">
                    {language === 'ne' ? 'योगदान सम्पादन गर्नुहोस्' : 'Edit Contribution'}
                  </h3>
                  <p className="text-xs text-stone-500">{livePartner.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingContrib(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {language === 'ne' ? 'लगानी रकम (Rs.)' : 'Investment Amount (Rs.)'} *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm font-semibold text-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {t.dateBS || 'Date (B.S.)'} *
                  </label>
                  <NepaliDatePicker value={editDateBS} onChange={setEditDateBS} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {t.paymentMethod || 'Payment Method'}
                  </label>
                  <select
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs font-medium text-stone-800"
                  >
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank Transfer</option>
                    <option value="WALLET">Digital Wallet</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {language === 'ne' ? 'जम्मा खाता (Destination Account)' : 'Destination Account'} *
                </label>
                <select
                  required
                  value={editAccountId}
                  onChange={(e) => setEditAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs font-medium text-stone-800"
                >
                  <option value="">-- {language === 'ne' ? 'खाता छान्नुहोस्' : 'Select Account'} --</option>
                  {bankAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Rs. {(a.currentBalance || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {t.notes || 'Remarks / Notes'}
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl focus:ring-2 focus:ring-blue-500 text-xs text-stone-800"
                  placeholder={language === 'ne' ? 'कैफियत...' : 'Notes...'}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingContrib(null)}
                  className="px-4 py-2 text-stone-600 text-xs font-medium hover:bg-stone-100 rounded-xl transition-colors"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit}
                  className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60"
                >
                  {isSubmittingEdit ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  <span>{isSubmittingEdit ? (language === 'ne' ? 'सुरक्षित गर्दै...' : 'Saving...') : (t.save || 'Save Changes')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingContrib && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[70]">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden border border-rose-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle size={24} />
              </div>
              <h3 className="text-base font-bold text-stone-900 mb-1">
                {language === 'ne' ? 'योगदान मेटाउने पुष्टि' : 'Delete Contribution?'}
              </h3>
              <p className="text-xs text-stone-500 mb-4">
                {language === 'ne'
                  ? `${livePartner.name} को यो योगदान मेटाउँदा कुल लगानी र सम्बन्धित खाताबाट यो रकम घट्नेछ।`
                  : `Deleting this contribution will deduct the amount from ${livePartner.name}'s capital and the corresponding account.`}
              </p>

              {/* Contribution details card */}
              <div className="bg-rose-50/60 border border-rose-100 rounded-xl p-3 text-left mb-4 text-xs space-y-1">
                <div className="flex justify-between text-stone-600">
                  <span>{t.amount || 'Amount'}:</span>
                  <span className="font-bold text-rose-700">Rs. {deletingContrib.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>{t.dateBS || 'Date'}:</span>
                  <span className="font-medium text-stone-800">{deletingContrib.dateBS}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>{t.paymentMethod || 'Method'}:</span>
                  <span className="font-medium text-stone-800">{deletingContrib.paymentMethod}</span>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setDeletingContrib(null)}
                  className="flex-1 py-2 text-stone-600 text-xs font-semibold hover:bg-stone-100 rounded-xl transition-colors"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="flex-1 flex items-center justify-center space-x-1.5 py-2 bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 rounded-xl transition-colors disabled:opacity-60"
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  <span>{isDeleting ? (language === 'ne' ? 'मेटाउँदै...' : 'Deleting...') : (language === 'ne' ? 'मेटाउनुहोस्' : 'Delete')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
