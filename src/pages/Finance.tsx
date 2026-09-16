import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { collection, onSnapshot, query, where, orderBy, doc, deleteDoc, getDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Partner, Party, BankAccount } from '../types';
import { PieChart, TrendingUp, TrendingDown, DollarSign, Download, Printer, Eye, Edit2, Trash2, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { translations } from '../lib/translations';

export default function Finance() {
  const { farmId, language } = useAppStore();
  const t = translations[language];
  const navigate = useNavigate();
  const [previewTx, setPreviewTx] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'CAPITAL_INFLOW'>('ALL');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (!farmId) return;
    const unsubTxs = onSnapshot(query(collection(db, 'transactions'), where('farmId', '==', farmId)), snap => {
      const data: Transaction[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Transaction));
      
      // Sort by dateBS descending
      data.sort((a, b) => b.dateBS.localeCompare(a.dateBS));
      setTransactions(data);
    });
    
    const unsubPartners = onSnapshot(query(collection(db, 'partners'), where('farmId', '==', farmId)), snap => {
      const data: Partner[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Partner));
      setPartners(data);
    });

    const unsubParties = onSnapshot(query(collection(db, 'parties'), where('farmId', '==', farmId)), snap => {
      const data: Party[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Party));
      setParties(data);
    });

    const unsubAccounts = onSnapshot(query(collection(db, 'bankAccounts'), where('farmId', '==', farmId)), snap => {
      const data: BankAccount[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as BankAccount));
      setAccounts(data);
    });

    return () => { unsubTxs(); unsubPartners(); unsubParties(); unsubAccounts(); };
  }, [farmId]);

  const totalIncome = transactions.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + tx.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const totalCapital = partners.reduce((sum, p) => sum + p.investmentAmount, 0);

  const getPartyName = (id?: string) => parties.find(p => p.id === id)?.name || '-';
  const getAccountName = (id?: string, method?: string) => {
    const acc = accounts.find(a => a.id === id);
    if (acc) return acc.name;
    if (method) return method;
    return '-';
  };

  const handleExportCSV = () => {
    let csv = "S.N.,Date,Type,Sub Category,Party/Partner,Payment Account,Amount,Notes\n";
    transactions.forEach((tx, idx) => {
      const subCat = tx.subCategory || tx.category;
      const party = getPartyName(tx.partyId);
      const acc = getAccountName(tx.accountId, tx.paymentMethod);
      csv += `${idx + 1},${tx.dateBS},${tx.type},"${subCat}","${party}","${acc}",${tx.amount},"${(tx.notes || '').replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Farm_Ledger_${new Date().getTime()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const handleEdit = (tx: Transaction) => {
    navigate('/transactions', { state: { editTransaction: tx } });
  };

  const handleDelete = async (tx: Transaction) => {
    if (!window.confirm("Are you sure you want to delete this transaction? This will automatically reverse the linked bank/cash account balance.")) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(db, 'transactions', tx.id);
        const txDoc = await transaction.get(txRef);
        if (!txDoc.exists()) throw "Transaction does not exist!";

        if (tx.accountId) {
          const accountRef = doc(db, 'bankAccounts', tx.accountId);
          const accountDoc = await transaction.get(accountRef);
          if (accountDoc.exists()) {
            const accData = accountDoc.data();
            let newBalance = accData.balance;
            if (tx.type === 'INCOME') newBalance -= tx.amount;
            else if (tx.type === 'EXPENSE') newBalance += tx.amount;
            transaction.update(accountRef, { balance: newBalance });
          }
        }
        transaction.delete(txRef);
      });
      // Optionally show toast
    } catch (err) {
      console.error("Delete failed: ", err);
      alert('Failed to delete transaction.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-2">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-stone-800">{t.finance}</h1>
        <div className="flex space-x-2">
          <button onClick={handleExportCSV} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
            <Download size={18} />
            <span>{language === 'ne' ? 'एक्सेल/CSV डाउनलोड' : 'Export CSV'}</span>
          </button>
          <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors">
            <Printer size={18} />
            <span>{language === 'ne' ? 'प्रिन्ट / PDF' : 'Print / PDF'}</span>
          </button>
        </div>
      </div>
      
      {/* Print-only Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold text-stone-900">AgriFarm Management System</h1>
        <h2 className="text-xl font-semibold text-stone-700 mt-1">Financial Report & Ledger</h2>
        <p className="text-stone-500 mt-1">Generated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4 print:gap-4">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><DollarSign size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.totalCapital}</h3>
          </div>
          <p className="text-2xl font-bold text-stone-800">Rs. {totalCapital.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><TrendingUp size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.totalIncome}</h3>
          </div>
          <p className="text-2xl font-bold text-stone-800">Rs. {totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-lg"><TrendingDown size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.totalExpense}</h3>
          </div>
          <p className="text-2xl font-bold text-stone-800">Rs. {totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}><PieChart size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.netProfit}</h3>
          </div>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Rs. {netProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm print:shadow-none print:border-stone-300 overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-6 border-b border-stone-100 bg-stone-50/50">
           <h2 className="text-lg font-bold text-stone-800">{language === 'ne' ? 'सबै कारोबार विवरण (Ledger)' : 'All Transactions Ledger'}</h2>
           <div className="flex space-x-2 mt-4 sm:mt-0 print:hidden overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
             <button onClick={() => setActiveTab('ALL')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'ALL' ? 'bg-stone-800 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}>{t.all || 'All'}</button>
             <button onClick={() => setActiveTab('INCOME')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'INCOME' ? 'bg-emerald-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}>{t.income || 'Income'}</button>
             <button onClick={() => setActiveTab('EXPENSE')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'EXPENSE' ? 'bg-rose-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}>{t.expense || 'Expense'}</button>
             <button onClick={() => setActiveTab('CAPITAL_INFLOW')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'CAPITAL_INFLOW' ? 'bg-indigo-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'}`}>{t.capitalInflow || 'Capital / Equity'}</button>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
                <th className="p-4 w-16">{t.sn}</th>
                <th className="p-4">{t.dateBS}</th>
                <th className="p-4">{t.type}</th>
                <th className="p-4">{language === 'ne' ? 'उप-वर्ग' : 'Sub-Category'}</th>
                <th className="p-4">{t.party}</th>
                <th className="p-4">{language === 'ne' ? 'खाता' : 'Account'}</th>
                <th className="p-4 text-right">{t.amount}</th>
                <th className="p-4 text-center print:hidden">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                 let runningBalance = 0;
                 const filteredTx = transactions.filter(tx => activeTab === 'ALL' ? true : tx.type === activeTab);
                 return filteredTx.map((tx, idx) => {
                   
                   return (
                    <tr key={tx.id || idx} className="border-b border-stone-100 hover:bg-stone-50 print:border-stone-200">
                      <td className="p-4 text-stone-600">{idx + 1}</td>
                      <td className="p-4 text-stone-600 whitespace-nowrap">{tx.dateBS}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded-full font-medium ${tx.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : tx.type === 'EXPENSE' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                          {tx.type === 'INCOME' ? t.income : tx.type === 'EXPENSE' ? t.expense : (t.capitalInflow || 'Capital')}
                        </span>
                      </td>
                      <td className="p-4 text-stone-800 font-medium">
                        {tx.subCategory || tx.category}
                      </td>
                      <td className="p-4 text-stone-600">{getPartyName(tx.partyId)}</td>
                      <td className="p-4 text-stone-600">
                        {getAccountName(tx.accountId, tx.paymentMethod)}
                      </td>
                      <td className={`p-4 text-right font-medium ${tx.type === 'INCOME' ? 'text-emerald-600' : tx.type === 'CAPITAL_INFLOW' ? 'text-indigo-600' : 'text-rose-600'}`}>
                        Rs. {tx.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-center print:hidden">
                        <div className="flex justify-center items-center space-x-2">
                          <button onClick={() => setPreviewTx(tx)} className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors" title="Preview Receipt">
                            <Eye size={16} />
                          </button>
                          <button onClick={() => handleEdit(tx)} className="text-stone-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Edit">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDelete(tx)} className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                   );
                 });
              })()}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-stone-500">{t.noData}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Partner Equity Section (Hidden on Print if preferred, but let's keep it) */}
      {/* Preview Modal */}
      {previewTx && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50 print:hidden">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative">
            <button onClick={() => setPreviewTx(null)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600">
              <X size={20} />
            </button>
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText size={24} />
              </div>
              <h2 className="text-xl font-bold text-stone-800">Transaction Receipt</h2>
              <p className="text-stone-500 text-sm">{previewTx.dateBS}</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between pb-3 border-b border-stone-100">
                <span className="text-stone-500">{t.type || 'Type'}</span>
                <span className={`font-medium ${previewTx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {previewTx.type === 'INCOME' ? t.income : t.expense}
                </span>
              </div>
              <div className="flex justify-between pb-3 border-b border-stone-100">
                <span className="text-stone-500">Category</span>
                <span className="font-medium text-stone-800">{previewTx.category} {previewTx.subCategory && `(${previewTx.subCategory})`}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-stone-100">
                <span className="text-stone-500">Amount</span>
                <span className="font-bold text-stone-900">Rs. {previewTx.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pb-3 border-b border-stone-100">
                <span className="text-stone-500">Payment Account</span>
                <span className="font-medium text-stone-800">{getAccountName(previewTx.accountId, previewTx.paymentMethod)}</span>
              </div>
              {previewTx.partyId && (
                <div className="flex justify-between pb-3 border-b border-stone-100">
                  <span className="text-stone-500">Party</span>
                  <span className="font-medium text-stone-800">{getPartyName(previewTx.partyId)}</span>
                </div>
              )}
              {previewTx.notes && (
                <div className="pt-2">
                  <span className="block text-stone-500 text-sm mb-1">Remarks/Notes</span>
                  <p className="text-stone-800 bg-stone-50 p-3 rounded-xl text-sm">{previewTx.notes}</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 flex space-x-3">
              <button onClick={() => window.print()} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl transition-colors">
                Print
              </button>
              <button onClick={() => setPreviewTx(null)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 print:shadow-none print:border-stone-300">
        <h2 className="text-lg font-bold text-stone-800 mb-4">{t.partnerEquity}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {partners.map(p => {
            const allocatedProfit = netProfit > 0 ? (netProfit * (p.profitSharePercentage / 100)) : 0;
            const totalValue = p.investmentAmount + allocatedProfit;
            return (
              <div key={p.id} className="p-4 bg-stone-50 rounded-xl border border-stone-100 print:border-stone-200">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-stone-800">{p.name} <span className="text-sm font-normal text-stone-500">({p.profitSharePercentage}%)</span></span>
                  <span className="font-bold text-emerald-700">{t.value}: Rs. {totalValue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-stone-600">
                  <span>{t.baseCapital}: Rs. {p.investmentAmount.toLocaleString()}</span>
                  <span>{t.profitShare}: Rs. {allocatedProfit.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
          {partners.length === 0 && <p className="text-stone-500 text-center py-4">{t.noPartners}</p>}
        </div>
      </div>
    </div>
  );
}
