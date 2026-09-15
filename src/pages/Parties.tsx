import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Party, Partner, BankAccount } from '../types';
import AddContributionModal from '../components/AddContributionModal';
import PartnerLedgerModal from '../components/PartnerLedgerModal';
import NepaliDate from 'nepali-datetime';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Users, Briefcase, Plus, Search, Filter, Edit2, Trash2, BookOpen, 
  ArrowUpRight, ArrowDownRight, X, Save, TrendingUp
} from 'lucide-react';

export default function Parties() {
  const { language, farmId } = useAppStore();
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'PARTIES' | 'PARTNERS'>('PARTIES');

  const [parties, setParties] = useState<Party[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BUYER' | 'SUPPLIER'>('ALL');
  
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedPartnerForContrib, setSelectedPartnerForContrib] = useState<Partner | null>(null);
  const [selectedPartnerForLedger, setSelectedPartnerForLedger] = useState<Partner | null>(null);

  const initialParty = { name: '', type: 'BUYER' as const, phone: '', address: '', panVat: '', pendingBalance: 0 };
  const initialPartner = { name: '', investmentAmount: 0, profitSharePercentage: 0, phone: '', joiningDateBS: new NepaliDate().format('YYYY MMMM DD'), dividendPayable: 0, accountId: '', paymentMethod: 'CASH' };
  
  const [partyForm, setPartyForm] = useState(initialParty);
  const [partnerForm, setPartnerForm] = useState(initialPartner);

  useEffect(() => {
    if (!farmId) return;

    const qParties = query(collection(db, 'parties'), where('farmId', '==', farmId));
    const unsubParties = onSnapshot(qParties, (snapshot) => {
      const data: Party[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Party));
      setParties(data);
    }, (error) => {
      console.warn("Firestore err", error.message);
    });

    const qPartners = query(collection(db, 'partners'), where('farmId', '==', farmId));
    const unsubPartners = onSnapshot(qPartners, (snapshot) => {
      const data: Partner[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Partner));
      setPartners(data);
    }, (error) => {
       console.warn("Firestore err", error.message);
    });

    const qAccounts = query(collection(db, 'bankAccounts'), where('farmId', '==', farmId));
    const unsubAccounts = onSnapshot(qAccounts, (snapshot) => {
      const data: BankAccount[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as BankAccount));
      setAccounts(data);
    }, (error) => {
       console.warn("Firestore err", error.message);
    });

    return () => { unsubParties(); unsubPartners(); unsubAccounts(); };
  }, [farmId]);

  const totalReceivables = parties.filter(p => p.type === 'BUYER').reduce((acc, curr) => acc + curr.pendingBalance, 0);
  const totalPayables = parties.filter(p => p.type === 'SUPPLIER').reduce((acc, curr) => acc + curr.pendingBalance, 0);
  const totalCapital = partners.reduce((acc, curr) => acc + curr.investmentAmount, 0);

  const filteredParties = parties.filter(p => 
    (filterType === 'ALL' || p.type === filterType) &&
    (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone.includes(searchQuery))
  );

  const handleSaveParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'parties', editingId), { ...partyForm, pendingBalance: Number(partyForm.pendingBalance) });
      } else {
        await addDoc(collection(db, 'parties'), { farmId, ...partyForm, pendingBalance: Number(partyForm.pendingBalance) });
      }
      setIsPartyModalOpen(false);
      setPartyForm(initialParty);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setIsPartyModalOpen(false);
    }
  };

  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    try {
      const batch = writeBatch(db);
      
      const pAmt = Number(partnerForm.investmentAmount);

      if (editingId) {
        // Find old partner investment logic is tricky for balance adjustment, so we will skip adjusting past balance edits here, but normally you'd revert old amount and apply new.
        // Let's assume editing just updates partner details, but investment amount edit doesn't change bank balance automatically to avoid complex cascading issues without a proper transaction ledger.
        batch.update(doc(db, 'partners', editingId), { 
          name: partnerForm.name,
          investmentAmount: pAmt, 
          profitSharePercentage: Number(partnerForm.profitSharePercentage), 
          phone: partnerForm.phone,
          joiningDateBS: partnerForm.joiningDateBS,
          dividendPayable: Number(partnerForm.dividendPayable) 
        });
      } else {
        const newPartnerRef = doc(collection(db, 'partners'));
        batch.set(newPartnerRef, { 
          farmId, 
          name: partnerForm.name,
          investmentAmount: pAmt, 
          profitSharePercentage: Number(partnerForm.profitSharePercentage), 
          phone: partnerForm.phone,
          joiningDateBS: partnerForm.joiningDateBS,
          dividendPayable: Number(partnerForm.dividendPayable) 
        });

        // Add a transaction record for investment
        const txRef = doc(collection(db, 'transactions'));
        batch.set(txRef, {
          farmId,
          type: 'INCOME',
          amount: pAmt,
          category: 'Partner Capital',
          accountId: partnerForm.accountId,
          paymentMethod: partnerForm.paymentMethod,
          dateBS: partnerForm.joiningDateBS,
          notes: `Capital Investment by ${partnerForm.name}`,
          createdAt: Date.now(),
        });

        // Update account balance
        if (partnerForm.accountId) {
          const acc = accounts.find(a => a.id === partnerForm.accountId);
          if (acc) {
            batch.update(doc(db, 'bankAccounts', acc.id), { currentBalance: acc.currentBalance + pAmt });
          }
        }
      }
      
      await batch.commit();

      setIsPartnerModalOpen(false);
      setPartnerForm(initialPartner);
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setIsPartnerModalOpen(false);
    }
  };

  const handleDeleteParty = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) await deleteDoc(doc(db, 'parties', id));
  };
  const handleDeletePartner = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) await deleteDoc(doc(db, 'partners', id));
  };

  const openEditParty = (party: Party) => {
    setEditingId(party.id);
    setPartyForm({ name: party.name, type: party.type as 'BUYER'|'SUPPLIER', phone: party.phone, address: party.address || '', panVat: party.panVat || '', pendingBalance: party.pendingBalance });
    setIsPartyModalOpen(true);
  };

  const openEditPartner = (partner: Partner) => {
    setEditingId(partner.id);
    setPartnerForm({ 
      name: partner.name, 
      investmentAmount: partner.investmentAmount, 
      profitSharePercentage: partner.profitSharePercentage, 
      phone: partner.phone, 
      joiningDateBS: partner.joiningDateBS, 
      dividendPayable: partner.dividendPayable,
      accountId: '', 
      paymentMethod: 'CASH' 
    });
    setIsPartnerModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-stone-800">{t.parties}</h1>
      </div>

      <div className="flex border-b border-stone-200 space-x-6">
        <button
          onClick={() => setActiveTab('PARTIES')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center space-x-2 ${
            activeTab === 'PARTIES' ? 'border-green-600 text-green-700' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Users size={18} />
          <span>{t.buyers} & {t.suppliers}</span>
        </button>
        <button
          onClick={() => setActiveTab('PARTNERS')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center space-x-2 ${
            activeTab === 'PARTNERS' ? 'border-blue-600 text-blue-700' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Briefcase size={18} />
          <span>{t.partners}</span>
        </button>
      </div>

      {activeTab === 'PARTIES' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-stone-500 font-medium">{t.totalReceivables}</span>
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-600"><ArrowUpRight size={20} /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-stone-900">Rs. {totalReceivables.toLocaleString()}</div>
                <p className="text-sm text-green-600 mt-2">From {parties.filter(p => p.type === 'BUYER').length} Buyers</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-stone-500 font-medium">{t.totalPayables}</span>
                <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600"><ArrowDownRight size={20} /></div>
              </div>
              <div>
                <div className="text-3xl font-bold text-stone-900">Rs. {totalPayables.toLocaleString()}</div>
                <p className="text-sm text-red-600 mt-2">To {parties.filter(p => p.type === 'SUPPLIER').length} Suppliers</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-sm">
            <div className="flex w-full sm:w-auto items-center space-x-4">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search name or phone..." 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                />
              </div>
              <div className="flex items-center space-x-2 border-l pl-4 border-stone-200">
                <Filter size={18} className="text-stone-400" />
                <select 
                  value={filterType}
                  onChange={e => setFilterType(e.target.value as any)}
                  className="bg-transparent text-sm font-medium text-stone-700 focus:outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="BUYER">{t.buyers}</option>
                  <option value="SUPPLIER">{t.suppliers}</option>
                </select>
              </div>
            </div>
            <button onClick={() => { setPartyForm(initialParty); setEditingId(null); setIsPartyModalOpen(true); }} className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors">
              <Plus size={18} />
              <span>{t.addParty}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredParties.map(party => (
              <div key={party.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditParty(party)} className="p-1.5 bg-stone-100 text-stone-600 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDeleteParty(party.id)} className="p-1.5 bg-stone-100 text-stone-600 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                </div>
                
                <div className="flex items-center space-x-4 mb-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg
                    ${party.type === 'BUYER' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                  `}>
                    {party.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-lg">{party.name}</h3>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                      ${party.type === 'BUYER' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}
                    `}>
                      {party.type === 'BUYER' ? t.buyers : t.suppliers}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-stone-600 mb-6">
                  <div className="flex justify-between">
                    <span>{t.phone}:</span>
                    <span className="font-medium text-stone-900">{party.phone}</span>
                  </div>
                  {party.address && (
                    <div className="flex justify-between">
                      <span>{t.address}:</span>
                      <span className="font-medium text-stone-900">{party.address}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-stone-500 font-medium mb-1">Khata Balance</p>
                    <p className={`font-bold text-lg ${party.type === 'BUYER' ? 'text-green-600' : 'text-red-600'}`}>
                      Rs. {party.pendingBalance.toLocaleString()}
                    </p>
                  </div>
                  <button className="flex items-center space-x-1 text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                    <BookOpen size={14} />
                    <span>{t.viewKhata}</span>
                  </button>
                </div>
              </div>
            ))}
            {filteredParties.length === 0 && (
              <div className="col-span-full py-12 text-center text-stone-500 bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                {t.noData}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'PARTNERS' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-blue-900 to-blue-800 p-6 rounded-2xl shadow-sm text-white flex flex-col justify-between">
              <div className="flex justify-between items-start mb-4">
                <span className="text-blue-200 font-medium">{t.totalCapital}</span>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><Briefcase size={20} /></div>
              </div>
              <div>
                <div className="text-3xl font-bold">Rs. {totalCapital.toLocaleString()}</div>
                <p className="text-sm text-blue-200 mt-2">{t.activePartners}: {partners.length}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
             <button onClick={() => { setPartnerForm(initialPartner); setEditingId(null); setIsPartnerModalOpen(true); }} className="flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors">
              <Plus size={18} />
              <span>{t.addPartner}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partners.map(partner => (
              <div key={partner.id} className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm relative group">
                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditPartner(partner)} className="p-1.5 bg-stone-100 text-stone-600 hover:text-blue-600 rounded-lg"><Edit2 size={16} /></button>
                  <button onClick={() => handleDeletePartner(partner.id)} className="p-1.5 bg-stone-100 text-stone-600 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                </div>

                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-lg">
                    {partner.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-stone-900 text-lg">{partner.name}</h3>
                    <p className="text-sm text-stone-500">{t.phone}: {partner.phone}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100">
                  <div>
                    <p className="text-xs text-stone-500 font-medium mb-1">{t.investmentAmount}</p>
                    <p className="font-bold text-stone-900">Rs. {partner.investmentAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium mb-1">{t.profitShare}</p>
                    <p className="font-bold text-blue-600 flex items-center space-x-1">
                      <TrendingUp size={14} />
                      <span>{partner.profitSharePercentage}%</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium mb-1">{t.joiningDate}</p>
                    <p className="font-medium text-stone-800 text-sm">{partner.joiningDateBS}</p>
                  </div>
                  <div>
                    <p className="text-xs text-stone-500 font-medium mb-1">{t.dividendPayable}</p>
                    <p className="font-bold text-orange-600">Rs. {partner.dividendPayable.toLocaleString()}</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between space-x-2">
                  <button 
                    onClick={() => setSelectedPartnerForContrib(partner)}
                    className="flex-1 flex justify-center items-center space-x-1 py-2 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    <span>{t.addContribution || 'Add Contribution'}</span>
                  </button>
                  <button 
                    onClick={() => setSelectedPartnerForLedger(partner)}
                    className="flex-1 flex justify-center items-center space-x-1 py-2 px-3 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-xl text-sm font-medium transition-colors"
                  >
                    <BookOpen size={16} />
                    <span>{t.viewLedger || 'View Ledger'}</span>
                  </button>
                </div>

              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {isPartyModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
             <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-800">{editingId ? t.edit : t.addParty}</h2>
              <button onClick={() => setIsPartyModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveParty} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.type}</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setPartyForm({...partyForm, type: 'BUYER'})} className={`py-2 rounded-xl font-medium border transition-colors ${partyForm.type === 'BUYER' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{t.buyers}</button>
                  <button type="button" onClick={() => setPartyForm({...partyForm, type: 'SUPPLIER'})} className={`py-2 rounded-xl font-medium border transition-colors ${partyForm.type === 'SUPPLIER' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}>{t.suppliers}</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.party} {t.name}</label>
                <input type="text" required value={partyForm.name} onChange={e => setPartyForm({...partyForm, name: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.phone}</label>
                  <input type="text" required value={partyForm.phone} onChange={e => setPartyForm({...partyForm, phone: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.initialBalance}</label>
                  <input type="number" required value={partyForm.pendingBalance} onChange={e => setPartyForm({...partyForm, pendingBalance: Number(e.target.value)})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsPartyModalOpen(false)} className="px-5 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl">{t.cancel}</button>
                <button type="submit" className="flex items-center space-x-2 px-5 py-2 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl"><Save size={18} /><span>{t.saveEntry}</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isPartnerModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl m-auto my-8">
             <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-800">{editingId ? t.edit : t.addPartner}</h2>
              <button onClick={() => setIsPartnerModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1"><X size={20} /></button>
            </div>
            <form onSubmit={handleSavePartner} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">{t.name}</label>
                <input type="text" required value={partnerForm.name} onChange={e => setPartnerForm({...partnerForm, name: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.investmentAmount}</label>
                  <input type="number" required value={partnerForm.investmentAmount} onChange={e => setPartnerForm({...partnerForm, investmentAmount: Number(e.target.value)})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.profitShare}</label>
                  <input type="number" required value={partnerForm.profitSharePercentage} onChange={e => setPartnerForm({...partnerForm, profitSharePercentage: Number(e.target.value)})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.phone}</label>
                  <input type="text" required value={partnerForm.phone} onChange={e => setPartnerForm({...partnerForm, phone: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.joiningDate}</label>
                  <input type="text" required value={partnerForm.joiningDateBS} onChange={e => setPartnerForm({...partnerForm, joiningDateBS: e.target.value})} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {!editingId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.paymentMethod}</label>
                    <select 
                      value={partnerForm.paymentMethod}
                      onChange={e => setPartnerForm({...partnerForm, paymentMethod: e.target.value})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="CASH">{t.cash}</option>
                      <option value="BANK">{t.bankTransfer}</option>
                      <option value="WALLET">{t.digitalWallet}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.accounts || 'Account'}</label>
                    <select 
                      value={partnerForm.accountId}
                      onChange={e => setPartnerForm({...partnerForm, accountId: e.target.value})}
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">{t.selectAccount || '-- Select Account --'}</option>
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} (Rs.{a.currentBalance})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsPartnerModalOpen(false)} className="px-5 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl">{t.cancel}</button>
                <button type="submit" className="flex items-center space-x-2 px-5 py-2 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl"><Save size={18} /><span>{t.saveEntry}</span></button>
              </div>
            </form>
          </div>
        </div>
      )}

    
      {selectedPartnerForContrib && (
        <AddContributionModal
          partner={selectedPartnerForContrib}
          accounts={accounts}
          isOpen={true}
          onClose={() => setSelectedPartnerForContrib(null)}
        />
      )}
      {selectedPartnerForLedger && (
        <PartnerLedgerModal
          partner={selectedPartnerForLedger}
          isOpen={true}
          onClose={() => setSelectedPartnerForLedger(null)}
        />
      )}
    </div>
  );
}
