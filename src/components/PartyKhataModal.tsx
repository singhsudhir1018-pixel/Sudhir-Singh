import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Plus, 
  CheckCircle2, 
  CreditCard,
  Printer,
  Loader2,
  Link2,
  SlidersHorizontal,
  AlertCircle
} from 'lucide-react';
import { Party, Transaction, BankAccount } from '../types';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { collection, query, where, onSnapshot, runTransaction, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from './NepaliDatePicker';
import { sortTransactionsDesc } from '../lib/nepaliDateHelper';

interface Props {
  party: Party | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PartyKhataModal({ party, isOpen, onClose }: Props) {
  const { farmId, language } = useAppStore();
  const t = translations[language];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [unlinkedTxs, setUnlinkedTxs] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Panel State: 'NONE' | 'SETTLE' | 'RECONCILE'
  const [activePanel, setActivePanel] = useState<'NONE' | 'SETTLE' | 'RECONCILE'>('NONE');
  const [reconcileTab, setReconcileTab] = useState<'ADJUST' | 'LINK'>('ADJUST');

  // Settlement Form State
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDateBS, setSettleDateBS] = useState(new NepaliDate().format('YYYY MMMM DD'));
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState('CASH');
  const [settleNotes, setSettleNotes] = useState('');

  // Reconcile / Direct Balance Adjustment State
  const [adjustedBalance, setAdjustedBalance] = useState('0');
  const [linkSearch, setLinkSearch] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!party || !farmId || !isOpen) return;

    setLoading(true);
    setSubmitError(null);
    setSuccessMsg(null);
    setAdjustedBalance('0');

    // Fetch all farm transactions so we get both linked and unlinked candidate transactions
    const qTx = query(
      collection(db, 'transactions'),
      where('farmId', '==', farmId)
    );

    const unsubTx = onSnapshot(
      qTx,
      (snap) => {
        const linked: Transaction[] = [];
        const unlinked: Transaction[] = [];
        snap.forEach((d) => {
          const tx = { id: d.id, ...d.data() } as Transaction;
          if (tx.partyId === party.id) {
            linked.push(tx);
          } else if (!tx.partyId && tx.type !== 'CAPITAL_INFLOW') {
            unlinked.push(tx);
          }
        });
        linked.sort(sortTransactionsDesc);
        unlinked.sort(sortTransactionsDesc);
        setTransactions(linked);
        setUnlinkedTxs(unlinked);
        setLoading(false);
      },
      (err) => {
        console.warn('Error fetching party transactions:', err);
        setLoading(false);
      }
    );

    // Fetch cash & bank accounts for settlement
    const qAcc = query(
      collection(db, 'bankAccounts'),
      where('farmId', '==', farmId)
    );

    const unsubAcc = onSnapshot(qAcc, (snap) => {
      const aList: BankAccount[] = [];
      snap.forEach((d) => {
        const acc = { id: d.id, ...d.data() } as BankAccount;
        if (acc.status !== 'INACTIVE') aList.push(acc);
      });
      setAccounts(aList);
      if (aList.length > 0 && !settleAccountId) {
        setSettleAccountId(aList[0].id);
      }
    });

    return () => {
      unsubTx();
      unsubAcc();
    };
  }, [party?.id, farmId, isOpen]);

  if (!isOpen || !party) return null;

  const isBuyer = party.type === 'BUYER';
  const pendingBal = Number(party.pendingBalance) || 0;

  // Compute Khata status text & style
  const getStatusInfo = () => {
    if (isBuyer) {
      if (pendingBal > 0) {
        return {
          badgeText: `${language === 'ne' ? 'लिन बाँकी (You\'ll Get)' : "You'll Get"}: Rs. ${pendingBal.toLocaleString()}`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      } else if (pendingBal === 0) {
        return {
          badgeText: language === 'ne' ? 'हिसाब चुक्ता (Settled)' : 'Fully Settled',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
        };
      } else {
        return {
          badgeText: `${language === 'ne' ? 'अग्रिम प्राप्त' : 'Advance Credit'}: Rs. ${Math.abs(pendingBal).toLocaleString()}`,
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
        };
      }
    } else {
      if (pendingBal > 0) {
        return {
          badgeText: `${language === 'ne' ? 'दिन बाँकी (You\'ll Give)' : "You'll Give"}: Rs. ${pendingBal.toLocaleString()}`,
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        };
      } else if (pendingBal === 0) {
        return {
          badgeText: language === 'ne' ? 'हिसाब चुक्ता (Settled)' : 'Fully Settled',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
        };
      } else {
        return {
          badgeText: `${language === 'ne' ? 'अग्रिम भुक्तान' : 'Advance Paid'}: Rs. ${Math.abs(pendingBal).toLocaleString()}`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        };
      }
    }
  };

  const statusInfo = getStatusInfo();

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(settleAmount);
    if (!amountNum || amountNum <= 0) {
      setSubmitError(language === 'ne' ? 'कृपया मान्य रकम प्रविष्ट गर्नुहोस्' : 'Please enter a valid amount');
      return;
    }

    if (!farmId || !party) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);

    try {
      await runTransaction(db, async (t) => {
        const partyRef = doc(db, 'parties', party.id);
        const partyDoc = await t.get(partyRef);
        if (!partyDoc.exists()) {
          throw new Error('Party does not exist');
        }

        let accRef = null;
        let accDoc = null;
        if (settleAccountId && settlePaymentMethod !== 'CREDIT') {
          accRef = doc(db, 'bankAccounts', settleAccountId);
          accDoc = await t.get(accRef);
        }

        const currentPending = Number(partyDoc.data().pendingBalance) || 0;
        const newPending = currentPending - amountNum;

        const txType = isBuyer ? 'INCOME' : 'EXPENSE';
        const txCategory = isBuyer 
          ? (language === 'ne' ? 'ग्राहक भुक्तानी प्राप्त / Khata Settlement' : 'Customer Payment Received')
          : (language === 'ne' ? 'आपूर्तिकर्ता भुक्तानी / Khata Settlement' : 'Supplier Bill Payment');

        t.update(partyRef, { pendingBalance: newPending });

        if (accRef && accDoc && accDoc.exists()) {
          const curAccBal = Number(accDoc.data().currentBalance) || 0;
          const newAccBal = isBuyer 
            ? curAccBal + amountNum
            : curAccBal - amountNum;
          t.update(accRef, { currentBalance: newAccBal });
        }

        const newTxRef = doc(collection(db, 'transactions'));
        t.set(newTxRef, {
          farmId,
          type: txType,
          amount: amountNum,
          category: txCategory,
          subCategory: 'Khata Settlement',
          partyId: party.id,
          accountId: settleAccountId || null,
          paymentMethod: settlePaymentMethod,
          dateBS: settleDateBS,
          notes: settleNotes || (isBuyer ? 'Payment received from party' : 'Payment made to supplier'),
          partyBalanceEffect: 'REDUCE_DUE',
          createdAt: Date.now(),
        });
      });

      setSettleAmount('');
      setSettleNotes('');
      setActivePanel('NONE');
      setSuccessMsg(language === 'ne' ? 'भुक्तानी सफलतापूर्वक दर्ता गरियो।' : 'Payment recorded successfully.');
    } catch (err: any) {
      console.error('Settlement transaction error:', err);
      setSubmitError(err.message || 'Failed to complete transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mark as Paid / Adjust Pending Balance directly WITHOUT duplicating an expense
  const handleDirectBalanceAdjust = async (targetBalance: number) => {
    if (!party) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);
    try {
      await updateDoc(doc(db, 'parties', party.id), {
        pendingBalance: Number(targetBalance) || 0,
      });
      setActivePanel('NONE');
      setSuccessMsg(
        language === 'ne'
          ? 'बाँकी हिसाब सफलतापूर्वक अद्यावधिक गरियो (दोहोरो खर्च नजोडी)।'
          : 'Pending balance updated without creating duplicate expenses.'
      );
    } catch (err: any) {
      console.error('Failed to adjust balance:', err);
      setSubmitError(err.message || 'Failed to update balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Link an existing unlinked transaction from Transactions to this party and deduct from pendingBalance
  const handleLinkExistingTx = async (tx: Transaction) => {
    if (!party) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);

    try {
      await runTransaction(db, async (t) => {
        const partyRef = doc(db, 'parties', party.id);
        const partySnap = await t.get(partyRef);
        const txRef = doc(db, 'transactions', tx.id);
        const txSnap = await t.get(txRef);

        if (!partySnap.exists() || !txSnap.exists()) {
          throw new Error('Record not found');
        }
        if (txSnap.data().partyId) {
          throw new Error('Transaction is already linked to a party');
        }

        const currentPending = Number(partySnap.data().pendingBalance) || 0;
        const amt = Number(txSnap.data().amount) || 0;
        const effect = txSnap.data().paymentMethod === 'CREDIT' ? 'ADD_DUE' : 'REDUCE_DUE';
        const newPending = effect === 'ADD_DUE' ? currentPending + amt : currentPending - amt;

        t.update(partyRef, { pendingBalance: newPending });
        t.update(txRef, {
          partyId: party.id,
          partyBalanceEffect: effect,
        });
      });

      setActivePanel('NONE');
      setSuccessMsg(
        language === 'ne'
          ? 'कारोबार पार्टीसँग सफलतापूर्वक जोडियो र बाँकी रकम घटाइयो।'
          : 'Transaction linked to party and pending balance updated.'
      );
    } catch (err: any) {
      console.error('Failed to link transaction:', err);
      setSubmitError(err.message || 'Failed to link transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Candidate unlinked transactions (same expected direction first: EXPENSE for Supplier, INCOME for Buyer)
  const expectedType = isBuyer ? 'INCOME' : 'EXPENSE';
  const candidateUnlinked = unlinkedTxs
    .filter((tx) => tx.type === expectedType && tx.paymentMethod !== 'CREDIT')
    .filter((tx) => {
      if (!linkSearch.trim()) return true;
      const q = linkSearch.toLowerCase();
      return (
        (tx.category || '').toLowerCase().includes(q) ||
        (tx.subCategory || '').toLowerCase().includes(q) ||
        (tx.notes || '').toLowerCase().includes(q) ||
        String(tx.amount).includes(q) ||
        (tx.dateBS || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // Prioritize exact balance match or party name mention in notes
      const aMatch = (a.amount === Math.abs(pendingBal) ? 2 : 0) + (a.notes?.toLowerCase().includes(party.name.toLowerCase()) ? 1 : 0);
      const bMatch = (b.amount === Math.abs(pendingBal) ? 2 : 0) + (b.notes?.toLowerCase().includes(party.name.toLowerCase()) ? 1 : 0);
      if (bMatch !== aMatch) return bMatch - aMatch;
      return sortTransactionsDesc(a, b);
    });

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-stone-200 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 bg-stone-50/80 border-b border-stone-200 flex items-start justify-between">
          <div className="flex items-start space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-white shadow-xs ${
              isBuyer ? 'bg-gradient-to-br from-emerald-600 to-teal-700' : 'bg-gradient-to-br from-rose-600 to-red-700'
            }`}>
              {party.name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl font-extrabold text-stone-900">{party.name}</h3>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full uppercase ${
                  isBuyer ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isBuyer ? t.buyers : t.suppliers}
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {party.phone} {party.address ? `• ${party.address}` : ''} {party.panVat ? `• PAN: ${party.panVat}` : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => window.print()}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors"
              title="Print Khata"
            >
              <Printer size={18} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-xl transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Khata Hero Balance Banner */}
        <div className="p-5 sm:p-6 bg-stone-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-stone-800">
          <div>
            <span className="text-xs text-stone-400 uppercase tracking-wider font-semibold block">
              {language === 'ne' ? 'वर्तमान खाता स्थिति (Current Khata Status)' : 'Current Khata Status'}
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1">
              Rs. {Math.abs(pendingBal).toLocaleString()}
            </div>
            <div className="mt-2 inline-flex items-center space-x-2">
              <span className={`px-3 py-1 text-xs font-extrabold rounded-full border ${statusInfo.badgeClass}`}>
                {statusInfo.badgeText}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setSuccessMsg(null);
                setActivePanel(prev => prev === 'SETTLE' ? 'NONE' : 'SETTLE');
                if (pendingBal > 0 && !settleAmount) {
                  setSettleAmount(String(pendingBal));
                }
              }}
              className={`flex items-center justify-center space-x-2 px-4 py-2.5 font-bold rounded-xl shadow-md transition-all active:scale-98 text-xs sm:text-sm ${
                activePanel === 'SETTLE'
                  ? 'bg-stone-700 text-white'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950'
              }`}
            >
              <CreditCard size={16} />
              <span>
                {activePanel === 'SETTLE'
                  ? (language === 'ne' ? 'बन्द गर्नुहोस्' : 'Close Form')
                  : (t.recordSettlement || 'Record Settlement')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSubmitError(null);
                setSuccessMsg(null);
                setAdjustedBalance('0');
                setActivePanel(prev => prev === 'RECONCILE' ? 'NONE' : 'RECONCILE');
              }}
              className={`flex items-center justify-center space-x-2 px-4 py-2.5 font-semibold rounded-xl border transition-all active:scale-98 text-xs sm:text-sm ${
                activePanel === 'RECONCILE'
                  ? 'bg-amber-500 text-stone-950 border-amber-400'
                  : 'bg-stone-800 hover:bg-stone-700 text-stone-100 border-stone-700'
              }`}
            >
              <SlidersHorizontal size={16} />
              <span>
                {language === 'ne' ? 'पहिले नै तिरिसकेको? (हिसाब मिलान)' : 'Already Paid? (Reconcile)'}
              </span>
            </button>
          </div>
        </div>

        {/* Success Notice */}
        {successMsg && (
          <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-xl flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 font-bold ml-2">✕</button>
          </div>
        )}

        {/* PANEL 1: NEW SETTLEMENT FORM */}
        {activePanel === 'SETTLE' && (
          <form onSubmit={handleSettleSubmit} className="p-5 sm:p-6 bg-emerald-50/50 border-b border-emerald-200 animate-in slide-in-from-top-3 duration-200">
            <h4 className="font-bold text-emerald-950 text-sm mb-1 flex items-center space-x-2">
              <Plus size={16} className="text-emerald-700" />
              <span>{isBuyer ? (language === 'ne' ? 'रकम प्राप्त गर्नुहोस् (Record Payment Received)' : 'Record Payment Received') : (language === 'ne' ? 'नयाँ भुक्तानी दर्ता गर्नुहोस् (Pay Supplier)' : 'Record Payment to Supplier')}</span>
            </h4>
            <p className="text-[11px] text-emerald-800/80 mb-3">
              {language === 'ne'
                ? 'यसले नयाँ खर्च/आम्दानी कारोबार सिर्जना गरी नगद/बैंक र पार्टीको बाँकी रकम दुवै अद्यावधिक गर्छ।'
                : 'This records a new cash/bank transaction and reduces the party pending balance.'}
            </p>

            {submitError && (
              <div className="mb-4 p-3 bg-rose-100 border border-rose-200 text-rose-800 text-xs rounded-xl">
                {submitError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {t.amount} (Rs.) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder={pendingBal > 0 ? String(pendingBal) : '5000'}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {t.dateBS}
                </label>
                <NepaliDatePicker value={settleDateBS} onChange={(val) => setSettleDateBS(val)} />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {language === 'ne' ? 'जम्मा/भुक्तानी हुने खाता' : 'Cash / Bank Account'}
                </label>
                <select
                  value={settleAccountId}
                  onChange={(e) => setSettleAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) - Rs. {acc.currentBalance?.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {t.notes}
                </label>
                <input
                  type="text"
                  placeholder={isBuyer ? 'Cash received from buyer / Full settlement' : 'Payment for supplier invoices'}
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center space-x-2 text-sm disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>{language === 'ne' ? 'प्रशोधन हुँदै...' : 'Processing...'}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} />
                      <span>{language === 'ne' ? 'भुक्तानी दर्ता गर्नुहोस्' : 'Confirm Settlement'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* PANEL 2: ALREADY PAID / RECONCILE BALANCE */}
        {activePanel === 'RECONCILE' && (
          <div className="p-5 sm:p-6 bg-amber-50/60 border-b border-amber-200 animate-in slide-in-from-top-3 duration-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-start space-x-2">
                <AlertCircle size={18} className="text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950 text-sm">
                    {language === 'ne' ? 'पहिले नै तिरिसकेको हिसाब मिलान गर्नुहोस्' : 'Reconcile Already-Paid Balance'}
                  </h4>
                  <p className="text-[11px] text-amber-900/80">
                    {language === 'ne'
                      ? 'यदि तपाईंले कारोबारमा पहिले नै खर्च/भुक्तानी लेखिसक्नुभएको छ भने दोहोरो खर्च नबढाई यहाँबाट बाँकी रकम मिलाउनुहोस्।'
                      : 'Use this when payment was already recorded elsewhere so your cash & total expenses are not double-counted.'}
                  </p>
                </div>
              </div>
              <div className="flex bg-white p-1 rounded-xl border border-amber-200 shrink-0">
                <button
                  type="button"
                  onClick={() => setReconcileTab('ADJUST')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    reconcileTab === 'ADJUST' ? 'bg-amber-500 text-stone-950' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {language === 'ne' ? 'सीधै चुक्ता / सच्याउनुहोस्' : 'Adjust Balance'}
                </button>
                <button
                  type="button"
                  onClick={() => setReconcileTab('LINK')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    reconcileTab === 'LINK' ? 'bg-amber-500 text-stone-950' : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {language === 'ne' ? `कारोबार जोड्नुहोस् (${candidateUnlinked.length})` : `Link Tx (${candidateUnlinked.length})`}
                </button>
              </div>
            </div>

            {submitError && (
              <div className="p-3 bg-rose-100 border border-rose-200 text-rose-800 text-xs rounded-xl">
                {submitError}
              </div>
            )}

            {reconcileTab === 'ADJUST' ? (
              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {language === 'ne' ? 'नयाँ बाँकी रकम (Rs.) — पूर्ण चुक्ताका लागि 0 राख्नुहोस्' : 'New Pending Balance (Rs.) — Set 0 if fully paid'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={adjustedBalance}
                    onChange={(e) => setAdjustedBalance(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleDirectBalanceAdjust(parseFloat(adjustedBalance) || 0)}
                  className="px-4 py-2 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors disabled:opacity-50"
                >
                  {language === 'ne' ? 'बाँकी रकम सुरक्षित गर्नुहोस्' : 'Update Balance'}
                </button>
                {pendingBal !== 0 && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleDirectBalanceAdjust(0)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    <span>{language === 'ne' ? 'पूर्ण चुक्ता (Rs. 0)' : 'Mark Paid (Rs. 0)'}</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-white p-4 rounded-2xl border border-amber-200/80 space-y-3">
                <input
                  type="text"
                  placeholder={language === 'ne' ? 'कारोबार खोज्नुहोस् (रकम, शीर्षक वा कैफियत)...' : 'Search unlinked transactions by amount, category or notes...'}
                  value={linkSearch}
                  onChange={(e) => setLinkSearch(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <div className="max-h-44 overflow-y-auto divide-y divide-stone-100">
                  {candidateUnlinked.length === 0 ? (
                    <p className="text-xs text-stone-400 text-center py-4">
                      {language === 'ne' ? 'कुनै नजोडिएको कारोबार फेला परेन।' : 'No unlinked matching transactions found.'}
                    </p>
                  ) : (
                    candidateUnlinked.slice(0, 20).map((tx) => (
                      <div key={tx.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-stone-800 truncate">
                            {tx.subCategory || tx.category} — Rs. {tx.amount.toLocaleString()}
                          </div>
                          <div className="text-[11px] text-stone-500 truncate">
                            {tx.dateBS} • {tx.paymentMethod} {tx.notes ? `• ${tx.notes}` : ''}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleLinkExistingTx(tx)}
                          className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg flex items-center space-x-1 transition-colors disabled:opacity-50"
                        >
                          <Link2 size={13} />
                          <span>{language === 'ne' ? 'जोड्नुहोस्' : 'Link'}</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Khata Ledger Statements Table */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6">
          <h4 className="font-bold text-stone-800 text-sm mb-3 flex items-center justify-between">
            <span className="flex items-center space-x-2">
              <BookOpen size={16} className="text-stone-500" />
              <span>{language === 'ne' ? 'कारोबार इतिहास (Ledger Entries)' : 'Transaction History'}</span>
            </span>
            <span className="text-xs text-stone-500 font-normal">
              {transactions.length} {language === 'ne' ? 'रेकर्डहरू' : 'records found'}
            </span>
          </h4>

          {loading ? (
            <div className="py-12 flex justify-center items-center text-stone-400 space-x-2">
              <Loader2 className="animate-spin" size={24} />
              <span className="text-sm">{language === 'ne' ? 'खाता लोड हुँदैछ...' : 'Loading Khata records...'}</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-12 text-center text-stone-400 bg-stone-50 rounded-2xl border border-dashed border-stone-200 text-sm">
              {language === 'ne' ? 'यस पार्टीसँग कुनै पनि कारोबार जोडिएको छैन।' : 'No transaction records linked to this party yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full text-left text-xs sm:text-sm border-collapse [&_th]:border [&_th]:border-stone-200 [&_td]:border [&_td]:border-stone-200">
                <thead>
                  <tr className="bg-stone-100 text-stone-600 font-semibold border-b border-stone-200">
                    <th className="px-2 py-2.5 w-px whitespace-nowrap text-center">S.N.</th>
                    <th className="px-2.5 py-2.5 w-px whitespace-nowrap">{t.dateBS}</th>
                    <th className="p-3">{t.category}</th>
                    <th className="p-3">{t.paymentMethod}</th>
                    <th className="p-3 text-right">{t.amount}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-medium">
                  {transactions.map((tx, idx) => {
                    const isCredit = tx.paymentMethod === 'CREDIT';
                    const isInflow = tx.type === 'INCOME';
                    return (
                      <tr key={tx.id || idx} className="hover:bg-stone-50/80 transition-colors">
                        <td className="px-2 py-2.5 w-px whitespace-nowrap text-center text-stone-400">{idx + 1}</td>
                        <td className="px-2.5 py-2.5 w-px whitespace-nowrap text-stone-700">{tx.dateBS}</td>
                        <td className="p-3">
                          <div className="font-semibold text-stone-900">{tx.subCategory || tx.category}</div>
                          {tx.notes && <div className="text-[11px] text-stone-400 font-normal">{tx.notes}</div>}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            isCredit 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-stone-100 text-stone-700'
                          }`}>
                            {tx.paymentMethod}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-bold ${
                          isInflow ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          {isInflow ? '+ ' : '- '}Rs. {tx.amount.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-between items-center text-xs text-stone-500">
          <span>{party.name} • {isBuyer ? 'Customer Ledger' : 'Vendor Ledger'}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold rounded-xl transition-colors"
          >
            {t.cancel || 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
