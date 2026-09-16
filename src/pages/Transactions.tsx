import React from 'react';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import SearchableCategorySelect from '../components/SearchableCategorySelect';
import { translations } from '../lib/translations';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { Plus, UploadCloud, Save, X, Edit2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, writeBatch, runTransaction, getDocs } from 'firebase/firestore';
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

  const [activeTab, setActiveTab] = useState<'ALL' | 'EXPENSE' | 'INCOME' | 'CAPITAL_INFLOW'>('ALL');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);

  const initialForm = {
    type: 'EXPENSE' as 'INCOME' | 'EXPENSE' | 'CAPITAL_INFLOW',
    amount: '',
    category: '',
    subCategory: '',
    partyId: '',
    batchId: '',
    accountId: '',
    dateBS: new NepaliDate().format('YYYY MMMM DD'),
    paymentMethod: 'CASH',
    notes: '',
    addToInventory: false,
    inventoryItemName: '',
    quantity: '',
    unit: 'kg',
    unitPrice: '',
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
      let matchingInvItem: any = null;
      if (formData.addToInventory && formData.inventoryItemName) {
        const invQuery = query(collection(db, 'inventory'), where('farmId', '==', farmId), where('itemName', '==', formData.inventoryItemName.trim()));
        const snap = await getDocs(invQuery);
        if (!snap.empty) {
          matchingInvItem = { id: snap.docs[0].id, ...snap.docs[0].data() };
        }
      }

      await runTransaction(db, async (transaction) => {
        // --- READS ---
        let oldTx: Transaction | undefined;
        let oldAccDoc: any = null;
        let oldPartyDoc: any = null;
        
        if (editingId) {
          const oldTxRef = doc(db, 'transactions', editingId);
          const oldTxSnap = await transaction.get(oldTxRef);
          if (oldTxSnap.exists()) {
             oldTx = { id: oldTxSnap.id, ...oldTxSnap.data() } as Transaction;
             
             if (oldTx.accountId) {
                const oaRef = doc(db, 'bankAccounts', oldTx.accountId);
                oldAccDoc = await transaction.get(oaRef);
             }
             if (oldTx.partyId) {
                const opRef = doc(db, 'parties', oldTx.partyId);
                oldPartyDoc = await transaction.get(opRef);
             }
          }
        }
        
        let resolvedAccountId = '';
        let newAccDoc: any = null;
        let newAccRef: any = null;
        
        if (formData.paymentMethod !== 'CREDIT') {
          const match = accounts.find(a => a.type === formData.paymentMethod);
          if (match) {
            resolvedAccountId = match.id;
            newAccRef = doc(db, 'bankAccounts', resolvedAccountId);
            newAccDoc = await transaction.get(newAccRef);
          }
        }

        let newPartyDoc: any = null;
        let newPartyRef: any = null;
        if (formData.partyId) {
          newPartyRef = doc(db, 'parties', formData.partyId);
          newPartyDoc = await transaction.get(newPartyRef);
        }

        let invDoc: any = null;
        let invRef: any = null;
        if (formData.addToInventory && formData.inventoryItemName) {
           invRef = matchingInvItem ? doc(db, 'inventory', matchingInvItem.id) : doc(collection(db, 'inventory'));
           if (matchingInvItem) {
              invDoc = await transaction.get(invRef);
           }
        }
        
        // --- WRITES ---
        if (formData.paymentMethod !== 'CREDIT' && !resolvedAccountId) {
           newAccRef = doc(collection(db, 'bankAccounts'));
           transaction.set(newAccRef, {
              farmId,
              name: formData.paymentMethod === 'CASH' ? 'Cash' : (formData.paymentMethod === 'BANK' ? 'Bank' : 'Wallet'),
              type: formData.paymentMethod,
              accountNumber: '', bankName: '', initialBalance: 0, currentBalance: 0, status: 'ACTIVE', createdAt: Date.now()
           });
           resolvedAccountId = newAccRef.id;
           newAccDoc = { exists: () => true, data: () => ({ currentBalance: 0 }) };
        }

        payload.accountId = resolvedAccountId;

        if (editingId && oldTx) {
            // Revert old account balance
          if (oldAccDoc && oldAccDoc.exists()) {
             const isOldInflow = oldTx.type === 'INCOME' || oldTx.type === 'CAPITAL_INFLOW';
             const revertAmt = isOldInflow ? -oldTx.amount : oldTx.amount;
             transaction.update(oldAccDoc.ref, { currentBalance: oldAccDoc.data().currentBalance + revertAmt });
          }
          
          // Revert old party balance
          if (oldPartyDoc && oldPartyDoc.exists()) {
            if (oldTx.paymentMethod !== 'CREDIT') {
               const revertAmt = oldTx.amount; // always add back what was paid
               transaction.update(oldPartyDoc.ref, { pendingBalance: oldPartyDoc.data().pendingBalance + revertAmt });
            } else {
               transaction.update(oldPartyDoc.ref, { pendingBalance: oldPartyDoc.data().pendingBalance - oldTx.amount });
            }
          }
          
          transaction.update(doc(db, 'transactions', editingId), payload);

          // Apply new account balance
          if (resolvedAccountId && formData.paymentMethod !== 'CREDIT') {
             const isNewInflow = formData.type === 'INCOME' || formData.type === 'CAPITAL_INFLOW';
             const applyAmt = isNewInflow ? amt : -amt;
             let finalBal = 0;
             if (oldTx.accountId === resolvedAccountId && oldAccDoc && oldAccDoc.exists()) {
                 const isOldInflow = oldTx.type === 'INCOME' || oldTx.type === 'CAPITAL_INFLOW';
                 const revertAmt = isOldInflow ? -oldTx.amount : oldTx.amount;
                 finalBal = oldAccDoc.data().currentBalance + revertAmt + applyAmt;
                 transaction.update(newAccRef, { currentBalance: finalBal });
             } else if (newAccDoc && newAccDoc.exists()) { 
                 finalBal = newAccDoc.data().currentBalance + applyAmt;
                 transaction.update(newAccRef, { currentBalance: finalBal });
             }
          }
          
          // Apply new party balance
          if (formData.partyId) {
             let finalBal = 0;
             if (oldTx.partyId === formData.partyId && oldPartyDoc && oldPartyDoc.exists()) {
                let revertAmt = 0;
                if (oldTx.paymentMethod !== 'CREDIT') revertAmt = oldTx.amount;
                else revertAmt = -oldTx.amount;
                finalBal = oldPartyDoc.data().pendingBalance + revertAmt;
                
                if (formData.paymentMethod !== 'CREDIT') finalBal -= amt;
                else finalBal += amt;
                transaction.update(newPartyRef, { pendingBalance: finalBal });
             } else if (newPartyDoc && newPartyDoc.exists()) {
                finalBal = newPartyDoc.data().pendingBalance;
                if (formData.paymentMethod !== 'CREDIT') finalBal -= amt;
                else finalBal += amt;
                transaction.update(newPartyRef, { pendingBalance: finalBal });
             }
          }
        } else {
          (payload as any).createdAt = Date.now();
          const newTxRef = doc(collection(db, 'transactions'));
          transaction.set(newTxRef, payload);

          if (resolvedAccountId && formData.paymentMethod !== 'CREDIT' && newAccDoc && newAccDoc.exists()) {
             const isNewInflow = formData.type === 'INCOME' || formData.type === 'CAPITAL_INFLOW';
             const applyAmt = isNewInflow ? amt : -amt;
             transaction.update(newAccRef, { currentBalance: newAccDoc.data().currentBalance + applyAmt });
          }

          if (formData.partyId && newPartyDoc && newPartyDoc.exists()) {
             const party = newPartyDoc.data();
             if (formData.paymentMethod !== 'CREDIT') {
                transaction.update(newPartyRef, { pendingBalance: party.pendingBalance - amt });
             } else {
                transaction.update(newPartyRef, { pendingBalance: party.pendingBalance + amt });
             }
          }
        }
        
        // Inventory Auto-Add logic
        if (formData.addToInventory && formData.inventoryItemName) {
           if (invDoc && invDoc.exists()) {
              transaction.update(invRef, { currentStock: invDoc.data().currentStock + Number(formData.quantity) });
           } else {
              transaction.set(invRef, {
                 farmId,
                 itemName: formData.inventoryItemName.trim(),
                 category: formData.category,
                 subCategory: formData.subCategory || '',
                 currentStock: Number(formData.quantity),
                 unit: formData.unit,
                 unitPrice: Number(formData.unitPrice) || (amt / Number(formData.quantity)),
                 minThreshold: 10,
              });
           }
        }
      });

      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err) {
      console.error("Save failed", err);
      alert(t.error || "Save failed. Please try again.");
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
            const isOldInflow = tx.type === 'INCOME' || tx.type === 'CAPITAL_INFLOW';
            const revertAmt = isOldInflow ? -tx.amount : tx.amount;
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

  const filteredTransactions = transactions
    .filter(tx => activeTab === 'ALL' ? true : tx.type === activeTab)
    .sort((a, b) => b.dateBS.localeCompare(a.dateBS));

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
          <button onClick={() => { setFormData({...initialForm, type: activeTab === 'ALL' ? 'EXPENSE' : activeTab}); setEditingId(null); setIsModalOpen(true); }} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
            <Plus size={18} />
            <span className="font-medium">{t.addTransaction}</span>
          </button>
        </div>
      </div>

      <div className="flex space-x-2 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'ALL' ? 'text-blue-700' : 'text-stone-500 hover:text-stone-700'}`}
        >
          {t.all || 'All'}
          {activeTab === 'ALL' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
        </button>
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
        <button
          onClick={() => setActiveTab('CAPITAL_INFLOW')}
          className={`px-6 py-3 font-medium text-sm transition-colors relative ${activeTab === 'CAPITAL_INFLOW' ? 'text-indigo-700' : 'text-stone-500 hover:text-stone-700'}`}
        >
          {t.capitalInflow || 'Capital / Equity'}
          {activeTab === 'CAPITAL_INFLOW' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
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
                <td className={`p-4 text-right font-medium ${tx.type === 'INCOME' ? 'text-emerald-600' : tx.type === 'CAPITAL_INFLOW' ? 'text-indigo-600' : 'text-rose-600'}`}>Rs. {tx.amount.toLocaleString()}</td>
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
                      onCategoryChange={(val) => {
                         const isInv = ['feed', 'medicine', 'seed', 'fertilizer', 'दाना', 'औषधि', 'बिउ', 'मल', 'विषादी'].some(k => val.toLowerCase().includes(k));
                         setFormData(prev => ({
                           ...prev, 
                           category: val,
                           ...((isInv && prev.type === 'EXPENSE' && !editingId) ? { addToInventory: true, inventoryItemName: val } : {})
                         }));
                      }}
                      onSubCategoryChange={(val) => {
                         const isInv = ['feed', 'medicine', 'seed', 'fertilizer', 'दाना', 'औषधि', 'बिउ', 'मल', 'विषादी'].some(k => val.toLowerCase().includes(k));
                         setFormData(prev => ({
                           ...prev, 
                           subCategory: val,
                           ...((isInv && prev.type === 'EXPENSE' && !editingId) ? { addToInventory: true, inventoryItemName: val } : {})
                         }));
                      }}
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

                {formData.type === 'EXPENSE' && (
                  <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 mt-4 space-y-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.addToInventory}
                        onChange={(e) => setFormData({...formData, addToInventory: e.target.checked})}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                      />
                      <span className="font-medium text-stone-800">{t.addToInventory || 'Add to Inventory Stock'}</span>
                    </label>

                    {formData.addToInventory && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">{t.itemName}</label>
                          <input 
                            type="text" 
                            required
                            value={formData.inventoryItemName}
                            onChange={(e) => setFormData({...formData, inventoryItemName: e.target.value})}
                            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            placeholder="e.g. Fish Feed"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">Quantity (परिमाण)</label>
                          <input 
                            type="number" 
                            required
                            min="0"
                            step="0.01"
                            value={formData.quantity}
                            onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">{t.unit}</label>
                          <select 
                            value={formData.unit}
                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="kg">kg (किलो)</option>
                            <option value="ltr">ltr (लिटर)</option>
                            <option value="bag">bag (बोरा)</option>
                            <option value="packet">packet (प्याकेट)</option>
                            <option value="pcs">pcs (गोटा)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-stone-700 mb-1">{t.unitPrice}</label>
                          <input 
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.unitPrice}
                            onChange={(e) => setFormData({...formData, unitPrice: e.target.value})}
                            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                            placeholder="Auto-calculated if blank"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
