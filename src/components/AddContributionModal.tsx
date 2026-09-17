import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Partner, BankAccount } from '../types';
import { translations } from '../lib/translations';
import { doc, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import NepaliDatePicker from './NepaliDatePicker';
import { X, Save, Wallet } from 'lucide-react';
import NepaliDate from 'nepali-datetime';

interface Props {
  partner: Partner;
  accounts: BankAccount[];
  isOpen: boolean;
  onClose: () => void;
}

export default function AddContributionModal({ partner, accounts, isOpen, onClose }: Props) {
  const { farmId, language } = useAppStore();
  const t = translations[language];

  const [amount, setAmount] = useState('');
  const [dateBS, setDateBS] = useState(new NepaliDate().format('YYYY MMMM DD'));
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [accountId, setAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !amount || !accountId) return;
    
    setIsSubmitting(true);
    try {
      const numAmount = Number(amount);

      await runTransaction(db, async (transaction) => {
        // --- READS ---
        // 1. Get Partner
        const partnerRef = doc(db, 'partners', partner.id);
        const partnerDoc = await transaction.get(partnerRef);
        if (!partnerDoc.exists()) throw new Error("Partner does not exist!");
        
        // 2. Get Bank Account
        const accRef = doc(db, 'bankAccounts', accountId);
        const accDoc = await transaction.get(accRef);
        if (!accDoc.exists()) throw new Error("Account does not exist!");

        // --- WRITES ---
        // 1. Update Partner Capital
        const newInvestment = partnerDoc.data().investmentAmount + numAmount;
        transaction.update(partnerRef, { investmentAmount: newInvestment });

        // 2. Update Bank Account Balance
        const newBalance = (accDoc.data().currentBalance || 0) + numAmount;
        transaction.update(accRef, { currentBalance: newBalance });

        // 3. Record Contribution History
        const contributionRef = doc(collection(db, 'partnerContributions'));
        const txRef = doc(collection(db, 'transactions'));

        transaction.set(contributionRef, {
          farmId,
          partnerId: partner.id,
          partnerName: partner.name,
          amount: numAmount,
          dateBS,
          targetAccountId: accountId,
          paymentMethod,
          notes,
          transactionId: txRef.id,
          createdAt: Date.now()
        });

        // 4. Record as CAPITAL_INFLOW in the main transactions ledger
        transaction.set(txRef, {
          farmId,
          type: 'CAPITAL_INFLOW',
          amount: numAmount,
          category: 'Partner Capital',
          partyId: partner.id,
          accountId: accountId,
          paymentMethod,
          dateBS,
          notes: notes || `Capital Contribution by ${partner.name}`,
          contributionId: contributionRef.id,
          createdAt: Date.now(),
        });
      });

      alert('Capital contribution added successfully!');
      onClose();
    } catch (err: any) {
      console.error(err);
      alert('Failed to add contribution: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Wallet size={20} /></div>
            <div>
              <h2 className="text-xl font-bold text-stone-800">Add Contribution</h2>
              <p className="text-sm text-stone-500">{partner.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Investment Amount (Rs.)</label>
            <input type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t.dateBS}</label>
              <NepaliDatePicker value={dateBS} onChange={setDateBS} />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t.paymentMethod}</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500">
                <option value="CASH">Cash</option>
                <option value="BANK">Bank Transfer</option>
                <option value="WALLET">Digital Wallet</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Destination Account</label>
            <select required value={accountId} onChange={e => setAccountId(e.target.value)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500">
              <option value="">-- Select Account --</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} (Rs. {a.currentBalance?.toLocaleString()})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">Remarks / Notes</label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="flex items-center space-x-2 px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-70">
              <Save size={18} />
              <span>{isSubmitting ? 'Saving...' : 'Save Contribution'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
