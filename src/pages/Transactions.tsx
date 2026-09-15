import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import SearchableCategorySelect from '../components/SearchableCategorySelect';
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

  const [activeTab, setActiveTab] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);

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

      // Auto-resolve account based on paymentMethod
      let resolvedAccountId = '';
      if (formData.paymentMethod !== 'CREDIT') {
        const match = accounts.find(a => a.type === formData.paymentMethod);
        if (match) {
          resolvedAccountId = match.id;
        } else {
          // auto-create if missing
          const newAccRef = doc(collection(db, 'bankAccounts'));
          batch.set(newAccRef, {
             farmId,
             name: formData.paymentMethod === 'CASH' ? 'Cash' : (formData.paymentMethod === 'BANK' ? 'Bank' : 'Wallet'),
             type: formData.paymentMethod,
             accountNumber: '',
             bankName: '',
             initialBalance: 0,
             currentBalance: 0,
             status: 'ACTIVE',
             createdAt: Date.now()
          });
          resolvedAccountId = newAccRef.id;
          // inject to local array so subsequent find() succeeds
          accounts.push({
             id: resolvedAccountId,
             farmId,
             name: formData.paymentMethod,
             type: formData.paymentMethod as any,
             accountNumber: '',
             bankName: '',
             initialBalance: 0,
             currentBalance: 0,
             status: 'ACTIVE',
          });
        }
      }
      
      payload.accountId = resolvedAccountId;

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
        if (resolvedAccountId && formData.paymentMethod !== 'CREDIT') {
          const newAcc = accounts.find(a => a.id === resolvedAccountId);
          if (newAcc) {
            const applyAmt = formData.type === 'INCOME' ? amt : -amt;
            let finalBal = newAcc.currentBalance;
            if (oldTx && oldTx.accountId === resolvedAccountId) {
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
        if (resolvedAccountId && formData.paymentMethod !== 'CREDIT') {
          const acc = accounts.find(a => a.id === resolvedAccountId);
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

  const filteredTransactions = transactions.filter(tx => tx.type === activeTab);

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
          <button onClick={() => { setFormData({...initialForm, type: activeTab}); setEditingId(null); setIsModalOpen(true); }} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
            <Plus size={18} />
            <span className="font-medium">{t.addTransaction}</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('EXPENSE')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'EXPENSE' ? 'text-rose-700' : 'text-stone-500 hover:text-stone-700'}`}
        >
          {t.expense}
          {activeTab === 'EXPENSE' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600" />}
        </button>
        <button
          onClick={() => setActiveTab('INCOME')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'INCOME' ? 'text-emerald-700' : 'text-stone-500 hover:text-stone-700'}`}
        >
          {t.income}
          {activeTab === 'INCOME' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm  overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
              <th className="p-4 w-16">{t.sn}</th>
              <th className="p-4">{t.dateBS}</th>
              <th className="p-4">{t.category}</th>
              <th className="p-4">{t.party}</th>
              <th className="p-4 text-right">{t.amount}</th>
              <th className="p-4 text-center">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx, index) => (
              <tr 
                key={tx.id} 
                className="border-b border-stone-100 hover:bg-stone-50 cursor-pointer"
                onDoubleClick={() => setPreviewTx(tx)}
              >
                <td className="p-4 text-stone-600">{index + 1}</td>
                <td className="p-4 text-stone-600">{tx.dateBS}</td>
                <td className="p-4 text-stone-800">
                  {tx.subCategory ? tx.subCategory : tx.category}
                </td>
                <td className="p-4 text-stone-600">{getPartyName(tx.partyId)}</td>
                <td className="p-4 text-right font-medium text-stone-900">Rs. {tx.amount.toLocaleString()}</td>
                <td className="p-4 text-center">
                  <div className="flex justify-center items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(tx)} className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(tx.id)} className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-stone-500">{t.noData}</td>
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
                <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-stone-600">{t.aiExtracting}</p>
              </div>
            ) : (
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.type}</label>
                    <select 
                      value={formData.type}
                      onChange={e => setFormData({
                        ...formData, 
                        type: e.target.value as 'INCOME'|'EXPENSE',
                        category: '',
                        subCategory: ''
                      })}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.amount}</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      required
                      min="0"
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  
                  <div className="w-full">
                    <SearchableCategorySelect 
                      type={formData.type}
                      selectedCategoryName={formData.category}
                      selectedSubCategoryName={formData.subCategory}
                      onCategoryChange={(val) => setFormData(prev => ({...prev, category: val}))}
                      onSubCategoryChange={(val) => setFormData(prev => ({...prev, subCategory: val}))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.party} (Optional)</label>
                    <select 
                      value={formData.partyId}
                      onChange={e => setFormData({...formData, partyId: e.target.value})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="CASH">{t.cash}</option>
                      <option value="BANK">{t.bankTransfer}</option>
                      <option value="WALLET">{t.digitalWallet}</option>
                      <option value="CREDIT">{t.creditUdharo}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.notes}</label>
                  <textarea 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    rows={2}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors">
                    {t.cancel}
                  </button>
                  <button type="submit" className="flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 text-white font-medium hover:bg-emerald-700 rounded-xl transition-colors">
                    <Save size={18} />
                    <span>{t.saveEntry}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewTx && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className={`p-6 text-white ${previewTx.type === 'INCOME' ? 'bg-emerald-600' : 'bg-rose-600'} flex justify-between items-start`}>
              <div>
                <span className="text-white/80 text-sm font-medium uppercase tracking-wider">{previewTx.type === 'INCOME' ? t.income : t.expense}</span>
                <h2 className="text-3xl font-bold mt-1">Rs. {previewTx.amount.toLocaleString()}</h2>
              </div>
              <button onClick={() => setPreviewTx(null)} className="text-white/80 hover:text-white p-1">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                <div>
                  <p className="text-stone-500 mb-1">{t.dateBS}</p>
                  <p className="font-medium text-stone-900">{previewTx.dateBS}</p>
                </div>
                <div>
                  <p className="text-stone-500 mb-1">{t.category}</p>
                  <p className="font-medium text-stone-900">
                    {previewTx.subCategory ? previewTx.subCategory : previewTx.category}
                  </p>
                </div>
                <div>
                  <p className="text-stone-500 mb-1">{t.paymentMethod}</p>
                  <p className="font-medium text-stone-900">{previewTx.paymentMethod || 'CASH'}</p>
                </div>
                <div>
                  <p className="text-stone-500 mb-1">{t.party}</p>
                  <p className="font-medium text-stone-900">{getPartyName(previewTx.partyId)}</p>
                </div>
              </div>

              {previewTx.notes && (
                <div className="pt-4 border-t border-stone-100">
                  <p className="text-stone-500 text-sm mb-2">{t.notes || 'Notes'}</p>
                  <div className="bg-stone-50 p-4 rounded-xl text-stone-700 text-sm whitespace-pre-wrap">
                    {previewTx.notes}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
              <button onClick={() => { openEdit(previewTx); setPreviewTx(null); }} className="px-4 py-2 text-blue-700 font-medium hover:bg-blue-100 rounded-xl transition-colors">
                {t.edit || 'Edit'}
              </button>
              <button onClick={() => setPreviewTx(null)} className="px-4 py-2 bg-stone-200 text-stone-800 font-medium hover:bg-stone-300 rounded-xl transition-colors">
                {t.cancel || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
