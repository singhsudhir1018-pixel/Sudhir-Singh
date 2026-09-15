import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Partner } from '../types';
import { PieChart, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import { translations } from '../lib/translations';

export default function Finance() {
  const { farmId, language } = useAppStore();
  const t = translations[language];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    if (!farmId) return;
    const unsubTxs = onSnapshot(query(collection(db, 'transactions'), where('farmId', '==', farmId)), snap => {
      const data: Transaction[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Transaction));
      setTransactions(data);
    });
    
    const unsubPartners = onSnapshot(query(collection(db, 'partners'), where('farmId', '==', farmId)), snap => {
      const data: Partner[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Partner));
      setPartners(data);
    });

    return () => { unsubTxs(); unsubPartners(); };
  }, [farmId]);

  const totalIncome = transactions.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = transactions.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + tx.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const totalCapital = partners.reduce((sum, p) => sum + p.investmentAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-stone-800">{t.finance}</h1>
        <button className="flex items-center space-x-2 px-4 py-2 bg-stone-800 text-white rounded-xl hover:bg-stone-900">
          <Download size={18} />
          <span>{t.exportReport}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><DollarSign size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.totalCapital}</h3>
          </div>
          <p className="text-2xl font-bold text-stone-800">Rs. {totalCapital.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-green-100 text-green-700 rounded-lg"><TrendingUp size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.totalIncome}</h3>
          </div>
          <p className="text-2xl font-bold text-stone-800">Rs. {totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-red-100 text-red-700 rounded-lg"><TrendingDown size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.totalExpense}</h3>
          </div>
          <p className="text-2xl font-bold text-stone-800">Rs. {totalExpense.toLocaleString()}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-2">
            <div className={`p-2 rounded-lg ${netProfit >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}><PieChart size={20} /></div>
            <h3 className="text-stone-500 font-medium">{t.netProfit}</h3>
          </div>
          <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>Rs. {netProfit.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-stone-800 mb-4">{t.partnerEquity}</h2>
          <div className="space-y-4">
            {partners.map(p => {
              const allocatedProfit = netProfit > 0 ? (netProfit * (p.profitSharePercentage / 100)) : 0;
              const totalValue = p.investmentAmount + allocatedProfit;
              return (
                <div key={p.id} className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-stone-800">{p.name} <span className="text-sm font-normal text-stone-500">({p.profitSharePercentage}%)</span></span>
                    <span className="font-bold text-green-700">{t.value}: Rs. {totalValue.toLocaleString()}</span>
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

        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-stone-800 mb-4">{t.recentLedger}</h2>
          <div className="space-y-3">
            {transactions.slice(0, 5).map(tx => (
              <div key={tx.id} className="flex justify-between items-center p-3 border-b border-stone-100">
                <div>
                  <p className="font-medium text-stone-800">{tx.category}</p>
                  <p className="text-xs text-stone-500">{tx.dateBS}</p>
                </div>
                <span className={`font-bold ${tx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'INCOME' ? '+' : '-'} Rs. {tx.amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
