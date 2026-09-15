import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import CategorySelect from '../components/CategorySelect';
import { translations } from '../lib/translations';
import { Plus, Save, X, Edit2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { InventoryItem, Category } from '../types';
import NepaliDatePicker from '../components/NepaliDatePicker';

export default function Inventory() {
  const { language, farmId } = useAppStore();
  const t = translations[language];

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const initialForm = {
    itemName: '',
    category: '',
    subCategory: '',
    currentStock: '',
    unit: 'kg',
    minThreshold: '',
    unitPrice: '',
    expiryDateBS: '',
  };
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!farmId) return;

    const unsubInv = onSnapshot(query(collection(db, 'inventory'), where('farmId', '==', farmId)), snap => {
      const data: InventoryItem[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as InventoryItem));
      setInventory(data);
    });

    const unsubCats = onSnapshot(query(collection(db, 'categories'), where('farmId', '==', farmId)), snap => {
      const data: Category[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Category));
      setCategories(data);
    });

    return () => { unsubInv(); unsubCats(); };
  }, [farmId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;

    const payload = {
      farmId,
      itemName: formData.itemName,
      category: formData.category,
      subCategory: formData.subCategory,
      currentStock: Number(formData.currentStock),
      unit: formData.unit,
      minThreshold: Number(formData.minThreshold),
      unitPrice: formData.unitPrice ? Number(formData.unitPrice) : 0,
      expiryDateBS: formData.expiryDateBS,
    };

    try {
      if (editingId) {
        await updateDoc(doc(db, 'inventory', editingId), payload);
      } else {
        await addDoc(collection(db, 'inventory'), payload);
      }
      setIsModalOpen(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err) {
      console.error("Save failed", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) {
      try {
        await deleteDoc(doc(db, 'inventory', id));
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setFormData({
      itemName: item.itemName,
      category: item.category,
      subCategory: item.subCategory || '',
      currentStock: item.currentStock.toString(),
      unit: item.unit,
      minThreshold: item.minThreshold.toString(),
      unitPrice: item.unitPrice ? item.unitPrice.toString() : '',
      expiryDateBS: item.expiryDateBS || '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-stone-800">{t.inventory}</h1>
        <button 
          onClick={() => { setFormData(initialForm); setEditingId(null); setIsModalOpen(true); }}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors"
        >
          <Plus size={18} />
          <span className="font-medium">{t.addItem}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm  overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
              <th className="p-4 w-16">{t.sn}</th>
              <th className="p-4">{t.itemName}</th>
              <th className="p-4">{t.category}</th>
              <th className="p-4 text-right">{t.currentStock}</th>
              <th className="p-4 text-right">{t.minThreshold}</th>
              <th className="p-4 text-center">{t.status}</th>
              <th className="p-4 text-center">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {inventory.map((item, index) => {
              const isLowStock = item.currentStock < item.minThreshold;
              return (
                <tr key={item.id} className={`border-b border-stone-100 hover:bg-stone-50 ${isLowStock ? 'bg-red-50/20' : ''}`}>
                  <td className="p-4 text-stone-600">{index + 1}</td>
                  <td className="p-4 font-medium text-stone-800">
                    <div>{item.itemName}</div>
                    {item.expiryDateBS && <div className="text-xs text-stone-500 font-normal">Exp: {item.expiryDateBS}</div>}
                  </td>
                  <td className="p-4 text-stone-600">{item.category}</td>
                  <td className={`p-4 text-right font-medium ${isLowStock ? 'text-red-600' : 'text-stone-900'}`}>
                    {item.currentStock} {item.unit}
                  </td>
                  <td className="p-4 text-right text-stone-600">
                    {item.minThreshold} {item.unit}
                  </td>
                  <td className="p-4 text-center">
                    {isLowStock ? (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {t.lowStock}
                      </span>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        {t.safe}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex justify-center items-center space-x-2">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {inventory.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-500">{t.noData}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl  shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-stone-800">{editingId ? t.edit : t.addItem}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.itemName}</label>
                  <input
                    type="text"
                    value={formData.itemName}
                    onChange={e => setFormData({...formData, itemName: e.target.value})}
                    required
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <CategorySelect 
                  type="INVENTORY"
                  selectedCategoryName={formData.category}
                  selectedSubCategoryName={formData.subCategory}
                  onCategoryChange={(val) => setFormData(prev => ({...prev, category: val}))}
                  onSubCategoryChange={(val) => setFormData(prev => ({...prev, subCategory: val}))}
                  required
                />

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.currentStock}</label>
                  <input 
                    type="number" 
                    value={formData.currentStock}
                    onChange={e => setFormData({...formData, currentStock: e.target.value})}
                    required
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.unit}</label>
                  <select 
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    required
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="kg">kg</option>
                    <option value="liter">liter</option>
                    <option value="pieces">pieces</option>
                    <option value="bags">bags</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.minThreshold}</label>
                  <input 
                    type="number" 
                    value={formData.minThreshold}
                    onChange={e => setFormData({...formData, minThreshold: e.target.value})}
                    required
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.unitPrice} (Optional)</label>
                  <input 
                    type="number" 
                    value={formData.unitPrice}
                    onChange={e => setFormData({...formData, unitPrice: e.target.value})}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.expiryDate} (Optional)</label>
                  <NepaliDatePicker value={formData.expiryDateBS} onChange={(val) => setFormData({...formData, expiryDateBS: val})} />
                </div>
              </div>

              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors">
                  {t.cancel}
                </button>
                <button type="submit" className="flex items-center space-x-2 px-5 py-2.5 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl transition-colors">
                  <Save size={18} />
                  <span>{t.saveEntry}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
