import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { Plus, ArrowRightLeft, Wallet, Landmark, PiggyBank, Search, X, Save, Edit2, Trash2, FileText, ArrowUpRight, ArrowDownRight, TrendingDown, Briefcase } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { BankAccount, Transfer, Transaction, Partner } from '../types';

export default function Accounts() {
  const { language, user } = useAppStore();
  const farmId = user?.farmId;
  const t = translations[language];

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [statementAccount, setStatementAccount] = useState<BankAccount | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);

  const initialAccountForm = {
    name: '',
    type: 'CASH' as 'CASH' | 'BANK' | 'WALLET',
    accountNumber: '',
    bankName: '',
    initialBalance: 0,
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  };
  const [accountForm, setAccountForm] = useState(initialAccountForm);

  const initialTransferForm = {
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    fee: '0',
    dateBS: new NepaliDate().format('YYYY MMMM DD'),
    reference: '',
    notes: '',
  };
  const [transferForm, setTransferForm] = useState(initialTransferForm);

  useEffect(() => {
    if (!farmId) return;

    const unsubAcc = onSnapshot(query(collection(db, 'bankAccounts'), where('farmId', '==', farmId)), snap => {
      const data: BankAccount[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as BankAccount));
      data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setAccounts(data);
    });

    const unsubTrans = onSnapshot(query(collection(db, 'transfers'), where('farmId', '==', farmId)), snap => {
      const data: Transfer[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Transfer));
      data.sort((a, b) => b.createdAt - a.createdAt);
      setTransfers(data);
    });
    
    const unsubTx = onSnapshot(query(collection(db, 'transactions'), where('farmId', '==', farmId)), snap => {
      const data: Transaction[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Transaction));
      setTransactions(data);
    });

    const unsubPartners = onSnapshot(query(collection(db, 'partners'), where('farmId', '==', farmId)), snap => {
      const data: Partner[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Partner));
      setPartners(data);
    });

    return () => { unsubAcc(); unsubTrans(); unsubTx(); unsubPartners(); };
  }, [farmId]);

  const totalCash = accounts.filter(a => a.type === 'CASH').reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);
  const totalBank = accounts.filter(a => a.type === 'BANK' || a.type === 'WALLET').reduce((sum, a) => sum + (Number(a.currentBalance) || 0), 0);
  const totalLiquidity = totalCash + totalBank;

  // Real-time Total Investment, Total Expense, and remaining Cash & Bank
  const totalInvestment = partners.reduce((sum, p) => sum + (Number(p.investmentAmount) || 0), 0);
  const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const remainingCashBank = totalInvestment - totalExpense;

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;

    try {
      if (editingId) {
        await updateDoc(doc(db, 'bankAccounts', editingId), {
          ...accountForm,
        });
      } else {
        await addDoc(collection(db, 'bankAccounts'), {
          farmId,
          ...accountForm,
          currentBalance: accountForm.initialBalance,
          createdAt: Date.now(),
        });
      }
      setIsAccountModalOpen(false);
      setAccountForm(initialAccountForm);
      setEditingId(null);
    } catch (err: any) {
      console.error(err);
      alert("Failed to save account: " + err.message);
    }
  };

  const handleSaveTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;

    const fromAcc = accounts.find(a => a.id === transferForm.fromAccountId);
    const toAcc = accounts.find(a => a.id === transferForm.toAccountId);

    if (!fromAcc || !toAcc) {
      alert('Select valid accounts');
      return;
    }

    if (fromAcc.id === toAcc.id) {
      alert('Cannot transfer to the same account');
      return;
    }

    const amt = Number(transferForm.amount);
    const fee = Number(transferForm.fee);

    if (amt <= 0) {
      alert('Transfer amount must be greater than 0');
      return;
    }

    if (fromAcc.currentBalance < amt + fee) {
      alert('Insufficient balance in source account');
      return;
    }

    try {
      const batch = writeBatch(db);

      const transferRef = doc(collection(db, 'transfers'));
      batch.set(transferRef, {
        farmId,
        fromAccountId: fromAcc.id,
        toAccountId: toAcc.id,
        amount: amt,
        fee: fee,
        dateBS: transferForm.dateBS,
        reference: transferForm.reference,
        notes: transferForm.notes,
        createdAt: Date.now(),
      });

      const fromRef = doc(db, 'bankAccounts', fromAcc.id);
      batch.update(fromRef, { currentBalance: fromAcc.currentBalance - amt - fee });

      const toRef = doc(db, 'bankAccounts', toAcc.id);
      batch.update(toRef, { currentBalance: toAcc.currentBalance + amt });

      await batch.commit();

      setIsTransferModalOpen(false);
      setTransferForm(initialTransferForm);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) {
      await deleteDoc(doc(db, 'bankAccounts', id));
    }
  };

  const openEditAccount = (acc: BankAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(acc.id);
    setAccountForm({
      name: acc.name,
      type: acc.type,
      accountNumber: acc.accountNumber || '',
      bankName: acc.bankName || '',
      initialBalance: acc.initialBalance,
      status: acc.status,
    });
    setIsAccountModalOpen(true);
  };
  
  const handleDeleteClick = (accId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    handleDeleteAccount(accId);
  }

  const getAccountIcon = (type: string) => {
    if (type === 'CASH') return <Wallet size={24} className="text-green-600" />;
    if (type === 'BANK') return <Landmark size={24} className="text-blue-600" />;
    return <PiggyBank size={24} className="text-indigo-600" />;
  };

  // Generate statement data
  const getStatement = (acc: BankAccount) => {
    const accTxs = transactions.filter(t => t.accountId === acc.id);
    const accTransfersOut = transfers.filter(t => t.fromAccountId === acc.id);
    const accTransfersIn = transfers.filter(t => t.toAccountId === acc.id);
    
    let items = [];
    
    accTxs.forEach(tx => {
      items.push({
        id: tx.id,
        dateBS: tx.dateBS,
        desc: `${tx.category} ${tx.notes ? `(${tx.notes})` : ''}`,
        inflow: (tx.type === 'INCOME' || tx.type === 'CAPITAL_INFLOW') ? tx.amount : 0,
        outflow: tx.type === 'EXPENSE' ? tx.amount : 0,
        ts: tx.createdAt || 0
      });
    });
    
    accTransfersOut.forEach(tr => {
      items.push({
        id: tr.id,
        dateBS: tr.dateBS,
        desc: `Transfer Out to ${accounts.find(a => a.id === tr.toAccountId)?.name || 'Unknown'} ${tr.reference ? `[${tr.reference}]` : ''}`,
        inflow: 0,
        outflow: tr.amount + tr.fee,
        ts: tr.createdAt || 0
      });
    });
    
    accTransfersIn.forEach(tr => {
      items.push({
        id: tr.id,
        dateBS: tr.dateBS,
        desc: `Transfer In from ${accounts.find(a => a.id === tr.fromAccountId)?.name || 'Unknown'} ${tr.reference ? `[${tr.reference}]` : ''}`,
        inflow: tr.amount,
        outflow: 0,
        ts: tr.createdAt || 0
      });
    });
    
    items.sort((a, b) => a.ts - b.ts); // Chronological
    
    let runBal = acc.initialBalance;
    items = items.map(item => {
      runBal = runBal + item.inflow - item.outflow;
      return { ...item, balance: runBal };
    });
    
    items.sort((a, b) => b.ts - a.ts); // Reverse Chrono for display
    
    const totalIn = items.reduce((s, i) => s + i.inflow, 0);
    const totalOut = items.reduce((s, i) => s + i.outflow, 0);
    
    return { items, totalIn, totalOut };
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-stone-800">{t.cashAndBank || 'Cash & Bank'}</h1>
        <div className="flex space-x-3">
          <button 
            onClick={() => { setTransferForm(initialTransferForm); setIsTransferModalOpen(true); }}
            className="flex items-center space-x-2 px-4 py-2 bg-stone-100 text-stone-700 rounded-xl hover:bg-stone-200 transition-colors border border-stone-200"
          >
            <ArrowRightLeft size={18} />
            <span className="font-medium">{t.transferFunds || 'Internal Transfer'}</span>
          </button>
          <button 
            onClick={() => { setAccountForm(initialAccountForm); setEditingId(null); setIsAccountModalOpen(true); }}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
          >
            <Plus size={18} />
            <span className="font-medium">{t.addAccount || 'Add Account'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Primary Card: Remaining Cash & Bank (Total Investment - Total Expense) */}
        <div className="bg-gradient-to-br from-emerald-800 to-teal-900 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-emerald-100 font-bold text-sm block">
                {language === 'ne' ? 'कुल मौज्दात (Cash & Bank)' : 'Cash & Bank Balance'}
              </span>
              <span className="text-[11px] text-emerald-200/80 font-medium">
                {language === 'ne' ? 'कुल लगानी - कुल खर्च' : 'Total Investment - Total Expense'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Wallet size={20} className="text-emerald-100" />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white">
              Rs. {remainingCashBank.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-200/90 mt-1 font-medium truncate" title={`Rs. ${totalInvestment.toLocaleString()} - Rs. ${totalExpense.toLocaleString()}`}>
              {language === 'ne' 
                ? `रु. ${totalInvestment.toLocaleString()} - रु. ${totalExpense.toLocaleString()}`
                : `Rs. ${totalInvestment.toLocaleString()} - Rs. ${totalExpense.toLocaleString()}`}
            </div>
          </div>
        </div>

        {/* Card 2: Total Investment */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-stone-500 font-semibold text-sm block">
                {t.totalInvestment || 'Total Investment'}
              </span>
              <span className="text-[11px] text-stone-400 font-medium">
                {language === 'ne' ? 'साझेदार तथा लगानीकर्ता' : 'From Partners & Investors'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
              <Briefcase size={20} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-stone-900">
              Rs. {totalInvestment.toLocaleString()}
            </div>
            <div className="text-[11px] text-stone-500 mt-1 font-medium">
              {partners.length} {language === 'ne' ? 'साझेदारहरू' : 'Partners'}
            </div>
          </div>
        </div>

        {/* Card 3: Total Expense */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-stone-500 font-semibold text-sm block">
                {t.totalExpense || 'Total Expense'}
              </span>
              <span className="text-[11px] text-stone-400 font-medium">
                {language === 'ne' ? 'फर्म सञ्चालन तथा खरिद खर्च' : 'All Recorded Expenses'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
              <TrendingDown size={20} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-rose-600">
              Rs. {totalExpense.toLocaleString()}
            </div>
            <div className="text-[11px] text-stone-500 mt-1 font-medium">
              {transactions.filter(t => t.type === 'EXPENSE').length} {language === 'ne' ? 'खर्च कारोबारहरू' : 'Recorded expenses'}
            </div>
          </div>
        </div>

        {/* Card 4: Allocated Bank & Cash Accounts */}
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-3">
            <div>
              <span className="text-stone-500 font-semibold text-sm block">
                {language === 'ne' ? 'खाता मौज्दात' : 'Account Balances'}
              </span>
              <span className="text-[11px] text-stone-400 font-medium">
                {language === 'ne' ? 'नगद र बैंक खाताहरू' : 'Cash in hand & Bank'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <Landmark size={20} />
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-bold text-stone-900">
              Rs. {totalLiquidity.toLocaleString()}
            </div>
            <div className="text-[11px] text-stone-500 mt-1 font-medium">
              Cash: Rs. {totalCash.toLocaleString()} | Bank: Rs. {totalBank.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold text-stone-800">{t.accounts || 'Accounts'}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acc => (
          <div 
            key={acc.id} 
            onClick={() => setStatementAccount(acc)}
            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md hover:border-green-300 transition-all cursor-pointer relative group"
          >
            <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={(e) => openEditAccount(acc, e)} className="p-1.5 bg-stone-100 text-stone-600 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
              <button onClick={(e) => handleDeleteClick(acc.id, e)} className="p-1.5 bg-stone-100 text-stone-600 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
            </div>
            
            <div className="flex items-center space-x-4 mb-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center
                ${acc.type === 'CASH' ? 'bg-green-100' : acc.type === 'BANK' ? 'bg-blue-100' : 'bg-indigo-100'}
              `}>
                {getAccountIcon(acc.type)}
              </div>
              <div>
                <h3 className="font-bold text-stone-900 text-lg">{acc.name}</h3>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                  ${acc.type === 'CASH' ? 'bg-green-50 text-green-700' : acc.type === 'BANK' ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}
                `}>
                  {acc.type}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-sm text-stone-600 mb-6 min-h-[40px]">
              {acc.bankName && <p>{acc.bankName}</p>}
              {acc.accountNumber && <p className="font-mono text-xs">{acc.accountNumber}</p>}
            </div>

            <div className="pt-4 border-t border-stone-100 flex justify-between items-end">
              <div>
                <p className="text-xs text-stone-500 font-medium mb-1">{t.currentBalance || 'Current Balance'}</p>
                <p className="font-bold text-2xl text-stone-900">
                  Rs. {acc.currentBalance.toLocaleString()}
                </p>
              </div>
              <div className="text-stone-300 group-hover:text-green-600 transition-colors">
                 <FileText size={20} />
              </div>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="col-span-full py-12 text-center text-stone-500 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            {t.noAccounts || 'No accounts registered.'}
          </div>
        )}
      </div>

      {/* Account Statement Modal */}
      {statementAccount && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
           <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh]  shadow-xl flex flex-col">
              <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50">
                <div>
                  <h2 className="text-xl font-bold text-stone-800">{statementAccount.name} - {t.statement || 'Account Statement'}</h2>
                  <p className="text-sm text-stone-500 font-mono mt-1">
                    {statementAccount.bankName ? `${statementAccount.bankName} | ` : ''} 
                    {statementAccount.accountNumber ? `${statementAccount.accountNumber}` : statementAccount.type}
                  </p>
                </div>
                <button onClick={() => setStatementAccount(null)} className="text-stone-400 hover:text-stone-600 p-2 bg-white rounded-xl shadow-sm"><X size={20} /></button>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                   <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                     <p className="text-xs text-stone-500 font-medium mb-1">{t.initialBalance || 'Opening Balance'}</p>
                     <p className="font-bold text-stone-900 text-lg">Rs. {statementAccount.initialBalance.toLocaleString()}</p>
                   </div>
                   <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                     <p className="text-xs text-green-700 font-medium mb-1">{t.inflow || 'Total Inflow'}</p>
                     <p className="font-bold text-green-700 text-lg flex items-center space-x-1">
                       <ArrowDownRight size={16} />
                       <span>Rs. {getStatement(statementAccount).totalIn.toLocaleString()}</span>
                     </p>
                   </div>
                   <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                     <p className="text-xs text-red-700 font-medium mb-1">{t.outflow || 'Total Outflow'}</p>
                     <p className="font-bold text-red-700 text-lg flex items-center space-x-1">
                       <ArrowUpRight size={16} />
                       <span>Rs. {getStatement(statementAccount).totalOut.toLocaleString()}</span>
                     </p>
                   </div>
                </div>

                <div className="border border-stone-200 rounded-xl ">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="bg-stone-100 text-stone-600 font-medium">
                        <th className="p-3 border-b border-stone-200">{t.dateBS || 'Date'}</th>
                        <th className="p-3 border-b border-stone-200">Description</th>
                        <th className="p-3 border-b border-stone-200 text-right text-green-700">{t.inflow || 'Inflow'} (+)</th>
                        <th className="p-3 border-b border-stone-200 text-right text-red-700">{t.outflow || 'Outflow'} (-)</th>
                        <th className="p-3 border-b border-stone-200 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getStatement(statementAccount).items.map((item, idx) => (
                        <tr key={idx} className="border-b border-stone-100 hover:bg-stone-50">
                          <td className="p-3 whitespace-nowrap text-stone-500">{item.dateBS}</td>
                          <td className="p-3 text-stone-800">{item.desc}</td>
                          <td className="p-3 text-right font-medium text-green-600">
                            {item.inflow > 0 ? item.inflow.toLocaleString() : '-'}
                          </td>
                          <td className="p-3 text-right font-medium text-red-600">
                            {item.outflow > 0 ? item.outflow.toLocaleString() : '-'}
                          </td>
                          <td className="p-3 text-right font-bold text-stone-900">
                            {item.balance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {getStatement(statementAccount).items.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-stone-500">No transactions recorded.</td>
                        </tr>
                      )}
                      <tr className="bg-stone-50 font-bold border-t border-stone-200">
                        <td className="p-3 text-stone-600" colSpan={2}>Opening Balance</td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3 text-right text-stone-900">{statementAccount.initialBalance.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* Account Edit/Add Modal */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md  shadow-xl">
             <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-800">{editingId ? (t.edit || 'Edit') : (t.addAccount || 'Add Account')}</h2>
              <button onClick={() => setIsAccountModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveAccount} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.accountType || 'Account Type'}</label>
                <div className="grid grid-cols-3 gap-3">
                  <button type="button" onClick={() => setAccountForm({...accountForm, type: 'CASH'})} className={`py-2 text-sm rounded-xl font-medium border transition-colors ${accountForm.type === 'CASH' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{t.cash || 'Cash'}</button>
                  <button type="button" onClick={() => setAccountForm({...accountForm, type: 'BANK'})} className={`py-2 text-sm rounded-xl font-medium border transition-colors ${accountForm.type === 'BANK' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Bank</button>
                  <button type="button" onClick={() => setAccountForm({...accountForm, type: 'WALLET'})} className={`py-2 text-sm rounded-xl font-medium border transition-colors ${accountForm.type === 'WALLET' ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>Wallet</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.accountName || 'Account Name'}</label>
                <input type="text" required value={accountForm.name} onChange={e => setAccountForm({...accountForm, name: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" placeholder="e.g. Main Cash Box" />
              </div>
              
              {accountForm.type !== 'CASH' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.bankName || 'Bank / Branch'}</label>
                    <input type="text" value={accountForm.bankName} onChange={e => setAccountForm({...accountForm, bankName: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.accountNumber || 'Account No'}</label>
                    <input type="text" value={accountForm.accountNumber} onChange={e => setAccountForm({...accountForm, accountNumber: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.initialBalance || 'Initial Balance'} (Rs.)</label>
                <input type="number" disabled={!!editingId} required value={accountForm.initialBalance} onChange={e => setAccountForm({...accountForm, initialBalance: Number(e.target.value)})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500 disabled:bg-stone-100" />
                {!!editingId && <p className="text-xs text-stone-500 mt-1">Initial balance cannot be changed after creation.</p>}
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsAccountModalOpen(false)} className="px-5 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl">{t.cancel}</button>
                <button type="submit" className="flex items-center space-x-2 px-5 py-2 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl"><Save size={18} /><span>{t.saveEntry || 'Save'}</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Internal Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md  shadow-xl">
             <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-800">{t.transferFunds || 'Internal Transfer'}</h2>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveTransfer} className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.fromAccount || 'From Account'}</label>
                  <select required value={transferForm.fromAccountId} onChange={e => setTransferForm({...transferForm, fromAccountId: e.target.value})} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500">
                    <option value="">{t.selectAccount || '-- Select Account --'}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Bal: Rs.{a.currentBalance})</option>)}
                  </select>
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <div className="bg-white p-1 rounded-full border border-stone-200 text-stone-400">
                    <ArrowRightLeft size={16} className="rotate-90" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.toAccount || 'To Account'}</label>
                  <select required value={transferForm.toAccountId} onChange={e => setTransferForm({...transferForm, toAccountId: e.target.value})} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500">
                    <option value="">{t.selectAccount || '-- Select Account --'}</option>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name} (Bal: Rs.{a.currentBalance})</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.transferAmount || 'Amount'} (Rs.)</label>
                  <input type="number" required value={transferForm.amount} onChange={e => setTransferForm({...transferForm, amount: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.transferFee || 'Fee'} (Rs.)</label>
                  <input type="number" required value={transferForm.fee} onChange={e => setTransferForm({...transferForm, fee: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.dateBS || 'Date'}</label>
                  <NepaliDatePicker value={transferForm.dateBS} onChange={(val) => setTransferForm({...transferForm, dateBS: val})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.referenceNo || 'Ref No.'}</label>
                  <input type="text" value={transferForm.reference} onChange={e => setTransferForm({...transferForm, reference: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.notes || 'Notes'}</label>
                <input type="text" value={transferForm.notes} onChange={e => setTransferForm({...transferForm, notes: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsTransferModalOpen(false)} className="px-5 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl">{t.cancel}</button>
                <button type="submit" className="flex items-center space-x-2 px-5 py-2 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl"><Save size={18} /><span>{t.transferFunds || 'Transfer'}</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
