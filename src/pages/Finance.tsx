import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { collection, onSnapshot, query, where, doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, Partner, Party, BankAccount } from '../types';
import { PieChart, TrendingUp, TrendingDown, DollarSign, Download, Printer, Eye, Edit2, Trash2, FileText, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { translations } from '../lib/translations';
import { sortTransactionsDesc } from '../lib/nepaliDateHelper';
import NepaliDate from 'nepali-datetime';
import { useFarmProfile } from '../hooks/useFarmProfile';

type LedgerTransaction = Transaction & { isPartnerOpening?: boolean };

export default function Finance() {
  const { farmId, language } = useAppStore();
  const t = translations[language];
  const navigate = useNavigate();
  const farmProfile = useFarmProfile();
  const [previewTx, setPreviewTx] = useState<LedgerTransaction | null>(null);
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
      
      // Sort by dateBS descending (latest date first)
      data.sort(sortTransactionsDesc);
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

  const getPartyOrPartnerInfo = (tx: Transaction) => {
    if (tx.partyId) {
      const party = parties.find(p => p.id === tx.partyId);
      if (party) {
        return {
          name: party.name,
          badgeLabel: party.type === 'BUYER' ? (language === 'ne' ? 'क्रेता' : 'Buyer') : (language === 'ne' ? 'आपूर्तिकर्ता' : 'Supplier'),
          badgeColor: party.type === 'BUYER' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200',
          isPartner: false,
        };
      }
      const partner = partners.find(p => p.id === tx.partyId);
      if (partner) {
        return {
          name: partner.name,
          badgeLabel: language === 'ne' ? 'साझेदार' : 'Partner',
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          isPartner: true,
        };
      }
    }
    if (tx.type === 'CAPITAL_INFLOW' || tx.category?.toLowerCase().includes('partner') || tx.category?.toLowerCase().includes('capital')) {
      const matchedPartner = partners.find(p => tx.notes?.toLowerCase().includes(p.name.toLowerCase()));
      if (matchedPartner) {
        return {
          name: matchedPartner.name,
          badgeLabel: language === 'ne' ? 'साझेदार' : 'Partner',
          badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          isPartner: true,
        };
      }
    }
    if (tx.notes) {
      const matchedParty = parties.find(p => p.name && tx.notes?.toLowerCase().includes(p.name.toLowerCase()));
      if (matchedParty) {
        return {
          name: matchedParty.name,
          badgeLabel: matchedParty.type === 'BUYER' ? (language === 'ne' ? 'क्रेता' : 'Buyer') : (language === 'ne' ? 'आपूर्तिकर्ता' : 'Supplier'),
          badgeColor: matchedParty.type === 'BUYER' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-amber-50 text-amber-700 border-amber-200',
          isPartner: false,
        };
      }
    }
    return null;
  };

  const getPartyName = (id?: string) => {
    if (!id) return '-';
    const party = parties.find(p => p.id === id);
    if (party) return party.name;
    const partner = partners.find(p => p.id === id);
    if (partner) return partner.name;
    return '-';
  };

  const getAccountName = (id?: string, method?: string) => {
    const acc = accounts.find(a => a.id === id);
    if (acc) return acc.name;
    if (method) return method;
    return '-';
  };

  const todayBS = new NepaliDate().format('YYYY MMMM DD');

  // Reconcile Partner Investments so initial / unrecorded partner capital appears in Ledger & matches Total Capital
  const ledgerTransactions: LedgerTransaction[] = useMemo(() => {
    const recordedByPartnerId: Record<string, number> = {};
    let unmatchedCapitalInflow = 0;

    transactions.forEach(tx => {
      if (tx.type !== 'CAPITAL_INFLOW') return;
      const amt = Number(tx.amount) || 0;
      let matchedPartner = tx.partyId ? partners.find(p => p.id === tx.partyId) : undefined;
      if (!matchedPartner && tx.notes) {
        matchedPartner = partners.find(
          p => p.name && tx.notes!.toLowerCase().includes(p.name.toLowerCase())
        );
      }
      if (matchedPartner) {
        recordedByPartnerId[matchedPartner.id] = (recordedByPartnerId[matchedPartner.id] || 0) + amt;
      } else {
        unmatchedCapitalInflow += amt;
      }
    });

    const openingEntries: LedgerTransaction[] = [];
    let remainingUnmatched = unmatchedCapitalInflow;

    partners.forEach(p => {
      const totalInv = Number(p.investmentAmount) || 0;
      const recorded = recordedByPartnerId[p.id] || 0;
      let missing = totalInv - recorded;
      if (missing > 0 && remainingUnmatched > 0) {
        const deduct = Math.min(missing, remainingUnmatched);
        missing -= deduct;
        remainingUnmatched -= deduct;
      }
      if (missing > 0) {
        openingEntries.push({
          id: `partner-initial-${p.id}`,
          farmId: p.farmId,
          type: 'CAPITAL_INFLOW',
          amount: missing,
          category: 'Partner Capital',
          subCategory: language === 'ne' ? 'सुरुवाती साझेदार पूँजी' : 'Initial Partner Capital',
          partyId: p.id,
          accountId: '',
          paymentMethod: language === 'ne' ? 'साझेदार पूँजी' : 'Partner Capital',
          dateBS: p.joiningDateBS || todayBS,
          notes:
            language === 'ne'
              ? `${p.name} को सुरुवाती पूँजी लगानी`
              : `Initial Capital Investment by ${p.name}`,
          createdAt: 0,
          isPartnerOpening: true,
        });
      }
    });

    return [...transactions, ...openingEntries].sort(sortTransactionsDesc);
  }, [transactions, partners, language, todayBS]);

  const filteredTx = ledgerTransactions.filter(tx => activeTab === 'ALL' ? true : tx.type === activeTab);
  const filteredDebitTotal = filteredTx
    .filter(tx => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const filteredCreditTotal = filteredTx
    .filter(tx => tx.type === 'INCOME' || tx.type === 'CAPITAL_INFLOW')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const filteredAmountTotal = filteredTx.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const csvEscape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const handleExportCSV = () => {
    const isAllTab = activeTab === 'ALL';
    const headers = isAllTab
      ? language === 'ne'
        ? ['क्र.सं.', 'मिति (वि.सं.)', 'प्रकार', 'उप-वर्ग', 'पार्टी / साझेदार', 'खाता', 'डेबिट (खर्च)', 'क्रेडिट (आम्दानी/पूँजी)', 'कैफियत']
        : ['S.N.', 'Date (B.S.)', 'Type', 'Sub Category', 'Party/Partner', 'Payment Account', 'Debit (Dr.)', 'Credit (Cr.)', 'Notes']
      : language === 'ne'
        ? ['क्र.सं.', 'मिति (वि.सं.)', 'प्रकार', 'उप-वर्ग', 'पार्टी / साझेदार', 'खाता', 'रकम (रु.)', 'कैफियत']
        : ['S.N.', 'Date (B.S.)', 'Type', 'Sub Category', 'Party/Partner', 'Payment Account', 'Amount (Rs.)', 'Notes'];

    const rows: string[] = [headers.map(csvEscape).join(',')];

    filteredTx.forEach((tx, idx) => {
      const subCat = tx.subCategory || tx.category;
      const party = getPartyOrPartnerInfo(tx)?.name || getPartyName(tx.partyId);
      const acc = getAccountName(tx.accountId, tx.paymentMethod);
      const typeLabel =
        tx.type === 'INCOME'
          ? t.income || 'Income'
          : tx.type === 'EXPENSE'
          ? t.expense || 'Expense'
          : t.capitalInflow || 'Capital';

      if (isAllTab) {
        const debitVal = tx.type === 'EXPENSE' ? tx.amount : 0;
        const creditVal = tx.type === 'INCOME' || tx.type === 'CAPITAL_INFLOW' ? tx.amount : 0;
        rows.push(
          [
            idx + 1,
            tx.dateBS,
            typeLabel,
            subCat,
            party,
            acc,
            debitVal || '',
            creditVal || '',
            tx.notes || '',
          ]
            .map(csvEscape)
            .join(',')
        );
      } else {
        rows.push(
          [
            idx + 1,
            tx.dateBS,
            typeLabel,
            subCat,
            party,
            acc,
            tx.amount,
            tx.notes || '',
          ]
            .map(csvEscape)
            .join(',')
        );
      }
    });

    if (filteredTx.length > 0) {
      const totalLabel = language === 'ne' ? 'जम्मा रकम (Total)' : 'Total';
      if (isAllTab) {
        rows.push(['', '', '', '', '', totalLabel, filteredDebitTotal, filteredCreditTotal, ''].map(csvEscape).join(','));
      } else {
        rows.push(['', '', '', '', '', totalLabel, filteredAmountTotal, ''].map(csvEscape).join(','));
      }
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Farm_Ledger_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  const handleEdit = (tx: Transaction) => {
    navigate('/transactions', { state: { editTransaction: tx } });
  };

  const handleDelete = async (tx: Transaction) => {
    if (!window.confirm(language === 'ne' ? 'के तपाईं यो कारोबार मेटाउन चाहनुहुन्छ? यसले सम्बन्धित खाता र पार्टीको बाँकी रकम स्वतः सच्याउनेछ।' : 'Are you sure you want to delete this transaction? This will automatically reverse the linked account and party balance.')) return;
    
    try {
      await runTransaction(db, async (transaction) => {
        const txRef = doc(db, 'transactions', tx.id);
        const txDoc = await transaction.get(txRef);
        if (!txDoc.exists()) throw new Error('Transaction does not exist!');

        const txData = txDoc.data() as Transaction;
        let accountRef = null;
        let accountDoc = null;
        if (txData.accountId && txData.paymentMethod !== 'CREDIT') {
          accountRef = doc(db, 'bankAccounts', txData.accountId);
          accountDoc = await transaction.get(accountRef);
        }

        let partyRef = null;
        let partyDoc = null;
        if (txData.partyId) {
          partyRef = doc(db, 'parties', txData.partyId);
          partyDoc = await transaction.get(partyRef);
        }

        if (accountRef && accountDoc && accountDoc.exists()) {
          const accData = accountDoc.data();
          let newBalance = Number(accData.currentBalance ?? accData.balance ?? 0);
          if (txData.type === 'INCOME' || txData.type === 'CAPITAL_INFLOW') newBalance -= Number(txData.amount) || 0;
          else if (txData.type === 'EXPENSE') newBalance += Number(txData.amount) || 0;
          transaction.update(accountRef, { currentBalance: newBalance });
        }

        if (partyRef && partyDoc && partyDoc.exists()) {
          const amt = Number(txData.amount) || 0;
          const effect = txData.partyBalanceEffect;
          let delta = 0;
          if (effect === 'ADD_DUE') delta = amt;
          else if (effect === 'REDUCE_DUE') delta = -amt;
          else if (effect !== 'NONE') delta = txData.paymentMethod === 'CREDIT' ? amt : -amt;

          const curPending = Number(partyDoc.data().pendingBalance) || 0;
          transaction.update(partyRef, { pendingBalance: curPending - delta });
        }

        transaction.delete(txRef);
      });
    } catch (err) {
      console.error('Delete failed: ', err);
    }
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    if (farmProfile.name) {
      document.title = `${farmProfile.name} - ${language === 'ne' ? 'वित्तीय प्रतिवेदन' : 'Financial Report'}`;
    }
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 500);
  };

  const activeTabLabel =
    activeTab === 'ALL'
      ? language === 'ne'
        ? 'सबै कारोबार (Debit & Credit)'
        : 'All Transactions (Debit & Credit)'
      : activeTab === 'INCOME'
      ? t.income || 'Income'
      : activeTab === 'EXPENSE'
      ? t.expense || 'Expense'
      : t.capitalInflow || 'Capital / Equity';

  return (
    <div className="space-y-6 print:space-y-4">
      <div className={previewTx ? 'print:hidden space-y-6 print:space-y-4' : 'space-y-6 print:space-y-4'}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-stone-800">{t.finance}</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExportCSV} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors">
            <Download size={18} />
            <span>{language === 'ne' ? 'एक्सेल (Excel/CSV) डाउनलोड' : 'Export Excel / CSV'}</span>
          </button>
          <button onClick={handlePrint} className="flex items-center space-x-2 px-4 py-2 bg-stone-800 text-white rounded-xl hover:bg-stone-900 transition-colors">
            <Printer size={18} />
            <span>{language === 'ne' ? 'प्रिन्ट / PDF' : 'Print / PDF'}</span>
          </button>
        </div>
      </div>
      
      {/* Print-only Farm Letterhead Header */}
      <div className="hidden print:block mb-4 pb-3 border-b-2 border-stone-300">
        <div className="flex items-center justify-center gap-4 text-center">
          {farmProfile.logoUrl && (
            <img
              src={farmProfile.logoUrl}
              alt={farmProfile.name || 'Farm Logo'}
              className="w-14 h-14 object-contain rounded-lg border border-stone-200"
            />
          )}
          <div>
            {farmProfile.name && (
              <h1 className="text-2xl font-extrabold text-stone-900 tracking-tight">
                {farmProfile.name}
              </h1>
            )}
            {farmProfile.address && (
              <p className="text-sm font-semibold text-stone-700 mt-0.5">
                {farmProfile.address}
              </p>
            )}
            {(farmProfile.panNumber || farmProfile.regNumber || farmProfile.phone || farmProfile.email) && (
              <p className="text-xs text-stone-600 mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
                {farmProfile.panNumber && (
                  <span>
                    {language === 'ne' ? 'प्यान / भ्याट नं.' : 'PAN/VAT'}:{' '}
                    <strong>{farmProfile.panNumber}</strong>
                  </span>
                )}
                {farmProfile.regNumber && (
                  <span>
                    {language === 'ne' ? 'दर्ता नं.' : 'Reg. No.'}:{' '}
                    <strong>{farmProfile.regNumber}</strong>
                  </span>
                )}
                {farmProfile.phone && (
                  <span>
                    {language === 'ne' ? 'मोबाइल नं.' : 'Phone'}:{' '}
                    <strong>{farmProfile.phone}</strong>
                  </span>
                )}
                {farmProfile.email && (
                  <span>
                    {language === 'ne' ? 'इमेल' : 'Email'}:{' '}
                    <strong>{farmProfile.email}</strong>
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <div className="mt-2.5 pt-2 border-t border-stone-200 flex items-center justify-between text-xs text-stone-700">
          <span className="font-bold">
            {language === 'ne' ? 'वित्तीय प्रतिवेदन तथा कारोबार विवरण' : 'Financial Report & Ledger'} — {activeTabLabel}
          </span>
          <span>
            {language === 'ne' ? `मिति (वि.सं.): ${todayBS}` : `Date (B.S.): ${todayBS}`}
          </span>
        </div>
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
          <table className="w-full text-left border-collapse [&_th]:border [&_th]:border-stone-200 [&_td]:border [&_td]:border-stone-200">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
                <th className="px-2.5 py-3 w-px whitespace-nowrap">{t.sn}</th>
                <th className="px-2.5 py-3 w-px whitespace-nowrap">{t.dateBS}</th>
                <th className="p-4">{t.type}</th>
                <th className="p-4">{language === 'ne' ? 'उप-वर्ग' : 'Sub-Category'}</th>
                <th className="p-4">{t.partyOrPartner || 'Party / Partner'}</th>
                <th className="p-4">{language === 'ne' ? 'खाता' : 'Account'}</th>
                {activeTab === 'ALL' ? (
                  <>
                    <th className="p-4 text-right whitespace-nowrap text-rose-700">
                      {language === 'ne' ? 'डेबिट (खर्च)' : 'Debit (Dr.)'}
                    </th>
                    <th className="p-4 text-right whitespace-nowrap text-emerald-700">
                      {language === 'ne' ? 'क्रेडिट (आम्दानी/पूँजी)' : 'Credit (Cr.)'}
                    </th>
                  </>
                ) : (
                  <th className="p-4 text-right whitespace-nowrap">{t.amount}</th>
                )}
                <th className="p-4 text-center print:hidden">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTx.map((tx, idx) => {
                const isDebit = tx.type === 'EXPENSE';
                const isCredit = tx.type === 'INCOME' || tx.type === 'CAPITAL_INFLOW';
                return (
                  <tr key={tx.id || idx} className="border-b border-stone-100 hover:bg-stone-50 print:border-stone-200">
                    <td className="px-2.5 py-3 w-px whitespace-nowrap text-center text-stone-600 text-xs sm:text-sm tabular-nums">{idx + 1}</td>
                    <td className="px-2.5 py-3 w-px whitespace-nowrap text-stone-600 text-xs sm:text-sm tabular-nums">{tx.dateBS}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-medium ${tx.type === 'INCOME' ? 'bg-emerald-100 text-emerald-700' : tx.type === 'EXPENSE' ? 'bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'}`}>
                        {tx.type === 'INCOME' ? t.income : tx.type === 'EXPENSE' ? t.expense : (t.capitalInflow || 'Capital')}
                      </span>
                    </td>
                    <td className="p-4 text-stone-800 font-medium">
                      {tx.subCategory || tx.category}
                    </td>
                    <td className="p-4 text-stone-700">
                      {(() => {
                        const info = getPartyOrPartnerInfo(tx);
                        if (!info) return <span className="text-stone-400 font-normal">-</span>;
                        return (
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-stone-900">{info.name}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium whitespace-nowrap ${info.badgeColor}`}>
                              {info.badgeLabel}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-stone-600">
                      {getAccountName(tx.accountId, tx.paymentMethod)}
                    </td>
                    {activeTab === 'ALL' ? (
                      <>
                        <td className="p-4 text-right font-semibold tabular-nums whitespace-nowrap text-rose-600">
                          {isDebit ? `Rs. ${tx.amount.toLocaleString()}` : <span className="text-stone-300 font-normal">-</span>}
                        </td>
                        <td className={`p-4 text-right font-semibold tabular-nums whitespace-nowrap ${tx.type === 'CAPITAL_INFLOW' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                          {isCredit ? `Rs. ${tx.amount.toLocaleString()}` : <span className="text-stone-300 font-normal">-</span>}
                        </td>
                      </>
                    ) : (
                      <td className={`p-4 text-right font-medium tabular-nums whitespace-nowrap ${tx.type === 'INCOME' ? 'text-emerald-600' : tx.type === 'CAPITAL_INFLOW' ? 'text-indigo-600' : 'text-rose-600'}`}>
                        Rs. {tx.amount.toLocaleString()}
                      </td>
                    )}
                    <td className="p-4 text-center print:hidden">
                      <div className="flex justify-center items-center space-x-2">
                        <button onClick={() => setPreviewTx(tx)} className="text-stone-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-emerald-50 transition-colors" title="Preview Receipt">
                          <Eye size={16} />
                        </button>
                        {tx.isPartnerOpening ? (
                          <button
                            onClick={() => navigate('/parties')}
                            className="text-stone-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                            title={language === 'ne' ? 'साझेदार मेनुबाट सम्पादन गर्नुहोस्' : 'Manage in Parties'}
                          >
                            <Edit2 size={16} />
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleEdit(tx)} className="text-stone-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button onClick={() => handleDelete(tx)} className="text-stone-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors" title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredTx.length === 0 && (
                <tr>
                  <td colSpan={activeTab === 'ALL' ? 9 : 8} className="p-8 text-center text-stone-500">{t.noData}</td>
                </tr>
              )}
            </tbody>
            {filteredTx.length > 0 && (
              <tfoot>
                <tr className="bg-stone-100 font-bold text-stone-900 border-t-2 border-stone-300">
                  <td colSpan={6} className="p-4 text-right text-sm">
                    {language === 'ne' ? 'जम्मा रकम (Total)' : 'Total'}
                  </td>
                  {activeTab === 'ALL' ? (
                    <>
                      <td className="p-4 text-right text-rose-700 tabular-nums whitespace-nowrap">
                        Rs. {filteredDebitTotal.toLocaleString()}
                      </td>
                      <td className="p-4 text-right text-emerald-700 tabular-nums whitespace-nowrap">
                        Rs. {filteredCreditTotal.toLocaleString()}
                      </td>
                    </>
                  ) : (
                    <td className={`p-4 text-right tabular-nums whitespace-nowrap ${
                      activeTab === 'INCOME' ? 'text-emerald-700' : activeTab === 'EXPENSE' ? 'text-rose-700' : 'text-indigo-700'
                    }`}>
                      Rs. {filteredAmountTotal.toLocaleString()}
                    </td>
                  )}
                  <td className="p-4 print:hidden"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      
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

      {/* Preview Modal */}
      {previewTx && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50 print:static print:bg-white print:p-0 print:block">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl relative print:shadow-none print:border print:border-stone-300 print:mx-auto">
            <button onClick={() => setPreviewTx(null)} className="absolute top-4 right-4 text-stone-400 hover:text-stone-600 print:hidden">
              <X size={20} />
            </button>
            {/* Farm Letterhead on Receipt Print */}
            {(farmProfile.name || farmProfile.address || farmProfile.panNumber || farmProfile.phone) && (
              <div className="hidden print:block text-center pb-3 mb-4 border-b border-stone-300">
                {farmProfile.name && (
                  <h2 className="text-lg font-extrabold text-stone-900">{farmProfile.name}</h2>
                )}
                {farmProfile.address && (
                  <p className="text-xs font-medium text-stone-700">{farmProfile.address}</p>
                )}
                {(farmProfile.panNumber || farmProfile.phone) && (
                  <p className="text-[11px] text-stone-600 mt-0.5">
                    {farmProfile.panNumber ? `${language === 'ne' ? 'प्यान नं.' : 'PAN'}: ${farmProfile.panNumber}` : ''}
                    {farmProfile.panNumber && farmProfile.phone ? ' · ' : ''}
                    {farmProfile.phone ? `${language === 'ne' ? 'फोन' : 'Phone'}: ${farmProfile.phone}` : ''}
                  </p>
                )}
              </div>
            )}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 print:hidden">
                <FileText size={24} />
              </div>
              <h2 className="text-xl font-bold text-stone-800">
                {language === 'ne' ? 'कारोबार रसिद' : 'Transaction Receipt'}
              </h2>
              <p className="text-stone-500 text-sm">{previewTx.dateBS}</p>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between pb-3 border-b border-stone-100">
                <span className="text-stone-500">{t.type || 'Type'}</span>
                <span className={`font-medium ${previewTx.type === 'INCOME' ? 'text-emerald-600' : previewTx.type === 'CAPITAL_INFLOW' ? 'text-indigo-600' : 'text-rose-600'}`}>
                  {previewTx.type === 'INCOME' ? t.income : previewTx.type === 'CAPITAL_INFLOW' ? (t.capitalInflow || 'Capital') : t.expense}
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
              {(() => {
                const info = getPartyOrPartnerInfo(previewTx);
                if (!info && !previewTx.partyId) return null;
                return (
                  <div className="flex justify-between items-center pb-3 border-b border-stone-100">
                    <span className="text-stone-500">{t.partyOrPartner || 'Party / Partner'}</span>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-stone-900">{info ? info.name : getPartyName(previewTx.partyId)}</span>
                      {info && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${info.badgeColor}`}>
                          {info.badgeLabel}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
              {previewTx.notes && (
                <div className="pt-2">
                  <span className="block text-stone-500 text-sm mb-1">Remarks/Notes</span>
                  <p className="text-stone-800 bg-stone-50 p-3 rounded-xl text-sm">{previewTx.notes}</p>
                </div>
              )}
            </div>
            
            <div className="mt-8 flex space-x-3 print:hidden">
              <button onClick={() => window.print()} className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-xl transition-colors">
                {language === 'ne' ? 'प्रिन्ट / PDF' : 'Print'}
              </button>
              <button onClick={() => setPreviewTx(null)} className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors">
                {t.close || 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
