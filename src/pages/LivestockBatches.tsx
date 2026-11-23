import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Batch, LivestockLog, LivestockSpecies, Party, Transaction, BankAccount } from '../types';
import { db } from '../lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  runTransaction,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from '../components/NepaliDatePicker';
import {
  Bird,
  Fish,
  Plus,
  Search,
  Edit2,
  Trash2,
  History,
  Skull,
  ShoppingBag,
  Layers,
  X,
  AlertCircle,
  TrendingUp,
  HeartPulse,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

type QuickEventType = 'MORTALITY' | 'ADDITION' | 'SALE';

interface SpeciesMeta {
  id: LivestockSpecies;
  labelEn: string;
  labelNe: string;
  defaultBatchEn: string;
  defaultBatchNe: string;
  colorClass: string;
}

export default function LivestockBatches() {
  const { language, farmId } = useAppStore();
  const t = translations[language];

  const SPECIES_LIST: SpeciesMeta[] = useMemo(
    () => [
      {
        id: 'CHICKEN',
        labelEn: t.speciesChicken || 'Chicks / Poultry',
        labelNe: 'चल्ला / कुखुरा',
        defaultBatchEn: 'Poultry Batch',
        defaultBatchNe: 'कुखुरा / चल्ला ब्याच',
        colorClass: 'bg-amber-50 text-amber-700 border-amber-200',
      },
      {
        id: 'DUCK',
        labelEn: t.speciesDuck || 'Ducks',
        labelNe: 'हाँस',
        defaultBatchEn: 'Duck Batch',
        defaultBatchNe: 'हाँस ब्याच',
        colorClass: 'bg-sky-50 text-sky-700 border-sky-200',
      },
      {
        id: 'GOAT',
        labelEn: t.speciesGoat || 'Goats',
        labelNe: 'बाख्रा',
        defaultBatchEn: 'Goat Batch',
        defaultBatchNe: 'बाख्रा ब्याच',
        colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      },
      {
        id: 'FISH',
        labelEn: t.speciesFish || 'Fish / Fingerlings',
        labelNe: 'माछा / भुरा',
        defaultBatchEn: 'Fish Pond Batch',
        defaultBatchNe: 'माछा पोखरी ब्याच',
        colorClass: 'bg-cyan-50 text-cyan-700 border-cyan-200',
      },
      {
        id: 'PIG',
        labelEn: t.speciesPig || 'Pigs',
        labelNe: 'सुँगुर',
        defaultBatchEn: 'Pig Batch',
        defaultBatchNe: 'सुँगुर ब्याच',
        colorClass: 'bg-rose-50 text-rose-700 border-rose-200',
      },
      {
        id: 'CATTLE',
        labelEn: t.speciesCattle || 'Cattle / Buffalo',
        labelNe: 'गाई / भैंसी',
        defaultBatchEn: 'Cattle Batch',
        defaultBatchNe: 'गाई / भैंसी ब्याच',
        colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      },
      {
        id: 'OTHER',
        labelEn: t.speciesOther || 'Other',
        labelNe: 'अन्य',
        defaultBatchEn: 'Livestock Batch',
        defaultBatchNe: 'पशुपन्छी ब्याच',
        colorClass: 'bg-stone-100 text-stone-700 border-stone-200',
      },
    ],
    [t]
  );

  // Data state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [logs, setLogs] = useState<LivestockLog[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [speciesFilter, setSpeciesFilter] = useState<LivestockSpecies | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Add/Edit Batch Modal
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [batchForm, setBatchForm] = useState({
    species: 'CHICKEN' as LivestockSpecies,
    batchName: '',
    supplierId: '',
    supplierName: '',
    startDateBS: new NepaliDate().format('YYYY MMMM DD'),
    initialCount: '',
    unitPrice: '',
    purchaseTotalCost: '',
    status: 'ACTIVE' as 'ACTIVE' | 'COMPLETED',
    notes: '',
    alsoRecordExpense: true,
    paymentMethod: 'CASH' as 'CASH' | 'BANK' | 'WALLET' | 'CREDIT',
  });
  const [batchError, setBatchError] = useState<string | null>(null);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Quick Event Modal (MORTALITY / ADDITION / SALE)
  const [eventTargetBatch, setEventTargetBatch] = useState<Batch | null>(null);
  const [eventType, setEventType] = useState<QuickEventType>('MORTALITY');
  const [eventForm, setEventForm] = useState({
    quantity: '',
    dateBS: new NepaliDate().format('YYYY MMMM DD'),
    partyId: '',
    partyName: '',
    amount: '',
    paymentMethod: 'CASH' as 'CASH' | 'BANK' | 'WALLET' | 'CREDIT',
    alsoRecordTransaction: true,
    notes: '',
  });
  const [eventError, setEventError] = useState<string | null>(null);
  const [isSavingEvent, setIsSavingEvent] = useState(false);

  // History / Ledger Modal
  const [historyBatch, setHistoryBatch] = useState<Batch | null>(null);
  const [revertingLogId, setRevertingLogId] = useState<string | null>(null);

  // Delete Batch Confirmation Modal
  const [deleteTargetBatch, setDeleteTargetBatch] = useState<Batch | null>(null);
  const [isDeletingBatch, setIsDeletingBatch] = useState(false);

  // Subscriptions
  useEffect(() => {
    if (!farmId) return;
    setLoading(true);

    const unsubBatches = onSnapshot(
      query(collection(db, 'batches'), where('farmId', '==', farmId)),
      (snap) => {
        const list: Batch[] = [];
        snap.forEach((d) => {
          const data = d.data() as Omit<Batch, 'id'>;
          if (data.type === 'LIVESTOCK' || data.type !== 'CROP') {
            list.push({ id: d.id, ...data } as Batch);
          }
        });
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setBatches(list);
        setLoading(false);
      },
      () => setLoading(false)
    );

    const unsubLogs = onSnapshot(
      query(collection(db, 'livestockLogs'), where('farmId', '==', farmId)),
      (snap) => {
        const list: LivestockLog[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as LivestockLog));
        list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLogs(list);
      }
    );

    const unsubParties = onSnapshot(
      query(collection(db, 'parties'), where('farmId', '==', farmId)),
      (snap) => {
        const list: Party[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Party));
        setParties(list);
      }
    );

    const unsubTxs = onSnapshot(
      query(collection(db, 'transactions'), where('farmId', '==', farmId)),
      (snap) => {
        const list: Transaction[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Transaction));
        setTransactions(list);
      }
    );

    const unsubAccounts = onSnapshot(
      query(collection(db, 'bankAccounts'), where('farmId', '==', farmId)),
      (snap) => {
        const list: BankAccount[] = [];
        snap.forEach((d) => list.push({ id: d.id, ...d.data() } as BankAccount));
        setAccounts(list);
      }
    );

    return () => {
      unsubBatches();
      unsubLogs();
      unsubParties();
      unsubTxs();
      unsubAccounts();
    };
  }, [farmId]);

  const suppliers = useMemo(() => parties.filter((p) => p.type === 'SUPPLIER'), [parties]);
  const buyers = useMemo(() => parties.filter((p) => p.type === 'BUYER'), [parties]);

  const getSpeciesMeta = (species?: LivestockSpecies): SpeciesMeta =>
    SPECIES_LIST.find((s) => s.id === species) || SPECIES_LIST[SPECIES_LIST.length - 1];

  const getSpeciesLabel = (species?: LivestockSpecies) => {
    const meta = getSpeciesMeta(species);
    return language === 'ne' ? meta.labelNe : meta.labelEn;
  };

  const getAliveCount = (b: Batch) => {
    const initial = Number(b.initialCount) || 0;
    const added = Number(b.addedCount) || 0;
    const dead = Number(b.deadCount) || 0;
    const sold = Number(b.soldCount) || 0;
    return Math.max(0, initial + added - dead - sold);
  };

  const getMortalityPercent = (b: Batch) => {
    const totalIn = (Number(b.initialCount) || 0) + (Number(b.addedCount) || 0);
    if (totalIn <= 0) return '0.0';
    return (((Number(b.deadCount) || 0) / totalIn) * 100).toFixed(1);
  };

  const getSupplierDisplay = (b: Batch) => {
    if (b.supplierId) {
      const found = parties.find((p) => p.id === b.supplierId);
      if (found) return found.name;
    }
    return b.supplierName || (language === 'ne' ? 'उल्लेख नभएको' : 'Not specified');
  };

  // Dynamic batch financials computed from linked transactions + unlinked purchaseTotalCost
  const getBatchFinancials = (b: Batch) => {
    const linkedTxs = transactions.filter((tx) => tx.batchId === b.id);
    const txExpense = linkedTxs
      .filter((tx) => tx.type === 'EXPENSE')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const txIncome = linkedTxs
      .filter((tx) => tx.type === 'INCOME')
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const hasPurchaseTx = linkedTxs.some(
      (tx) => tx.type === 'EXPENSE' && (tx.notes?.includes('[Batch Purchase]') || tx.category === 'Livestock Purchase')
    );

    const totalExpense = hasPurchaseTx
      ? txExpense
      : (Number(b.purchaseTotalCost) || Number(b.totalExpense) || 0) + txExpense;

    const totalIncome = txIncome > 0 ? txIncome : Number(b.totalIncome) || 0;

    return {
      totalExpense,
      totalIncome,
      netProfit: totalIncome - totalExpense,
      linkedTxs,
    };
  };

  // Global KPI summaries
  const summaryStats = useMemo(() => {
    let totalAlive = 0;
    let totalPurchasedAndAdded = 0;
    let totalDead = 0;
    let totalSold = 0;
    let totalSaleIncome = 0;
    const aliveBySpecies: Record<LivestockSpecies, number> = {
      CHICKEN: 0,
      DUCK: 0,
      GOAT: 0,
      FISH: 0,
      PIG: 0,
      CATTLE: 0,
      OTHER: 0,
    };

    batches.forEach((b) => {
      const alive = getAliveCount(b);
      const sp = b.species || 'OTHER';
      aliveBySpecies[sp] = (aliveBySpecies[sp] || 0) + alive;
      totalAlive += alive;
      totalPurchasedAndAdded += (Number(b.initialCount) || 0) + (Number(b.addedCount) || 0);
      totalDead += Number(b.deadCount) || 0;
      totalSold += Number(b.soldCount) || 0;
      totalSaleIncome += getBatchFinancials(b).totalIncome;
    });

    const overallMortalityPct =
      totalPurchasedAndAdded > 0 ? ((totalDead / totalPurchasedAndAdded) * 100).toFixed(1) : '0.0';

    return {
      totalAlive,
      totalPurchasedAndAdded,
      totalDead,
      totalSold,
      totalSaleIncome,
      overallMortalityPct,
      aliveBySpecies,
    };
  }, [batches, transactions]);

  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (speciesFilter !== 'ALL' && (b.species || 'OTHER') !== speciesFilter) return false;
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const nameMatch = (b.batchName || '').toLowerCase().includes(q);
        const supplierMatch = getSupplierDisplay(b).toLowerCase().includes(q);
        const speciesMatch = getSpeciesLabel(b.species).toLowerCase().includes(q);
        if (!nameMatch && !supplierMatch && !speciesMatch) return false;
      }
      return true;
    });
  }, [batches, speciesFilter, statusFilter, searchQuery, parties, language]);

  // Open Add Batch modal
  const openAddBatchModal = () => {
    setEditingBatch(null);
    const defaultSpecies: LivestockSpecies = speciesFilter !== 'ALL' ? speciesFilter : 'CHICKEN';
    const meta = getSpeciesMeta(defaultSpecies);
    const nextNum = batches.filter((b) => (b.species || 'OTHER') === defaultSpecies).length + 1;
    setBatchForm({
      species: defaultSpecies,
      batchName: `${language === 'ne' ? meta.defaultBatchNe : meta.defaultBatchEn} #${nextNum}`,
      supplierId: '',
      supplierName: '',
      startDateBS: new NepaliDate().format('YYYY MMMM DD'),
      initialCount: '',
      unitPrice: '',
      purchaseTotalCost: '',
      status: 'ACTIVE',
      notes: '',
      alsoRecordExpense: true,
      paymentMethod: 'CASH',
    });
    setBatchError(null);
    setIsBatchModalOpen(true);
  };

  const openEditBatchModal = (b: Batch) => {
    setEditingBatch(b);
    setBatchForm({
      species: b.species || 'OTHER',
      batchName: b.batchName,
      supplierId: b.supplierId || '',
      supplierName: b.supplierName || '',
      startDateBS: b.startDateBS || new NepaliDate().format('YYYY MMMM DD'),
      initialCount: (b.initialCount ?? 0).toString(),
      unitPrice: b.unitPrice ? b.unitPrice.toString() : '',
      purchaseTotalCost: b.purchaseTotalCost ? b.purchaseTotalCost.toString() : '',
      status: b.status || 'ACTIVE',
      notes: b.notes || '',
      alsoRecordExpense: false,
      paymentMethod: 'CASH',
    });
    setBatchError(null);
    setIsBatchModalOpen(true);
  };

  // Auto-calculate total purchase cost when quantity & unit price change
  const handleBatchNumberChange = (field: 'initialCount' | 'unitPrice' | 'purchaseTotalCost', val: string) => {
    setBatchForm((prev) => {
      const next = { ...prev, [field]: val };
      if (field === 'initialCount' || field === 'unitPrice') {
        const q = Number(field === 'initialCount' ? val : prev.initialCount);
        const u = Number(field === 'unitPrice' ? val : prev.unitPrice);
        if (q > 0 && u > 0) {
          next.purchaseTotalCost = Math.round(q * u).toString();
        }
      }
      return next;
    });
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || isSavingBatch) return;

    const initialQty = Number(batchForm.initialCount);
    if (!batchForm.batchName.trim()) {
      setBatchError(language === 'ne' ? 'कृपया ब्याचको नाम लेख्नुहोस्।' : 'Please enter a batch name.');
      return;
    }
    if (isNaN(initialQty) || initialQty < 0) {
      setBatchError(language === 'ne' ? 'कृपया सही संख्या लेख्नुहोस्।' : 'Please enter a valid quantity.');
      return;
    }

    const totalCost = Number(batchForm.purchaseTotalCost) || 0;
    const unitPrice = Number(batchForm.unitPrice) || (initialQty > 0 && totalCost > 0 ? Math.round((totalCost / initialQty) * 100) / 100 : 0);
    const resolvedSupplier = parties.find((p) => p.id === batchForm.supplierId);
    const resolvedSupplierName = resolvedSupplier ? resolvedSupplier.name : batchForm.supplierName.trim();
    const spMeta = getSpeciesMeta(batchForm.species);

    setIsSavingBatch(true);
    setBatchError(null);

    try {
      if (editingBatch) {
        const minRequired = (Number(editingBatch.deadCount) || 0) + (Number(editingBatch.soldCount) || 0) - (Number(editingBatch.addedCount) || 0);
        if (initialQty < minRequired) {
          setBatchError(
            language === 'ne'
              ? `किनेको संख्या पहिले नै दर्ता भएको मृत्यु र बिक्री (${minRequired}) भन्दा कम हुन सक्दैन।`
              : `Purchased quantity cannot be less than recorded dead + sold minus additions (${minRequired}).`
          );
          setIsSavingBatch(false);
          return;
        }

        await updateDoc(doc(db, 'batches', editingBatch.id), {
          batchName: batchForm.batchName.trim(),
          type: 'LIVESTOCK',
          species: batchForm.species,
          speciesLabel: language === 'ne' ? spMeta.labelNe : spMeta.labelEn,
          supplierId: batchForm.supplierId || '',
          supplierName: resolvedSupplierName,
          startDateBS: batchForm.startDateBS,
          initialCount: initialQty,
          unitPrice,
          purchaseTotalCost: totalCost,
          status: batchForm.status,
          notes: batchForm.notes.trim(),
        });
      } else {
        await runTransaction(db, async (transaction) => {
          const batchRef = doc(collection(db, 'batches'));
          const logRef = doc(collection(db, 'livestockLogs'));
          const shouldCreateTx = batchForm.alsoRecordExpense && totalCost > 0;

          let accRef: any = null;
          let accDoc: any = null;
          let resolvedAccountId = '';
          if (shouldCreateTx && batchForm.paymentMethod !== 'CREDIT') {
            const match = accounts.find((a) => a.type === batchForm.paymentMethod);
            if (match) {
              resolvedAccountId = match.id;
              accRef = doc(db, 'bankAccounts', match.id);
              accDoc = await transaction.get(accRef);
            }
          }

          let supRef: any = null;
          let supDoc: any = null;
          if (shouldCreateTx && batchForm.supplierId && batchForm.paymentMethod === 'CREDIT') {
            supRef = doc(db, 'parties', batchForm.supplierId);
            supDoc = await transaction.get(supRef);
          }

          let txId = '';
          if (shouldCreateTx) {
            const txRef = doc(collection(db, 'transactions'));
            txId = txRef.id;

            if (batchForm.paymentMethod !== 'CREDIT' && !resolvedAccountId) {
              accRef = doc(collection(db, 'bankAccounts'));
              transaction.set(accRef, {
                farmId,
                name: batchForm.paymentMethod === 'CASH' ? 'Cash' : batchForm.paymentMethod === 'BANK' ? 'Bank' : 'Wallet',
                type: batchForm.paymentMethod,
                accountNumber: '',
                bankName: '',
                initialBalance: 0,
                currentBalance: -totalCost,
                status: 'ACTIVE',
                createdAt: Date.now(),
              });
              resolvedAccountId = accRef.id;
            } else if (accDoc && accDoc.exists()) {
              transaction.update(accRef, {
                currentBalance: (Number(accDoc.data().currentBalance) || 0) - totalCost,
              });
            }

            if (supDoc && supDoc.exists() && batchForm.paymentMethod === 'CREDIT') {
              const curBal = Number(supDoc.data().pendingBalance) || 0;
              transaction.update(supRef, { pendingBalance: curBal + totalCost });
            }

            transaction.set(txRef, {
              farmId,
              type: 'EXPENSE',
              amount: totalCost,
              category: 'Livestock Purchase',
              subCategory: spMeta.labelEn,
              partyId: batchForm.supplierId || '',
              batchId: batchRef.id,
              accountId: resolvedAccountId,
              paymentMethod: batchForm.paymentMethod,
              partyBalanceEffect: batchForm.supplierId && batchForm.paymentMethod === 'CREDIT' ? 'ADD_DUE' : 'NONE',
              dateBS: batchForm.startDateBS,
              notes: `[Batch Purchase] ${batchForm.batchName.trim()} (${initialQty} pcs)${batchForm.notes.trim() ? ` - ${batchForm.notes.trim()}` : ''}`,
              createdAt: Date.now(),
              createdBy: 'user',
            });
          }

          transaction.set(batchRef, {
            farmId,
            batchName: batchForm.batchName.trim(),
            type: 'LIVESTOCK',
            species: batchForm.species,
            speciesLabel: language === 'ne' ? spMeta.labelNe : spMeta.labelEn,
            supplierId: batchForm.supplierId || '',
            supplierName: resolvedSupplierName,
            startDateBS: batchForm.startDateBS,
            initialCount: initialQty,
            addedCount: 0,
            deadCount: 0,
            soldCount: 0,
            unitPrice,
            purchaseTotalCost: totalCost,
            notes: batchForm.notes.trim(),
            status: batchForm.status,
            totalExpense: totalCost,
            totalIncome: 0,
            createdAt: Date.now(),
          });

          transaction.set(logRef, {
            farmId,
            batchId: batchRef.id,
            batchName: batchForm.batchName.trim(),
            species: batchForm.species,
            eventType: 'INITIAL',
            quantity: initialQty,
            dateBS: batchForm.startDateBS,
            partyId: batchForm.supplierId || '',
            partyName: resolvedSupplierName,
            amount: totalCost,
            notes: batchForm.notes.trim() || (language === 'ne' ? 'प्रारम्भिक खरिद' : 'Initial purchase'),
            transactionId: txId,
            createdAt: Date.now(),
          });
        });
      }

      setIsBatchModalOpen(false);
      setEditingBatch(null);
    } catch (err) {
      console.error('Error saving batch:', err);
      setBatchError(language === 'ne' ? 'ब्याच सुरक्षित गर्न सकिएन। पुन: प्रयास गर्नुहोस्।' : 'Failed to save batch. Please try again.');
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Open Quick Event Modal
  const openEventModal = (batch: Batch, type: QuickEventType) => {
    setEventTargetBatch(batch);
    setEventType(type);
    setEventForm({
      quantity: '',
      dateBS: new NepaliDate().format('YYYY MMMM DD'),
      partyId: type === 'ADDITION' ? batch.supplierId || '' : '',
      partyName: type === 'ADDITION' ? batch.supplierName || '' : '',
      amount: '',
      paymentMethod: 'CASH',
      alsoRecordTransaction: true,
      notes: '',
    });
    setEventError(null);
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !eventTargetBatch || isSavingEvent) return;

    const qty = Number(eventForm.quantity);
    const alive = getAliveCount(eventTargetBatch);

    if (isNaN(qty) || qty <= 0) {
      setEventError(language === 'ne' ? 'कृपया १ वा सोभन्दा बढी संख्या लेख्नुहोस्।' : 'Please enter a quantity greater than 0.');
      return;
    }

    if ((eventType === 'MORTALITY' || eventType === 'SALE') && qty > alive) {
      setEventError(
        language === 'ne'
          ? `हाल जिउँदो संख्या (${alive}) भन्दा बढी दर्ता गर्न मिल्दैन।`
          : `Quantity cannot exceed currently alive stock (${alive}).`
      );
      return;
    }

    const amount = Number(eventForm.amount) || 0;
    const selectedParty = parties.find((p) => p.id === eventForm.partyId);
    const resolvedPartyName = selectedParty ? selectedParty.name : eventForm.partyName.trim();

    setIsSavingEvent(true);
    setEventError(null);

    try {
      await runTransaction(db, async (transaction) => {
        const batchRef = doc(db, 'batches', eventTargetBatch.id);
        const batchSnap = await transaction.get(batchRef);
        if (!batchSnap.exists()) throw new Error('Batch not found');
        const currentBatch = batchSnap.data() as Batch;

        const currentAlive =
          (Number(currentBatch.initialCount) || 0) +
          (Number(currentBatch.addedCount) || 0) -
          (Number(currentBatch.deadCount) || 0) -
          (Number(currentBatch.soldCount) || 0);

        if ((eventType === 'MORTALITY' || eventType === 'SALE') && qty > currentAlive) {
          throw new Error(
            language === 'ne'
              ? `हाल जिउँदो संख्या (${currentAlive}) भन्दा बढी दर्ता गर्न मिल्दैन।`
              : `Cannot exceed live stock (${currentAlive}).`
          );
        }

        const shouldRecordTx =
          (eventType === 'SALE' || eventType === 'ADDITION') && eventForm.alsoRecordTransaction && amount > 0;

        let accRef: any = null;
        let accDoc: any = null;
        let resolvedAccountId = '';
        if (shouldRecordTx && eventForm.paymentMethod !== 'CREDIT') {
          const match = accounts.find((a) => a.type === eventForm.paymentMethod);
          if (match) {
            resolvedAccountId = match.id;
            accRef = doc(db, 'bankAccounts', match.id);
            accDoc = await transaction.get(accRef);
          }
        }

        let partyRef: any = null;
        let partyDoc: any = null;
        if (shouldRecordTx && eventForm.partyId && eventForm.paymentMethod === 'CREDIT') {
          partyRef = doc(db, 'parties', eventForm.partyId);
          partyDoc = await transaction.get(partyRef);
        }

        // Write batch update
        const updatePayload: Record<string, any> = {};
        if (eventType === 'MORTALITY') {
          updatePayload.deadCount = (Number(currentBatch.deadCount) || 0) + qty;
        } else if (eventType === 'ADDITION') {
          updatePayload.addedCount = (Number(currentBatch.addedCount) || 0) + qty;
          if (!shouldRecordTx && amount > 0) {
            updatePayload.purchaseTotalCost = (Number(currentBatch.purchaseTotalCost) || 0) + amount;
          }
        } else if (eventType === 'SALE') {
          updatePayload.soldCount = (Number(currentBatch.soldCount) || 0) + qty;
          if (!shouldRecordTx && amount > 0) {
            updatePayload.totalIncome = (Number(currentBatch.totalIncome) || 0) + amount;
          }
        }

        // Auto-mark completed if alive becomes 0 on sale? Keep user in control, don't force close unless they edit.
        transaction.update(batchRef, updatePayload);

        let txId = '';
        if (shouldRecordTx) {
          const txRef = doc(collection(db, 'transactions'));
          txId = txRef.id;
          const isIncome = eventType === 'SALE';

          if (eventForm.paymentMethod !== 'CREDIT' && !resolvedAccountId) {
            accRef = doc(collection(db, 'bankAccounts'));
            transaction.set(accRef, {
              farmId,
              name: eventForm.paymentMethod === 'CASH' ? 'Cash' : eventForm.paymentMethod === 'BANK' ? 'Bank' : 'Wallet',
              type: eventForm.paymentMethod,
              accountNumber: '',
              bankName: '',
              initialBalance: 0,
              currentBalance: isIncome ? amount : -amount,
              status: 'ACTIVE',
              createdAt: Date.now(),
            });
            resolvedAccountId = accRef.id;
          } else if (accDoc && accDoc.exists()) {
            const delta = isIncome ? amount : -amount;
            transaction.update(accRef, {
              currentBalance: (Number(accDoc.data().currentBalance) || 0) + delta,
            });
          }

          if (partyDoc && partyDoc.exists() && eventForm.paymentMethod === 'CREDIT') {
            const curPending = Number(partyDoc.data().pendingBalance) || 0;
            transaction.update(partyRef, { pendingBalance: curPending + amount });
          }

          const spLabel = getSpeciesMeta(currentBatch.species).labelEn;
          transaction.set(txRef, {
            farmId,
            type: isIncome ? 'INCOME' : 'EXPENSE',
            amount,
            category: isIncome ? 'Livestock Sale' : 'Livestock Purchase',
            subCategory: spLabel,
            partyId: eventForm.partyId || '',
            batchId: eventTargetBatch.id,
            accountId: resolvedAccountId,
            paymentMethod: eventForm.paymentMethod,
            partyBalanceEffect: eventForm.partyId && eventForm.paymentMethod === 'CREDIT' ? 'ADD_DUE' : 'NONE',
            dateBS: eventForm.dateBS,
            notes: `${isIncome ? 'Sale' : 'Added Stock'}: ${currentBatch.batchName} (${qty} pcs)${eventForm.notes.trim() ? ` - ${eventForm.notes.trim()}` : ''}`,
            createdAt: Date.now(),
            createdBy: 'user',
          });
        }

        const logRef = doc(collection(db, 'livestockLogs'));
        transaction.set(logRef, {
          farmId,
          batchId: eventTargetBatch.id,
          batchName: currentBatch.batchName,
          species: currentBatch.species,
          eventType,
          quantity: qty,
          dateBS: eventForm.dateBS,
          partyId: eventForm.partyId || '',
          partyName: resolvedPartyName,
          amount,
          notes: eventForm.notes.trim(),
          transactionId: txId,
          createdAt: Date.now(),
        });
      });

      setEventTargetBatch(null);
    } catch (err: any) {
      console.error('Error recording livestock event:', err);
      setEventError(err?.message || (language === 'ne' ? 'दर्ता गर्न समस्या भयो।' : 'Failed to save record.'));
    } finally {
      setIsSavingEvent(false);
    }
  };

  // Revert a log entry cleanly from History modal
  const handleRevertLog = async (log: LivestockLog) => {
    if (!historyBatch || revertingLogId || log.eventType === 'INITIAL') return;
    setRevertingLogId(log.id);
    try {
      await runTransaction(db, async (transaction) => {
        const batchRef = doc(db, 'batches', historyBatch.id);
        const batchSnap = await transaction.get(batchRef);
        let txSnap: any = null;
        let accSnap: any = null;
        let partySnap: any = null;

        if (log.transactionId) {
          const txRef = doc(db, 'transactions', log.transactionId);
          txSnap = await transaction.get(txRef);
          if (txSnap.exists()) {
            const txData = txSnap.data() as Transaction;
            if (txData.accountId && txData.paymentMethod !== 'CREDIT') {
              accSnap = await transaction.get(doc(db, 'bankAccounts', txData.accountId));
            }
            if (txData.partyId && txData.partyBalanceEffect === 'ADD_DUE') {
              partySnap = await transaction.get(doc(db, 'parties', txData.partyId));
            }
          }
        }

        if (batchSnap.exists()) {
          const bd = batchSnap.data() as Batch;
          const updates: Record<string, any> = {};
          if (log.eventType === 'MORTALITY') {
            updates.deadCount = Math.max(0, (Number(bd.deadCount) || 0) - log.quantity);
          } else if (log.eventType === 'ADDITION') {
            updates.addedCount = Math.max(0, (Number(bd.addedCount) || 0) - log.quantity);
          } else if (log.eventType === 'SALE') {
            updates.soldCount = Math.max(0, (Number(bd.soldCount) || 0) - log.quantity);
          }
          transaction.update(batchRef, updates);
        }

        if (txSnap && txSnap.exists()) {
          const txData = txSnap.data() as Transaction;
          if (accSnap && accSnap.exists()) {
            const isInflow = txData.type === 'INCOME' || txData.type === 'CAPITAL_INFLOW';
            const revertAmt = isInflow ? -txData.amount : txData.amount;
            transaction.update(accSnap.ref, {
              currentBalance: (Number(accSnap.data().currentBalance) || 0) + revertAmt,
            });
          }
          if (partySnap && partySnap.exists()) {
            transaction.update(partySnap.ref, {
              pendingBalance: (Number(partySnap.data().pendingBalance) || 0) - txData.amount,
            });
          }
          transaction.delete(txSnap.ref);
        }

        transaction.delete(doc(db, 'livestockLogs', log.id));
      });
    } catch (err) {
      console.error('Failed to revert log:', err);
    } finally {
      setRevertingLogId(null);
    }
  };

  const handleToggleStatus = async (b: Batch) => {
    const nextStatus = b.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
    await updateDoc(doc(db, 'batches', b.id), { status: nextStatus });
  };

  const handleConfirmDeleteBatch = async () => {
    if (!deleteTargetBatch || isDeletingBatch) return;
    setIsDeletingBatch(true);
    try {
      // Delete associated livestockLogs
      const batchLogs = logs.filter((l) => l.batchId === deleteTargetBatch.id);
      await Promise.all(batchLogs.map((l) => deleteDoc(doc(db, 'livestockLogs', l.id))));
      await deleteDoc(doc(db, 'batches', deleteTargetBatch.id));
      if (historyBatch?.id === deleteTargetBatch.id) {
        setHistoryBatch(null);
      }
      setDeleteTargetBatch(null);
    } catch (err) {
      console.error('Failed to delete batch:', err);
    } finally {
      setIsDeletingBatch(false);
    }
  };

  // Sync historyBatch state when batches update
  const activeHistoryBatch = historyBatch
    ? batches.find((b) => b.id === historyBatch.id) || historyBatch
    : null;
  const activeHistoryLogs = activeHistoryBatch
    ? logs.filter((l) => l.batchId === activeHistoryBatch.id)
    : [];

  const mortalityQuickReasons =
    language === 'ne'
      ? ['रोग / बिमारी', 'चिसो / मौसम', 'दाना / पानी', 'दुर्घटना / अन्य']
      : ['Disease / Illness', 'Cold / Weather', 'Feed / Water', 'Accident / Other'];

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <Bird size={22} />
            </span>
            <span>{t.livestockBatches || 'Livestock & Batches'}</span>
          </h1>
          <p className="text-stone-500 text-sm mt-1">
            {t.livestockSubtitle || 'Track suppliers, purchased counts, mortality, sales & live stock'}
          </p>
        </div>

        <button
          onClick={openAddBatchModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-sm transition-colors"
        >
          <Plus size={18} />
          <span>{t.addLivestockBatch || 'Add Livestock Batch'}</span>
        </button>
      </div>

      {/* 4-Card KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
            <span>{t.currentAlive || 'Currently Alive'}</span>
            <HeartPulse size={18} className="text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-700 tabular-nums">
            {summaryStats.totalAlive.toLocaleString()}
          </div>
          <div className="text-xs text-stone-500 mt-1.5 leading-relaxed">
            {SPECIES_LIST.filter((s) => (summaryStats.aliveBySpecies[s.id] || 0) > 0)
              .map((s) => `${language === 'ne' ? s.labelNe.split('/')[0].trim() : s.labelEn.split('/')[0].trim()}: ${summaryStats.aliveBySpecies[s.id]}`)
              .join(' · ') || (language === 'ne' ? 'अहिले कुनै ब्याच छैन' : 'No active stock yet')}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
            <span>
              {t.initialQuantity || 'Purchased'} + {t.addedQuantity || 'Added'}
            </span>
            <Layers size={18} className="text-sky-600" />
          </div>
          <div className="text-2xl font-extrabold text-stone-800 tabular-nums">
            {summaryStats.totalPurchasedAndAdded.toLocaleString()}
          </div>
          <div className="text-xs text-stone-500 mt-1.5">
            {batches.length} {language === 'ne' ? 'जम्मा ब्याचहरू' : 'total batches'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
            <span>{t.mortalityDead || 'Total Mortality'}</span>
            <Skull size={18} className="text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600 tabular-nums">
            {summaryStats.totalDead.toLocaleString()}
          </div>
          <div className="text-xs text-stone-500 mt-1.5 tabular-nums">
            {t.mortalityRate || 'Mortality %'}: {summaryStats.overallMortalityPct}%
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-500 mb-2">
            <span>{t.soldQuantity || 'Sold'}</span>
            <ShoppingBag size={18} className="text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-700 tabular-nums">
            {summaryStats.totalSold.toLocaleString()}
          </div>
          <div className="text-xs text-stone-500 mt-1.5 tabular-nums">
            {language === 'ne' ? 'बिक्री आम्दानी: ' : 'Sales Income: '}Rs. {summaryStats.totalSaleIncome.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Species Filter + Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSpeciesFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              speciesFilter === 'ALL'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100'
            }`}
          >
            {language === 'ne' ? 'सबै' : 'All'} ({summaryStats.totalAlive})
          </button>
          {SPECIES_LIST.map((sp) => {
            const count = summaryStats.aliveBySpecies[sp.id] || 0;
            const active = speciesFilter === sp.id;
            return (
              <button
                key={sp.id}
                onClick={() => setSpeciesFilter(sp.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {sp.id === 'FISH' ? <Fish size={13} /> : <Bird size={13} />}
                <span>{language === 'ne' ? sp.labelNe : sp.labelEn}</span>
                <span className={`tabular-nums ${active ? 'text-emerald-100' : 'text-stone-400'}`}>({count})</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                language === 'ne'
                  ? 'ब्याच नाम वा आपूर्तिकर्ताको नामले खोज्नुहोस्...'
                  : 'Search by batch name or supplier name...'
              }
              className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="ALL">{language === 'ne' ? 'सबै स्थिति' : 'All Status'}</option>
            <option value="ACTIVE">{t.active || 'Active'}</option>
            <option value="COMPLETED">{t.completed || 'Completed'}</option>
          </select>
        </div>
      </div>

      {/* Main Bordered Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Bird size={24} />
            </div>
            <p className="text-stone-600 font-medium">
              {language === 'ne'
                ? 'कुनै पशुपन्छी ब्याच फेला परेन। नयाँ ब्याच थप्नुहोस्!'
                : 'No livestock batches found. Add your first batch!'}
            </p>
            <button
              onClick={openAddBatchModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700"
            >
              <Plus size={16} />
              <span>{t.addLivestockBatch || 'Add Livestock Batch'}</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse [&_th]:border [&_th]:border-stone-200 [&_td]:border [&_td]:border-stone-200 text-sm">
              <thead className="bg-stone-50 text-stone-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-3 text-center w-px whitespace-nowrap">{language === 'ne' ? 'क्र.सं.' : '#'}</th>
                  <th className="py-3 px-3">{language === 'ne' ? 'ब्याच र प्रकार' : 'Batch & Type'}</th>
                  <th className="py-3 px-3">{language === 'ne' ? 'आपूर्तिकर्ता' : 'Supplier'}</th>
                  <th className="py-3 px-3 w-px whitespace-nowrap">{t.date || 'Date (B.S.)'}</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">{t.initialQuantity || 'Purchased'}</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">{t.addedQuantity || 'Added'}</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap text-rose-700">{t.mortalityDead || 'Dead'}</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap text-indigo-700">{t.soldQuantity || 'Sold'}</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap text-emerald-700">{t.currentAlive || 'Alive'}</th>
                  <th className="py-3 px-3 text-right whitespace-nowrap">{language === 'ne' ? 'खर्च / आम्दानी' : 'Cost / Income'}</th>
                  <th className="py-3 px-3 text-center whitespace-nowrap">{t.actions || 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {filteredBatches.map((b, idx) => {
                  const alive = getAliveCount(b);
                  const fin = getBatchFinancials(b);
                  const mortPct = getMortalityPercent(b);
                  return (
                    <tr key={b.id} className="hover:bg-stone-50/70 transition-colors">
                      <td className="py-3 px-3 text-center text-stone-400 font-medium tabular-nums">{idx + 1}</td>
                      <td className="py-3 px-3 min-w-[170px]">
                        <div className="font-bold text-stone-800">{b.batchName}</div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          {getSpeciesLabel(b.species)} ·{' '}
                          <span className={b.status === 'ACTIVE' ? 'text-emerald-700 font-semibold' : 'text-stone-500'}>
                            {b.status === 'ACTIVE' ? t.active || 'Active' : t.completed || 'Completed'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 min-w-[140px]">
                        <div className="font-medium text-stone-700">{getSupplierDisplay(b)}</div>
                        {b.unitPrice ? (
                          <div className="text-xs text-stone-400 tabular-nums">
                            @ Rs. {b.unitPrice.toLocaleString()}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 px-3 w-px whitespace-nowrap text-xs text-stone-600 tabular-nums">
                        {b.startDateBS}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-stone-800 tabular-nums">
                        {(Number(b.initialCount) || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-sky-700 tabular-nums">
                        {(Number(b.addedCount) || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <div className="font-bold text-rose-600">{(Number(b.deadCount) || 0).toLocaleString()}</div>
                        <div className="text-[11px] text-stone-400">{mortPct}%</div>
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-indigo-700 tabular-nums">
                        {(Number(b.soldCount) || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        <span className="font-extrabold text-base text-emerald-700">{alive.toLocaleString()}</span>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums whitespace-nowrap">
                        <div className="text-xs text-rose-600">
                          {language === 'ne' ? 'खर्च' : 'Exp'}: Rs. {fin.totalExpense.toLocaleString()}
                        </div>
                        <div className="text-xs text-emerald-700 font-semibold">
                          {language === 'ne' ? 'आम्दानी' : 'Inc'}: Rs. {fin.totalIncome.toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => openEventModal(b, 'MORTALITY')}
                            disabled={alive <= 0}
                            title={t.recordMortality || 'Record Death'}
                            className="px-2 py-1 text-xs font-semibold rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 disabled:opacity-40"
                          >
                            {t.recordMortality || '+ Death'}
                          </button>
                          <button
                            onClick={() => openEventModal(b, 'SALE')}
                            disabled={alive <= 0}
                            title={t.recordSale || 'Record Sale'}
                            className="px-2 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 disabled:opacity-40"
                          >
                            {t.recordSale || '+ Sale'}
                          </button>
                          <button
                            onClick={() => openEventModal(b, 'ADDITION')}
                            title={t.recordAddition || 'Add Stock'}
                            className="px-2 py-1 text-xs font-semibold rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                          >
                            {t.recordAddition || '+ Add'}
                          </button>
                          <button
                            onClick={() => setHistoryBatch(b)}
                            title={t.viewBatchHistory || 'Batch History'}
                            className="p-1.5 text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          >
                            <History size={16} />
                          </button>
                          <button
                            onClick={() => openEditBatchModal(b)}
                            title={t.edit || 'Edit'}
                            className="p-1.5 text-stone-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setDeleteTargetBatch(b)}
                            title={t.delete || 'Delete'}
                            className="p-1.5 text-stone-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal 1: Add / Edit Livestock Batch */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92dvh] overflow-y-auto shadow-2xl border border-stone-200">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <h2 className="text-lg font-bold text-stone-800">
                {editingBatch
                  ? t.editLivestockBatch || 'Edit Livestock Batch'
                  : t.addLivestockBatch || 'Add Livestock Batch'}
              </h2>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveBatch} className="p-5 space-y-4">
              {batchError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{batchError}</span>
                </div>
              )}

              {/* Species Selector */}
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-2">
                  {t.species || 'Animal / Bird Type'} *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SPECIES_LIST.map((sp) => {
                    const selected = batchForm.species === sp.id;
                    return (
                      <button
                        type="button"
                        key={sp.id}
                        onClick={() => {
                          setBatchForm((prev) => {
                            const nextNum = batches.filter((b) => (b.species || 'OTHER') === sp.id).length + 1;
                            const isDefaultName =
                              !editingBatch &&
                              (!prev.batchName ||
                                SPECIES_LIST.some(
                                  (m) =>
                                    prev.batchName.startsWith(m.defaultBatchNe) ||
                                    prev.batchName.startsWith(m.defaultBatchEn)
                                ));
                            return {
                              ...prev,
                              species: sp.id,
                              batchName: isDefaultName
                                ? `${language === 'ne' ? sp.defaultBatchNe : sp.defaultBatchEn} #${nextNum}`
                                : prev.batchName,
                            };
                          });
                        }}
                        className={`px-2.5 py-2 rounded-xl border text-xs font-semibold text-left transition-colors ${
                          selected
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {language === 'ne' ? sp.labelNe : sp.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.batchName || 'Batch / Group Name'} *
                  </label>
                  <input
                    type="text"
                    required
                    value={batchForm.batchName}
                    onChange={(e) => setBatchForm({ ...batchForm, batchName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    placeholder={language === 'ne' ? 'जस्तै: ब्रोइलर चल्ला लट #१' : 'e.g., Broiler Batch #1'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.date || 'Date (B.S.)'} *
                  </label>
                  <NepaliDatePicker
                    value={batchForm.startDateBS}
                    onChange={(d) => setBatchForm({ ...batchForm, startDateBS: d })}
                  />
                </div>
              </div>

              {/* Supplier selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.purchasedFromSupplier || 'Purchased From (Supplier)'}
                  </label>
                  <select
                    value={batchForm.supplierId}
                    onChange={(e) => {
                      const sup = suppliers.find((s) => s.id === e.target.value);
                      setBatchForm({
                        ...batchForm,
                        supplierId: e.target.value,
                        supplierName: sup ? sup.name : batchForm.supplierName,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  >
                    <option value="">
                      {language === 'ne' ? '-- आपूर्तिकर्ता छान्नुहोस् (वा तल लेख्नुहोस्) --' : '-- Select Supplier (or type below) --'}
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {language === 'ne' ? 'सप्लायर / ह्याचरीको नाम (ऐच्छिक)' : 'Supplier / Hatchery Name (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={batchForm.supplierName}
                    onChange={(e) => setBatchForm({ ...batchForm, supplierName: e.target.value })}
                    placeholder={language === 'ne' ? 'जस्तै: श्रीकृष्ण ह्याचरी' : 'e.g., Kathmandu Hatchery'}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {/* Counts & Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.initialQuantity || 'Purchased Qty'} *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={batchForm.initialCount}
                    onChange={(e) => handleBatchNumberChange('initialCount', e.target.value)}
                    placeholder="500"
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.unitCost || 'Cost per Unit (Rs.)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={batchForm.unitPrice}
                    onChange={(e) => handleBatchNumberChange('unitPrice', e.target.value)}
                    placeholder="65"
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.totalCost || 'Total Purchase Cost (Rs.)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={batchForm.purchaseTotalCost}
                    onChange={(e) => handleBatchNumberChange('purchaseTotalCost', e.target.value)}
                    placeholder="32500"
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              {!editingBatch && Number(batchForm.purchaseTotalCost) > 0 && (
                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={batchForm.alsoRecordExpense}
                      onChange={(e) => setBatchForm({ ...batchForm, alsoRecordExpense: e.target.checked })}
                      className="mt-0.5 rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-emerald-900">
                      {t.alsoRecordExpense || 'Also record purchase in Transactions & Supplier Khata'}
                    </span>
                  </label>
                  {batchForm.alsoRecordExpense && (
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {(['CASH', 'BANK', 'WALLET', 'CREDIT'] as const).map((pm) => (
                        <button
                          type="button"
                          key={pm}
                          onClick={() => setBatchForm({ ...batchForm, paymentMethod: pm })}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-colors ${
                            batchForm.paymentMethod === pm
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-stone-600 border-stone-200'
                          }`}
                        >
                          {pm === 'CASH'
                            ? t.cash || 'Cash'
                            : pm === 'BANK'
                            ? t.bank || 'Bank'
                            : pm === 'WALLET'
                            ? t.wallet || 'Wallet'
                            : t.credit || 'Credit'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {editingBatch && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.status || 'Status'}
                  </label>
                  <select
                    value={batchForm.status}
                    onChange={(e) => setBatchForm({ ...batchForm, status: e.target.value as 'ACTIVE' | 'COMPLETED' })}
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm bg-white"
                  >
                    <option value="ACTIVE">{t.active || 'Active'}</option>
                    <option value="COMPLETED">{t.completed || 'Completed'}</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  {t.notes || 'Notes'}
                </label>
                <textarea
                  rows={2}
                  value={batchForm.notes}
                  onChange={(e) => setBatchForm({ ...batchForm, notes: e.target.value })}
                  className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  placeholder={language === 'ne' ? 'जाति, उमेर वा अन्य विवरण...' : 'Breed, age or other details...'}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsBatchModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingBatch}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50"
                >
                  {isSavingBatch ? t.saving || 'Saving...' : t.save || 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Quick Event (MORTALITY / ADDITION / SALE) */}
      {eventTargetBatch && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[92dvh] overflow-y-auto shadow-2xl border border-stone-200">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <div>
                <h2 className="text-lg font-bold text-stone-800">
                  {eventType === 'MORTALITY'
                    ? t.recordMortality || 'Record Death'
                    : eventType === 'SALE'
                    ? t.recordSale || 'Record Sale'
                    : t.recordAddition || 'Add Stock'}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {eventTargetBatch.batchName} · {t.currentAlive || 'Alive'}:{' '}
                  <strong className="text-emerald-700 tabular-nums">{getAliveCount(eventTargetBatch)}</strong>
                </p>
              </div>
              <button
                onClick={() => setEventTargetBatch(null)}
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="p-5 space-y-4">
              {eventError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>{eventError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {language === 'ne' ? 'संख्या' : 'Quantity'} *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={eventType === 'ADDITION' ? undefined : getAliveCount(eventTargetBatch)}
                    required
                    autoFocus
                    value={eventForm.quantity}
                    onChange={(e) => setEventForm({ ...eventForm, quantity: e.target.value })}
                    placeholder="1"
                    className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.date || 'Date (B.S.)'} *
                  </label>
                  <NepaliDatePicker
                    value={eventForm.dateBS}
                    onChange={(d) => setEventForm({ ...eventForm, dateBS: d })}
                  />
                </div>
              </div>

              {eventType === 'MORTALITY' && (
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                    {t.causeNotes || 'Cause / Notes'}
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {mortalityQuickReasons.map((reason) => (
                      <button
                        type="button"
                        key={reason}
                        onClick={() => setEventForm({ ...eventForm, notes: reason })}
                        className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                          eventForm.notes === reason
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'bg-stone-50 text-stone-700 border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={eventForm.notes}
                    onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                    placeholder={language === 'ne' ? 'मृत्युको कारण लेख्नुहोस्...' : 'Enter cause or remarks...'}
                    className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm"
                  />
                </div>
              )}

              {(eventType === 'SALE' || eventType === 'ADDITION') && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                        {eventType === 'SALE'
                          ? language === 'ne'
                            ? 'क्रेता / ग्राहक'
                            : 'Buyer / Customer'
                          : t.purchasedFromSupplier || 'Supplier'}
                      </label>
                      <select
                        value={eventForm.partyId}
                        onChange={(e) => {
                          const list = eventType === 'SALE' ? buyers : suppliers;
                          const found = list.find((p) => p.id === e.target.value);
                          setEventForm({
                            ...eventForm,
                            partyId: e.target.value,
                            partyName: found ? found.name : eventForm.partyName,
                          });
                        }}
                        className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-white"
                      >
                        <option value="">{language === 'ne' ? '-- छान्नुहोस् (ऐच्छिक) --' : '-- Optional --'}</option>
                        {(eventType === 'SALE' ? buyers : suppliers).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                        {eventType === 'SALE'
                          ? language === 'ne'
                            ? 'जम्मा बिक्री रकम (रु.)'
                            : 'Total Sale Amount (Rs.)'
                          : language === 'ne'
                          ? 'जम्मा खर्च रकम (रु.)'
                          : 'Purchase Cost (Rs.)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={eventForm.amount}
                        onChange={(e) => setEventForm({ ...eventForm, amount: e.target.value })}
                        placeholder="0"
                        className="w-full px-3.5 py-2.5 border border-stone-200 rounded-xl text-sm tabular-nums"
                      />
                    </div>
                  </div>

                  {Number(eventForm.amount) > 0 && (
                    <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2.5">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={eventForm.alsoRecordTransaction}
                          onChange={(e) =>
                            setEventForm({ ...eventForm, alsoRecordTransaction: e.target.checked })
                          }
                          className="mt-0.5 rounded border-stone-400 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-xs font-semibold text-stone-700">
                          {eventType === 'SALE'
                            ? t.alsoRecordIncome || 'Also record sale income in Transactions & Buyer Khata'
                            : t.alsoRecordExpense || 'Also record purchase in Transactions & Supplier Khata'}
                        </span>
                      </label>
                      {eventForm.alsoRecordTransaction && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {(['CASH', 'BANK', 'WALLET', 'CREDIT'] as const).map((pm) => (
                            <button
                              type="button"
                              key={pm}
                              onClick={() => setEventForm({ ...eventForm, paymentMethod: pm })}
                              className={`py-1.5 px-2 rounded-lg text-xs font-semibold border ${
                                eventForm.paymentMethod === pm
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-stone-600 border-stone-200'
                              }`}
                            >
                              {pm === 'CASH'
                                ? t.cash || 'Cash'
                                : pm === 'BANK'
                                ? t.bank || 'Bank'
                                : pm === 'WALLET'
                                ? t.wallet || 'Wallet'
                                : t.credit || 'Credit'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                      {t.notes || 'Notes'}
                    </label>
                    <input
                      type="text"
                      value={eventForm.notes}
                      onChange={(e) => setEventForm({ ...eventForm, notes: e.target.value })}
                      placeholder={language === 'ne' ? 'तौल वा थप विवरण...' : 'Weight or additional notes...'}
                      className="w-full px-3.5 py-2 border border-stone-200 rounded-xl text-sm"
                    />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEventTargetBatch(null)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm hover:bg-stone-50"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEvent}
                  className={`px-5 py-2.5 rounded-xl text-white font-semibold text-sm disabled:opacity-50 ${
                    eventType === 'MORTALITY'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : eventType === 'SALE'
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  {isSavingEvent ? t.saving || 'Saving...' : t.save || 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Batch History & Financial Ledger */}
      {activeHistoryBatch && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92dvh] overflow-y-auto shadow-2xl border border-stone-200">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <div>
                <h2 className="text-lg font-bold text-stone-800">{activeHistoryBatch.batchName}</h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {getSpeciesLabel(activeHistoryBatch.species)} · {t.purchasedFromSupplier || 'Supplier'}:{' '}
                  {getSupplierDisplay(activeHistoryBatch)} · {activeHistoryBatch.startDateBS}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleStatus(activeHistoryBatch)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                    activeHistoryBatch.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                      : 'bg-stone-100 text-stone-700 border-stone-200 hover:bg-stone-200'
                  }`}
                >
                  {activeHistoryBatch.status === 'ACTIVE'
                    ? language === 'ne'
                      ? 'सम्पन्न चिन्ह लगाउनुहोस्'
                      : 'Mark Completed'
                    : language === 'ne'
                    ? 'पुन: सक्रिय गर्नुहोस्'
                    : 'Reopen Batch'}
                </button>
                <button
                  onClick={() => setHistoryBatch(null)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Count Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 rounded-xl bg-stone-50 border border-stone-200">
                  <div className="text-xs text-stone-500">{t.initialQuantity || 'Purchased'}</div>
                  <div className="text-lg font-bold text-stone-800 tabular-nums">
                    {(Number(activeHistoryBatch.initialCount) || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200">
                  <div className="text-xs text-sky-700">{t.addedQuantity || 'Added'}</div>
                  <div className="text-lg font-bold text-sky-700 tabular-nums">
                    +{(Number(activeHistoryBatch.addedCount) || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <div className="text-xs text-rose-700">
                    {t.mortalityDead || 'Dead'} ({getMortalityPercent(activeHistoryBatch)}%)
                  </div>
                  <div className="text-lg font-bold text-rose-600 tabular-nums">
                    -{(Number(activeHistoryBatch.deadCount) || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                  <div className="text-xs text-indigo-700">{t.soldQuantity || 'Sold'}</div>
                  <div className="text-lg font-bold text-indigo-700 tabular-nums">
                    -{(Number(activeHistoryBatch.soldCount) || 0).toLocaleString()}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 col-span-2 sm:col-span-1">
                  <div className="text-xs text-emerald-700 font-semibold">{t.currentAlive || 'Alive'}</div>
                  <div className="text-xl font-extrabold text-emerald-700 tabular-nums">
                    {getAliveCount(activeHistoryBatch).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Financial Strip */}
              {(() => {
                const fin = getBatchFinancials(activeHistoryBatch);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 rounded-xl border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-stone-500">{t.totalExpense || 'Total Expense'}</div>
                        <div className="text-base font-bold text-rose-600 tabular-nums">
                          Rs. {fin.totalExpense.toLocaleString()}
                        </div>
                      </div>
                      <ArrowDownRight size={18} className="text-rose-500" />
                    </div>
                    <div className="p-3.5 rounded-xl border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-stone-500">{t.totalIncome || 'Total Income'}</div>
                        <div className="text-base font-bold text-emerald-700 tabular-nums">
                          Rs. {fin.totalIncome.toLocaleString()}
                        </div>
                      </div>
                      <ArrowUpRight size={18} className="text-emerald-600" />
                    </div>
                    <div className="p-3.5 rounded-xl border border-stone-200 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-stone-500">{t.batchProfitLoss || 'Net Profit / Loss'}</div>
                        <div
                          className={`text-base font-extrabold tabular-nums ${
                            fin.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          Rs. {fin.netProfit.toLocaleString()}
                        </div>
                      </div>
                      <TrendingUp size={18} className={fin.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-500'} />
                    </div>
                  </div>
                );
              })()}

              {/* Event Log Table */}
              <div>
                <h3 className="text-sm font-bold text-stone-800 mb-2">
                  {language === 'ne' ? 'संख्या परिवर्तन इतिहास (मृत्यु / थप / बिक्री)' : 'Stock Event History'}
                </h3>
                {activeHistoryLogs.length === 0 ? (
                  <div className="p-6 text-center text-sm text-stone-500 border border-stone-200 rounded-xl">
                    {language === 'ne' ? 'अहिलेसम्म कुनै विवरण दर्ता छैन।' : 'No stock events logged yet.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-stone-200 rounded-xl">
                    <table className="w-full text-left border-collapse [&_th]:border [&_th]:border-stone-200 [&_td]:border [&_td]:border-stone-200 text-xs sm:text-sm">
                      <thead className="bg-stone-50 text-stone-600 text-xs">
                        <tr>
                          <th className="py-2 px-3 w-px whitespace-nowrap">{t.date || 'Date'}</th>
                          <th className="py-2 px-3">{language === 'ne' ? 'प्रकार' : 'Event'}</th>
                          <th className="py-2 px-3 text-right">{language === 'ne' ? 'संख्या' : 'Qty'}</th>
                          <th className="py-2 px-3 text-right">{language === 'ne' ? 'रकम' : 'Amount'}</th>
                          <th className="py-2 px-3">{t.notes || 'Notes'}</th>
                          <th className="py-2 px-3 text-center">{language === 'ne' ? 'हटाउनुहोस्' : 'Revert'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeHistoryLogs.map((l) => (
                          <tr key={l.id}>
                            <td className="py-2 px-3 w-px whitespace-nowrap tabular-nums text-stone-600">{l.dateBS}</td>
                            <td className="py-2 px-3 font-semibold">
                              {l.eventType === 'INITIAL'
                                ? language === 'ne'
                                  ? 'प्रारम्भिक खरिद'
                                  : 'Initial'
                                : l.eventType === 'MORTALITY'
                                ? language === 'ne'
                                  ? 'मृत्यु'
                                  : 'Death'
                                : l.eventType === 'ADDITION'
                                ? language === 'ne'
                                  ? 'थप'
                                  : 'Added'
                                : language === 'ne'
                                ? 'बिक्री'
                                : 'Sold'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold tabular-nums">
                              {l.eventType === 'MORTALITY' || l.eventType === 'SALE' ? `-${l.quantity}` : `+${l.quantity}`}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums">
                              {l.amount ? `Rs. ${l.amount.toLocaleString()}` : '-'}
                            </td>
                            <td className="py-2 px-3 text-stone-600">
                              {l.partyName ? `${l.partyName}${l.notes ? ' · ' : ''}` : ''}
                              {l.notes || (!l.partyName ? '-' : '')}
                            </td>
                            <td className="py-2 px-3 text-center">
                              {l.eventType !== 'INITIAL' && (
                                <button
                                  onClick={() => handleRevertLog(l)}
                                  disabled={revertingLogId === l.id}
                                  title={language === 'ne' ? 'रेकर्ड उल्टाउनुहोस् / हटाउनुहोस्' : 'Revert & delete entry'}
                                  className="p-1 text-stone-400 hover:text-rose-600 rounded"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Delete Batch Confirmation */}
      {deleteTargetBatch && (
        <div className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-stone-200 space-y-4">
            <h3 className="text-lg font-bold text-stone-800">
              {language === 'ne' ? 'ब्याच मेटाउने?' : 'Delete Batch?'}
            </h3>
            <p className="text-sm text-stone-600">
              {language === 'ne'
                ? `के तपाईं "${deleteTargetBatch.batchName}" ब्याच र यसका मृत्यु/बिक्री रेकर्डहरू स्थायी रूपमा मेटाउन चाहनुहुन्छ?`
                : `Are you sure you want to permanently delete "${deleteTargetBatch.batchName}" and its stock event logs?`}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteTargetBatch(null)}
                className="px-4 py-2 rounded-xl border border-stone-200 text-stone-600 font-semibold text-sm"
              >
                {t.cancel || 'Cancel'}
              </button>
              <button
                onClick={handleConfirmDeleteBatch}
                disabled={isDeletingBatch}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm disabled:opacity-50"
              >
                {t.delete || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
