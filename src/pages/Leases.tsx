import React, { useRef } from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Lease } from '../types';
import NepaliDate from 'nepali-datetime';
import { Plus, Trash2, Map, FileText, Edit2, Upload, Loader2, Eye, X } from 'lucide-react';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { translations } from '../lib/translations';

export default function Leases() {
  const { farmId, language } = useAppStore();
  const t = translations[language];
  
  const [leases, setLeases] = useState<Lease[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const initialForm = { title: '', area: '', ponds: '', lessorName: '', lessorPhone: '', totalAmount: '', startDateBS: new NepaliDate().format('YYYY MMMM DD'), endDateBS: '', documentUrl: '' };
  const [formData, setFormData] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!farmId) return;
    const unsub = onSnapshot(query(collection(db, 'leases'), where('farmId', '==', farmId)), snap => {
      const data: Lease[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Lease));
      setLeases(data);
    });
    return () => unsub();
  }, [farmId]);

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !farmId) return;
    setIsUploading(true);
    try {
      const storageRef = ref(storage, `lease-docs/${farmId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setFormData({ ...formData, documentUrl: url });
    } catch (err) {
      console.error(err);
      alert("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };
  
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
      endDateBS: lease.endDateBS,
      documentUrl: lease.documentUrl || ''
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
                <th className="py-3 px-4 text-sm font-semibold text-stone-600 text-center">{t.documents || 'Document'}</th>
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
                  <td className="py-3 px-4 text-center">
                    {lease.documentUrl ? (
                      <button onClick={() => setPreviewDoc(lease.documentUrl || null)} className="text-blue-600 hover:text-blue-700 bg-blue-50 p-1.5 rounded-lg inline-flex" title="View Document">
                        <Eye size={18} />
                      </button>
                    ) : (
                      <span className="text-stone-300">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-stone-900">
                    Rs. {lease.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end space-x-2">
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
                <div className="col-span-2 border-t border-stone-100 pt-4 mt-2">
                  <label className="block text-sm font-medium mb-2">{t.documents || 'Lease Agreement (PDF/JPG)'}</label>
                  <div className="flex items-center space-x-4">
                    <input type="file" accept=".pdf,image/*" className="hidden" ref={docInputRef} onChange={handleDocUpload} />
                    <button type="button" onClick={() => docInputRef.current?.click()} className="flex items-center space-x-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-medium transition-colors">
                      {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                      <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
                    </button>
                    {formData.documentUrl && (
                      <div className="flex items-center space-x-2 text-sm text-green-600 font-medium bg-green-50 px-3 py-1.5 rounded-lg">
                        <FileText size={16} />
                        <span>Document Attached</span>
                        <button type="button" onClick={() => setFormData({...formData, documentUrl: ''})} className="text-red-500 hover:text-red-600 ml-2" title="Remove">✕</button>
                      </div>
                    )}
                  </div>
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
      {/* Document Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 bg-stone-900/80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl w-full max-w-4xl h-[80vh] flex flex-col shadow-xl">
            <div className="p-4 border-b border-stone-200 flex justify-between items-center bg-stone-50 rounded-t-2xl">
              <h3 className="font-bold text-stone-800 flex items-center gap-2"><FileText size={18} /> Document Preview</h3>
              <div className="flex space-x-2">
                <a href={previewDoc} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                  Open in New Tab
                </a>
                <button onClick={() => setPreviewDoc(null)} className="p-1.5 text-stone-500 hover:bg-stone-200 rounded-lg"><X size={20}/></button>
              </div>
            </div>
            <div className="flex-1 bg-stone-100 p-4 rounded-b-2xl overflow-hidden">
              <iframe src={previewDoc} className="w-full h-full rounded-lg border border-stone-200 bg-white" title="Document Preview" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
