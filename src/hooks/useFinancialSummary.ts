import { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../store';
import { Party, BankAccount, Partner, Transaction } from '../types';

export interface FinancialSummaryData {
  toReceive: number;
  toPay: number;
  totalCashBankBalance: number;
  totalInvestment: number;
  totalExpense: number;
  accountLiquidity: number;
  totalCash: number;
  totalBank: number;
  totalWallet: number;
  buyerCount: number;
  supplierCount: number;
  accounts: BankAccount[];
  cashAccounts: BankAccount[];
  bankAccounts: BankAccount[];
  walletAccounts: BankAccount[];
  parties: Party[];
  loading: boolean;
  error: Error | null;
}

export function useFinancialSummary(overrideFarmId?: string): FinancialSummaryData {
  const storeFarmId = useAppStore(state => state.farmId);
  const farmId = overrideFarmId || storeFarmId;

  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!farmId) {
      setParties([]);
      setAccounts([]);
      setPartners([]);
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let partiesLoaded = false;
    let accountsLoaded = false;
    let partnersLoaded = false;
    let txLoaded = false;

    const checkComplete = () => {
      if (partiesLoaded && accountsLoaded && partnersLoaded && txLoaded) {
        setLoading(false);
      }
    };

    // Real-time listener for Parties
    const qParties = query(collection(db, 'parties'), where('farmId', '==', farmId));
    const unsubParties = onSnapshot(
      qParties,
      (snapshot) => {
        const pList: Party[] = [];
        snapshot.forEach((doc) => {
          pList.push({ id: doc.id, ...doc.data() } as Party);
        });
        setParties(pList);
        partiesLoaded = true;
        checkComplete();
      },
      (err) => {
        console.error('Error fetching parties summary:', err);
        setError(err);
        partiesLoaded = true;
        checkComplete();
      }
    );

    // Real-time listener for Bank & Cash Accounts
    const qAccounts = query(collection(db, 'bankAccounts'), where('farmId', '==', farmId));
    const unsubAccounts = onSnapshot(
      qAccounts,
      (snapshot) => {
        const aList: BankAccount[] = [];
        snapshot.forEach((doc) => {
          aList.push({ id: doc.id, ...doc.data() } as BankAccount);
        });
        setAccounts(aList);
        accountsLoaded = true;
        checkComplete();
      },
      (err) => {
        console.error('Error fetching accounts summary:', err);
        setError(err);
        accountsLoaded = true;
        checkComplete();
      }
    );

    // Real-time listener for Partners (Total Investment)
    const qPartners = query(collection(db, 'partners'), where('farmId', '==', farmId));
    const unsubPartners = onSnapshot(
      qPartners,
      (snapshot) => {
        const list: Partner[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Partner);
        });
        setPartners(list);
        partnersLoaded = true;
        checkComplete();
      },
      (err) => {
        console.error('Error fetching partners summary:', err);
        partnersLoaded = true;
        checkComplete();
      }
    );

    // Real-time listener for Transactions (Total Expense)
    const qTx = query(collection(db, 'transactions'), where('farmId', '==', farmId));
    const unsubTx = onSnapshot(
      qTx,
      (snapshot) => {
        const list: Transaction[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        setTransactions(list);
        txLoaded = true;
        checkComplete();
      },
      (err) => {
        console.error('Error fetching transactions summary:', err);
        txLoaded = true;
        checkComplete();
      }
    );

    return () => {
      unsubParties();
      unsubAccounts();
      unsubPartners();
      unsubTx();
    };
  }, [farmId]);

  // Aggregate Calculations
  let toReceive = 0;
  let toPay = 0;
  let buyerCount = 0;
  let supplierCount = 0;

  parties.forEach((p) => {
    const bal = Number(p.pendingBalance) || 0;
    if (p.type === 'BUYER') {
      if (bal > 0) {
        toReceive += bal;
        buyerCount++;
      } else if (bal < 0) {
        toPay += Math.abs(bal);
      }
    } else if (p.type === 'SUPPLIER') {
      if (bal > 0) {
        toPay += bal;
        supplierCount++;
      } else if (bal < 0) {
        toReceive += Math.abs(bal);
      }
    }
  });

  const activeAccounts = accounts.filter((a) => a.status !== 'INACTIVE');
  const bankAccounts = activeAccounts.filter((a) => a.type === 'BANK');
  const walletAccounts = activeAccounts.filter((a) => a.type === 'WALLET');

  // Real-time Total Investment and Total Expense
  const totalInvestment = partners.reduce((sum, p) => sum + (Number(p.investmentAmount) || 0), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // Cash & Bank balance: Total Investment - Total Expense
  const totalCashBankBalance = totalInvestment - totalExpense;

  // Tracked balances in Bank and Wallet accounts
  const totalBank = bankAccounts.reduce((sum, a) => sum + Math.max(0, Number(a.currentBalance) || 0), 0);
  const totalWallet = walletAccounts.reduce((sum, a) => sum + Math.max(0, Number(a.currentBalance) || 0), 0);

  // The true remaining Cash balance is the net liquid funds after bank and wallet holdings:
  // e.g., if Remaining Balance is 13,185 and bank/wallet are 0, Cash is 13,185.
  const totalCash = totalCashBankBalance - (totalBank + totalWallet);
  const accountLiquidity = totalCashBankBalance;

  // Map accounts so Cash accounts reflect the actual available cash balance rather than negative artifacts
  const displayAccounts = activeAccounts.map((a) => {
    if (a.type === 'CASH') {
      return {
        ...a,
        currentBalance: totalCash,
      };
    }
    return {
      ...a,
      currentBalance: Math.max(0, Number(a.currentBalance) || 0),
    };
  });

  const displayCashAccounts = displayAccounts.filter((a) => a.type === 'CASH');

  // Auto-heal negative cash accounts in Firestore so database documents remain clean
  const syncedRef = useRef<string>('');
  useEffect(() => {
    if (loading || !farmId || activeAccounts.length === 0) return;
    const negCashAcc = activeAccounts.find(a => a.type === 'CASH' && (Number(a.currentBalance) || 0) < 0);
    if (negCashAcc && syncedRef.current !== `${negCashAcc.id}_${totalCash}`) {
      syncedRef.current = `${negCashAcc.id}_${totalCash}`;
      updateDoc(doc(db, 'bankAccounts', negCashAcc.id), {
        currentBalance: totalCash
      }).catch(err => console.error("Auto-sync cash balance:", err));
    }
  }, [loading, farmId, activeAccounts, totalCash]);

  return {
    toReceive,
    toPay,
    totalCashBankBalance,
    totalInvestment,
    totalExpense,
    accountLiquidity,
    totalCash,
    totalBank,
    totalWallet,
    buyerCount,
    supplierCount,
    accounts: displayAccounts,
    cashAccounts: displayCashAccounts,
    bankAccounts,
    walletAccounts,
    parties,
    loading,
    error,
  };
}
