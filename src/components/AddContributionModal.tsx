import React, { useState } from 'react';
import { Partner, BankAccount } from '../types';
import { X, Save, Loader2 } from 'lucide-react';
import NepaliDatePicker from './NepaliDatePicker';
import NepaliDate from 'nepali-datetime';
import { doc, collection, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';

interface AddContributionModalProps {
  partner: Partner;
  accounts: BankAccount[];
  isOpen: boolean;
  onClose: () => void;
}

export default function AddContributionModal({ partner, accounts, isOpen, onClose }: AddContributionModalProps) {
  const { language, user } = useAppStore();
  const farmId = user?.farmId;
  const t = translations[language];

  const [form, setForm] = useState({
    amount: '',
    dateBS: new NepaliDate().format('YYYY MMMM DD'),
    accountId: '',
    paymentMethod: 'BANK_TRANSFER',
    notes: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !user?.uid) return;
    
    setIsSubmitting(true);
    setError('');

    try {
      const amount = Number(form.amount);
      if (amount <= 0) throw new Error("Amount must be greater than zero.");
      if (!form.accountId) throw new Error("Please select a destination account.");

      await runTransaction(db, async (transaction) => {
        const partnerRef = doc(db, 'partners', partner.id);
        const accountRef = doc(db, 'bankAccounts', form.accountId);
        const contributionRef = doc(collection(db, 'partner_contributions'));

        const partnerDoc = await transaction.get(partnerRef);
        const accountDoc = await transaction.get(accountRef);

        if (!partnerDoc.exists()) throw new Error("Partner not found.");
        if (!accountDoc.exists()) throw new Error("Account not found.");

        const currentInvestment = partnerDoc.data().investmentAmount || 0;
        const currentBalance = accountDoc.data().currentBalance || 0;

        // 1. Update Partner Investment
        transaction.update(partnerRef, {
          investmentAmount: currentInvestment + amount
        });

        // 2. Update Bank Account Balance
        transaction.update(accountRef, {
          currentBalance: currentBalance + amount
        });

        // 3. Create Ledger Entry
        transaction.set(contributionRef, {
          farmId,
          partnerId: partner.id,
          partnerName: partner.name,
          amount,
          dateBS: form.dateBS,
          targetAccountId: form.accountId,
          paymentMethod: form.paymentMethod,
          notes: form.notes,
          createdAt: Date.now(),
          createdBy: user.uid
        });

        // 4. Create Income Transaction record for Financial Reports & Cash flow
        const txRef = doc(collection(db, 'transactions'));
        transaction.set(txRef, {
          farmId,
          type: 'INCOME',
          amount,
          category: 'Partner Capital',
          subCategory: 'Contribution',
          accountId: form.accountId,
          paymentMethod: form.paymentMethod,
          dateBS: form.dateBS,
          notes: `Partner Contribution: ${partner.name}${form.notes ? ` - ${form.notes}` : ''}`,
          createdAt: Date.now(),
        });
      });

      onClose();
      setForm({
        amount: '',
        dateBS: new NepaliDate().format('YYYY MMMM DD'),
        accountId: '',
        paymentMethod: 'BANK_TRANSFER',
        notes: ''
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to save contribution.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl  animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-6 border-b border-stone-100">
          <div>
            <h2 className="text-xl font-bold text-stone-800">{t.addContribution || 'Add Contribution'}</h2>
            <p className="text-sm text-stone-500 mt-1">{partner.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 rounded-full hover:bg-stone-50 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t.contributionAmount || 'Amount'}</label>
              <input 
                type="number" 
                required 
                min="1"
                value={form.amount} 
                onChange={e => setForm({...form, amount: e.target.value})} 
                className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" 
                placeholder="Rs."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t.contributionDate || 'Date (B.S.)'}</label>
              <NepaliDatePicker value={form.dateBS} onChange={(val) => setForm({...form, dateBS: val})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.paymentDestination || 'Destination Account'}</label>
            <select 
              required 
              value={form.accountId} 
              onChange={e => setForm({...form, accountId: e.target.value})} 
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">{t.cashBankDropdownLabel || '-- Select Account --'}</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name} (Bal: Rs.{acc.currentBalance})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.paymentMethod || 'Payment Method'}</label>
            <select 
              required 
              value={form.paymentMethod} 
              onChange={e => setForm({...form, paymentMethod: e.target.value})} 
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="CASH">{t.cash || 'Cash'}</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
              <option value="WALLET">Digital Wallet (eSewa/Khalti)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t.remarksNotes || 'Remarks / Notes'}</label>
            <textarea 
              rows={3}
              value={form.notes} 
              onChange={e => setForm({...form, notes: e.target.value})} 
              className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 resize-none" 
              placeholder="e.g. Part payment for 2nd installment"
            />
          </div>

          <div className="flex justify-end pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-6 py-2.5 text-stone-600 font-medium hover:bg-stone-50 rounded-xl transition-colors mr-2"
            >
              {t.cancel || 'Cancel'}
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting} 
              className="flex items-center space-x-2 px-6 py-2.5 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl transition-colors disabled:opacity-70"
            >
              {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              <span>{t.saveContribution || 'Save Contribution'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
