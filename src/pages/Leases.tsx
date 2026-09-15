import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Lease } from '../types';
import NepaliDate from 'nepali-datetime';
import { Plus, Trash2, Map, FileText, Edit2 } from 'lucide-react';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { translations } from '../lib/translations';

export default function Leases() {
  const { farmId, language } = useAppStore();
  const t = translations[language];
  
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const initialForm = { title: '', area: '', ponds: '', lessorName: '', lessorPhone: '', totalAmount: '', startDateBS: new NepaliDate().format('YYYY MMMM DD'), endDateBS: '' };
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);


  useEffect(() => {
    if (!farmId) return;
    const unsub = onSnapshot(query(collection(db, 'leases'), where('farmId', '==', farmId)), snap => {
      const data: Lease[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Lease));
      setLeases(data);
    });
    return () => unsub();
  }, [farmId]);

  
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    try {
      if (editingId) {
        await updateDoc(doc(db, 'leases', editingId), {
          ...formData,
          ponds: Number(formData.ponds),
          totalAmount: Number(formData.totalAmount)
        });
      } else {
        await addDoc(collection(db, 'leases'), {
          farmId,
          ...formData,
          ponds: Number(formData.ponds),
          totalAmount: Number(formData.totalAmount),
          paidAmount: 0
        });
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err) {
      console.error(err);
    }
  };

  const openAddLease = () => {
    setFormData(initialForm);
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEditLease = (lease: Lease) => {
    setFormData({
      title: lease.title,
      area: lease.area,
      ponds: lease.ponds.toString(),
      lessorName: lease.lessorName,
      lessorPhone: lease.lessorPhone || '',
      totalAmount: lease.totalAmount.toString(),
      startDateBS: lease.startDateBS,
      endDateBS: lease.endDateBS
    });
    setEditingId(lease.id);
    setIsModalOpen(true);
  };


  const handleDelete = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) await deleteDoc(doc(db, 'leases', id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-stone-800">{t.leases}</h1>
        <button onClick={openAddLease} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">
          <Plus size={18} />
          <span>{t.addLease}</span>
        </button>
      </div>

      
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm ">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.titleId || 'Title'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.totalArea || 'Area / Ponds'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.lessorName || 'Lessor'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.duration || 'Duration'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.totalLeaseAmount || 'Amount (Rs.)'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600 text-right">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {leases.map(lease => (
                <tr key={lease.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                        <Map size={16} />
                      </div>
                      <span className="font-bold text-stone-800">{lease.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-stone-800">{lease.area}</p>
                    <p className="text-xs text-stone-500">{lease.ponds} {t.numberOfPonds || 'Ponds'}</p>
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-800">
                    {lease.lessorName}
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-800">
                    {lease.startDateBS} - {lease.endDateBS}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-stone-900">
                    Rs. {lease.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end space-x-2">
                      <button className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors" title={t.documents || 'Documents'}>
                        <FileText size={18} />
                      </button>
                      <button onClick={() => openEditLease(lease)} className="text-stone-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title={t.edit || 'Edit'}>
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(lease.id)} className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title={t.delete || 'Delete'}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leases.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-12 text-stone-500 bg-stone-50/50">
                    {t.noActiveLeases || 'No active leases found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">{editingId ? t.edit || "Edit Lease" : t.addLease}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">{t.titleId}</label>
                  <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.totalArea}</label>
                  <input type="text" required value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.numberOfPonds}</label>
                  <input type="number" required value={formData.ponds} onChange={e => setFormData({...formData, ponds: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">{t.lessorName}</label>
                  <input type="text" required value={formData.lessorName} onChange={e => setFormData({...formData, lessorName: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.startDateBS}</label>
                  <NepaliDatePicker value={formData.startDateBS} onChange={val => setFormData({...formData, startDateBS: val})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t.endDateBS}</label>
                  <NepaliDatePicker value={formData.endDateBS} onChange={val => setFormData({...formData, endDateBS: val})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">{t.totalLeaseAmount}</label>
                  <input type="number" required value={formData.totalAmount} onChange={e => setFormData({...formData, totalAmount: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
                </div>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl">{t.cancel}</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700">{t.saveEntry}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
