import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import CategorySelect from '../components/CategorySelect';
import { translations } from '../lib/translations';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { Plus, UploadCloud, Save, X, Edit2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Category, Party, Batch, BankAccount } from '../types';

export default function Transactions() {
  const { language, farmId } = useAppStore();
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const initialForm = {
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE',
    amount: '',
    category: '',
    subCategory: '',
    partyId: '',
    batchId: '',
    accountId: '',
    dateBS: new NepaliDate().format('YYYY MMMM DD'),
    paymentMethod: 'CASH',
    notes: '',
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!farmId) return;
    
    const unsubTxs = onSnapshot(query(collection(db, 'transactions'), where('farmId', '==', farmId)), snap => {
      const data: Transaction[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Transaction));
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setTransactions(data);
    }, (err) => console.warn(err));

    const unsubCats = onSnapshot(query(collection(db, 'categories'), where('farmId', '==', farmId)), snap => {
      const data: Category[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Category));
      setCategories(data);
    }, (err) => console.warn(err));

    const unsubParties = onSnapshot(query(collection(db, 'parties'), where('farmId', '==', farmId)), snap => {
      const data: Party[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Party));
      setParties(data);
    }, (err) => console.warn(err));

    const unsubBatches = onSnapshot(query(collection(db, 'batches'), where('farmId', '==', farmId)), snap => {
      const data: Batch[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Batch));
      setBatches(data);
    }, (err) => console.warn(err));

    const unsubAcc = onSnapshot(query(collection(db, 'bankAccounts'), where('farmId', '==', farmId)), snap => {
      const data: BankAccount[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as BankAccount));
      setAccounts(data);
    }, (err) => console.warn(err));

    return () => { unsubTxs(); unsubCats(); unsubParties(); unsubBatches(); unsubAcc(); };
  }, [farmId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setIsModalOpen(true);
    const fd = new FormData();
    fd.append('receipt', file);

    try {
      const response = await fetch('/api/ai/parse-receipt', {
        method: 'POST',
        body: fd,
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        alert(data.error || 'Failed to parse receipt image. Please enter manually.');
      } else if (data) {
        setFormData(prev => ({
          ...prev,
          amount: data.amount?.toString() || prev.amount,
          category: data.category || prev.category,
          subCategory: data.subCategory || prev.subCategory,
          type: data.type || prev.type,
          dateBS: data.dateBS || prev.dateBS,
        }));
      }
    } catch (err) {
      console.error('Failed to parse receipt', err);
      alert('Failed to parse receipt image. Please enter manually.');
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;

    const amt = Number(formData.amount);
    const payload = {
      ...formData,
      amount: amt,
      farmId,
      createdBy: 'user', 
    };

    try {
      const batch = writeBatch(db);

      if (editingId) {
        const oldTx = transactions.find(t => t.id === editingId);
        
        // Revert old account balance
        if (oldTx && oldTx.accountId) {
          const oldAcc = accounts.find(a => a.id === oldTx.accountId);
          if (oldAcc) {
            const revertAmt = oldTx.type === 'INCOME' ? -oldTx.amount : oldTx.amount;
            batch.update(doc(db, 'bankAccounts', oldAcc.id), { currentBalance: oldAcc.currentBalance + revertAmt });
          }
        }
        
        // Revert old party balance
        if (oldTx && oldTx.partyId && oldTx.paymentMethod !== 'CREDIT') {
          const oldParty = parties.find(p => p.id === oldTx.partyId);
          if (oldParty) {
            // INCOME from BUYER = settled udharo, so revert means increase pending balance
            // EXPENSE to SUPPLIER = settled payable, so revert means increase pending balance
            const revertAmt = oldTx.type === 'INCOME' ? oldTx.amount : oldTx.amount;
            batch.update(doc(db, 'parties', oldParty.id), { pendingBalance: oldParty.pendingBalance + revertAmt });
          }
        }
        // If it was CREDIT, the transaction increased their pending balance, so revert means decrease
        if (oldTx && oldTx.partyId && oldTx.paymentMethod === 'CREDIT') {
          const oldParty = parties.find(p => p.id === oldTx.partyId);
          if (oldParty) {
            batch.update(doc(db, 'parties', oldParty.id), { pendingBalance: oldParty.pendingBalance - oldTx.amount });
          }
        }
        
        batch.update(doc(db, 'transactions', editingId), payload);

        // Apply new account balance
        if (formData.accountId && formData.paymentMethod !== 'CREDIT') {
          const newAcc = accounts.find(a => a.id === formData.accountId);
          if (newAcc) {
            const applyAmt = formData.type === 'INCOME' ? amt : -amt;
            let finalBal = newAcc.currentBalance;
            if (oldTx && oldTx.accountId === formData.accountId) {
               const revertAmt = oldTx.type === 'INCOME' ? -oldTx.amount : oldTx.amount;
               finalBal += revertAmt;
            }
            finalBal += applyAmt;
            batch.update(doc(db, 'bankAccounts', newAcc.id), { currentBalance: finalBal });
          }
        }
        
        // Apply new party balance
        if (formData.partyId) {
          const newParty = parties.find(p => p.id === formData.partyId);
          if (newParty) {
             let finalBal = newParty.pendingBalance;
             if (oldTx && oldTx.partyId === formData.partyId) {
                if (oldTx.paymentMethod !== 'CREDIT') finalBal += oldTx.amount;
                else finalBal -= oldTx.amount;
             }
             if (formData.paymentMethod !== 'CREDIT') {
                finalBal -= amt;
             } else {
                finalBal += amt;
             }
             batch.update(doc(db, 'parties', newParty.id), { pendingBalance: finalBal });
          }
        }

      } else {
        (payload as any).createdAt = Date.now();
        const newTxRef = doc(collection(db, 'transactions'));
        batch.set(newTxRef, payload);

        // Apply new account balance
        if (formData.accountId && formData.paymentMethod !== 'CREDIT') {
          const acc = accounts.find(a => a.id === formData.accountId);
          if (acc) {
            const applyAmt = formData.type === 'INCOME' ? amt : -amt;
            batch.update(doc(db, 'bankAccounts', acc.id), { currentBalance: acc.currentBalance + applyAmt });
          }
        }
        
        // Apply new party balance
        if (formData.partyId) {
          const party = parties.find(p => p.id === formData.partyId);
          if (party) {
             if (formData.paymentMethod !== 'CREDIT') {
                batch.update(doc(db, 'parties', party.id), { pendingBalance: party.pendingBalance - amt });
             } else {
                batch.update(doc(db, 'parties', party.id), { pendingBalance: party.pendingBalance + amt });
             }
          }
        }
      }

      await batch.commit();

      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) {
      try {
        const tx = transactions.find(t => t.id === id);
        const batch = writeBatch(db);
        
        if (tx && tx.accountId && tx.paymentMethod !== 'CREDIT') {
          const acc = accounts.find(a => a.id === tx.accountId);
          if (acc) {
            const revertAmt = tx.type === 'INCOME' ? -tx.amount : tx.amount;
            batch.update(doc(db, 'bankAccounts', acc.id), { currentBalance: acc.currentBalance + revertAmt });
          }
        }
        
        if (tx && tx.partyId) {
          const party = parties.find(p => p.id === tx.partyId);
          if (party) {
             if (tx.paymentMethod !== 'CREDIT') {
                batch.update(doc(db, 'parties', party.id), { pendingBalance: party.pendingBalance + tx.amount });
             } else {
                batch.update(doc(db, 'parties', party.id), { pendingBalance: party.pendingBalance - tx.amount });
             }
          }
        }
        
        batch.delete(doc(db, 'transactions', id));
        await batch.commit();
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const openEdit = (tx: Transaction) => {
    setEditingId(tx.id);
    setFormData({
      type: tx.type,
      amount: tx.amount.toString(),
      category: tx.category,
      subCategory: tx.subCategory || '',
      partyId: tx.partyId || '',
      batchId: tx.batchId || '',
      accountId: tx.accountId || '',
      dateBS: tx.dateBS,
      paymentMethod: tx.paymentMethod || 'CASH',
      notes: tx.notes || '',
    });
    setIsModalOpen(true);
  };

  const getPartyName = (id?: string) => parties.find(p => p.id === id)?.name || '-';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-stone-800">{t.transactions}</h1>
        <div className="flex space-x-3">
          <div>
            <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
            <button onClick={() => fileInputRef.current?.click()} className="flex items-center space-x-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors border border-stone-200">
              <UploadCloud size={18} />
              <span className="font-medium">{t.receiptScanner}</span>
            </button>
          </div>
          <button onClick={() => { setFormData(initialForm); setEditingId(null); setIsModalOpen(true); }} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors">
            <Plus size={18} />
            <span className="font-medium">{t.addTransaction}</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm  overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
              <th className="p-4">{t.dateBS}</th>
              <th className="p-4">{t.type}</th>
              <th className="p-4">{t.category}</th>
              <th className="p-4">{t.party}</th>
              <th className="p-4 text-right">{t.amount}</th>
              <th className="p-4 text-center">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="border-b border-stone-100 hover:bg-stone-50">
                <td className="p-4 text-stone-600">{tx.dateBS}</td>
                <td className="p-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${tx.type === 'INCOME' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {tx.type === 'INCOME' ? t.income : t.expense}
                  </span>
                </td>
                <td className="p-4 text-stone-800">{tx.category}</td>
                <td className="p-4 text-stone-600">{getPartyName(tx.partyId)}</td>
                <td className="p-4 text-right font-medium text-stone-900">Rs. {tx.amount.toLocaleString()}</td>
                <td className="p-4 text-center">
                  <div className="flex justify-center items-center space-x-2">
                    <button onClick={() => openEdit(tx)} className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(tx.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-500">{t.noData}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl  shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-800">{parsing ? t.parsingReceipt : (editingId ? t.edit : t.addTransaction)}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            {parsing ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-stone-600">{t.aiExtracting}</p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.type}</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({...formData, type: e.target.value as 'INCOME'|'EXPENSE'})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="EXPENSE">{t.expense}</option>
                      <option value="INCOME">{t.income}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.dateBS}</label>
                    <NepaliDatePicker value={formData.dateBS} onChange={(val) => setFormData({...formData, dateBS: val})} />
                  </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.amount}</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      required
                      min="0"
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <CategorySelect 
                    type={formData.type}
                    selectedCategoryName={formData.category}
                    selectedSubCategoryName={formData.subCategory}
                    onCategoryChange={(val) => setFormData({...formData, category: val})}
                    onSubCategoryChange={(val) => setFormData({...formData, subCategory: val})}
                    required
                  />

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.party} (Optional)</label>
                    <select 
                      value={formData.partyId}
                      onChange={e => setFormData({...formData, partyId: e.target.value})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="">{t.selectParty}</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.paymentMethod}</label>
                    <select 
                      value={formData.paymentMethod}
                      onChange={e => setFormData({...formData, paymentMethod: e.target.value})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="CASH">{t.cash}</option>
                      <option value="BANK">{t.bankTransfer}</option>
                      <option value="WALLET">{t.digitalWallet}</option>
                      <option value="CREDIT">{t.creditUdharo}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.accounts || 'Account'}</label>
                    <select 
                      value={formData.accountId}
                      onChange={e => setFormData({...formData, accountId: e.target.value})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={formData.paymentMethod === 'CREDIT'}
                      required={formData.paymentMethod !== 'CREDIT'}
                    >
                      <option value="">{t.selectAccount || '-- Select Account --'}</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} (Rs.{a.currentBalance})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.notes}</label>
                  <textarea 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors">
                    {t.cancel}
                  </button>
                  <button type="submit" className="flex items-center space-x-2 px-5 py-2.5 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl transition-colors">
                    <Save size={18} />
                    <span>{t.saveEntry}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
