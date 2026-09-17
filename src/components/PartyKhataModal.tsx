import React, { useState, useEffect } from 'react';
import { 
  X, 
  BookOpen, 
  Plus, 
  ArrowDownLeft, 
  ArrowUpRight, 
  CheckCircle2, 
  Landmark, 
  Calendar, 
  CreditCard,
  Printer,
  FileText,
  Loader2
} from 'lucide-react';
import { Party, Transaction, BankAccount } from '../types';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { collection, query, where, onSnapshot, runTransaction, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import NepaliDate from 'nepali-datetime';

interface Props {
  party: Party | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function PartyKhataModal({ party, isOpen, onClose }: Props) {
  const { farmId, language } = useAppStore();
  const t = translations[language];

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Settlement Form State
  const [showSettleForm, setShowSettleForm] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleDateBS, setSettleDateBS] = useState(new NepaliDate().format('YYYY MMMM DD'));
  const [settleAccountId, setSettleAccountId] = useState('');
  const [settlePaymentMethod, setSettlePaymentMethod] = useState('CASH');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!party || !farmId || !isOpen) return;

    setLoading(true);

    // Fetch transactions associated with this party
    const qTx = query(
      collection(db, 'transactions'),
      where('farmId', '==', farmId),
      where('partyId', '==', party.id)
    );

    const unsubTx = onSnapshot(
      qTx,
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as Transaction);
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setTransactions(list);
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
  }, [party, farmId, isOpen]);

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
          desc: language === 'ne' ? 'क्रेताले फर्मलाई तिर्नुपर्ने बाँकी रकम' : 'Amount customer owes to farm',
          suggestedAction: language === 'ne' ? 'रकम प्राप्त गर्नुहोस् (Receive Payment)' : 'Receive Payment',
        };
      } else if (pendingBal === 0) {
        return {
          badgeText: language === 'ne' ? 'हिसाब चुक्ता (Settled)' : 'Fully Settled',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
          desc: language === 'ne' ? 'कुनै पनि बाँकी हिसाब छैन' : 'No outstanding dues',
          suggestedAction: language === 'ne' ? 'नयाँ कारोबार' : 'Record Transaction',
        };
      } else {
        return {
          badgeText: `${language === 'ne' ? 'अग्रिम प्राप्त' : 'Advance Credit'}: Rs. ${Math.abs(pendingBal).toLocaleString()}`,
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
          desc: language === 'ne' ? 'क्रेताले अग्रिम जम्मा गरेको रकम' : 'Advance deposit with farm',
          suggestedAction: language === 'ne' ? 'हिसाब मिलान' : 'Adjust Khata',
        };
      }
    } else {
      // Supplier
      if (pendingBal > 0) {
        return {
          badgeText: `${language === 'ne' ? 'दिन बाँकी (You\'ll Give)' : "You'll Give"}: Rs. ${pendingBal.toLocaleString()}`,
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
          desc: language === 'ne' ? 'फर्मले आपूर्तिकर्तालाई तिर्नुपर्ने बाँकी रकम' : 'Amount farm owes to supplier',
          suggestedAction: language === 'ne' ? 'रकम भुक्तानी गर्नुहोस् (Pay Supplier)' : 'Pay Supplier',
        };
      } else if (pendingBal === 0) {
        return {
          badgeText: language === 'ne' ? 'हिसाब चुक्ता (Settled)' : 'Fully Settled',
          badgeClass: 'bg-stone-100 text-stone-700 border-stone-300',
          desc: language === 'ne' ? 'कुनै पनि बाँकी हिसाब छैन' : 'No outstanding dues',
          suggestedAction: language === 'ne' ? 'नयाँ खरिद' : 'Record Purchase',
        };
      } else {
        return {
          badgeText: `${language === 'ne' ? 'अग्रिम भुक्तान' : 'Advance Paid'}: Rs. ${Math.abs(pendingBal).toLocaleString()}`,
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          desc: language === 'ne' ? 'फर्मले अग्रिम दिएको रकम' : 'Advance paid to vendor',
          suggestedAction: language === 'ne' ? 'हिसाब मिलान' : 'Adjust Khata',
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

    try {
      await runTransaction(db, async (t) => {
        // 1. Reads first
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

        // 2. Compute state modifications
        const currentPending = Number(partyDoc.data().pendingBalance) || 0;
        let newPending = currentPending;

        // Transaction record details
        const txType = isBuyer ? 'INCOME' : 'EXPENSE';
        const txCategory = isBuyer 
          ? (language === 'ne' ? 'ग्राहक भुक्तानी प्राप्त / Khata Settlement' : 'Customer Payment Received')
          : (language === 'ne' ? 'आपूर्तिकर्ता भुक्तानी / Khata Settlement' : 'Supplier Bill Payment');

        if (isBuyer) {
          // Buyer pays us -> pending balance decreases
          newPending = currentPending - amountNum;
        } else {
          // We pay supplier -> pending balance decreases
          newPending = currentPending - amountNum;
        }

        // 3. Writes
        t.update(partyRef, { pendingBalance: newPending });

        // Update bank account balance if payment method is cash/bank/wallet
        if (accRef && accDoc && accDoc.exists()) {
          const curAccBal = Number(accDoc.data().currentBalance) || 0;
          const newAccBal = isBuyer 
            ? curAccBal + amountNum // Incoming money to farm
            : curAccBal - amountNum; // Outgoing money from farm
          t.update(accRef, { currentBalance: newAccBal });
        }

        // Create transaction entry
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
          createdAt: Date.now(),
        });
      });

      // Reset form
      setSettleAmount('');
      setSettleNotes('');
      setShowSettleForm(false);
    } catch (err: any) {
      console.error('Settlement transaction error:', err);
      setSubmitError(err.message || 'Failed to complete transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

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

          <button
            onClick={() => setShowSettleForm(prev => !prev)}
            className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-xl shadow-md transition-all active:scale-98 text-sm"
          >
            <CreditCard size={18} />
            <span>{showSettleForm ? (language === 'ne' ? 'फारम बन्द गर्नुहोस्' : 'Cancel Settlement') : (t.recordSettlement || 'Record Settlement')}</span>
          </button>
        </div>

        {/* Settlement Form (Collapsible) */}
        {showSettleForm && (
          <form onSubmit={handleSettleSubmit} className="p-5 sm:p-6 bg-emerald-50/50 border-b border-emerald-200 animate-in slide-in-from-top-3 duration-200">
            <h4 className="font-bold text-emerald-950 text-sm mb-4 flex items-center space-x-2">
              <Plus size={16} className="text-emerald-700" />
              <span>{isBuyer ? (language === 'ne' ? 'रकम प्राप्त गर्नुहोस् (Record Payment Received)' : 'Record Payment Received') : (language === 'ne' ? 'रकम भुक्तानी गर्नुहोस् (Pay Supplier)' : 'Record Payment to Supplier')}</span>
            </h4>

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
                <input
                  type="text"
                  value={settleDateBS}
                  onChange={(e) => setSettleDateBS(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
              {language === 'ne' ? 'यस पार्टीसँग कुनै पनि कारोबार भएको छैन।' : 'No transaction records found for this party.'}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-200">
              <table className="w-full text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="bg-stone-100 text-stone-600 font-semibold border-b border-stone-200">
                    <th className="p-3">S.N.</th>
                    <th className="p-3">{t.dateBS}</th>
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
                        <td className="p-3 text-stone-400">{idx + 1}</td>
                        <td className="p-3 text-stone-700 whitespace-nowrap">{tx.dateBS}</td>
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
