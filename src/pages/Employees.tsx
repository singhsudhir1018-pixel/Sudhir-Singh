import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { collection, onSnapshot, query, where, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee } from '../types';
import NepaliDate from 'nepali-datetime';
import { Plus, Trash2, UserCircle } from 'lucide-react';
import NepaliDatePicker from '../components/NepaliDatePicker';
import { translations } from '../lib/translations';

export default function Employees() {
  const { farmId, language } = useAppStore();
  const t = translations[language];

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', role: '', type: 'PERMANENT', rate: '', joinDateBS: new NepaliDate().format('YYYY MMMM DD') });

  useEffect(() => {
    if (!farmId) return;
    const unsub = onSnapshot(query(collection(db, 'employees'), where('farmId', '==', farmId)), snap => {
      const data: Employee[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Employee));
      setEmployees(data);
    });
    return () => unsub();
  }, [farmId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    try {
      await addDoc(collection(db, 'employees'), {
        farmId,
        ...formData,
        rate: Number(formData.rate),
        status: 'ACTIVE'
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) await deleteDoc(doc(db, 'employees', id));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-stone-800">{t.employees}</h1>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">
          <Plus size={18} />
          <span>{t.addEmployee}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm ">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
              <th className="p-4">{t.name}</th>
              <th className="p-4">{t.role}</th>
              <th className="p-4">{t.empType}</th>
              <th className="p-4 text-right">{t.salaryRate}</th>
              <th className="p-4 text-center">{t.status}</th>
              <th className="p-4 text-center">{t.actions}</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id} className="border-b border-stone-100 hover:bg-stone-50">
                <td className="p-4 font-medium text-stone-800 flex items-center space-x-3">
                  <UserCircle className="text-stone-400" size={24} />
                  <span>{emp.name}</span>
                </td>
                <td className="p-4 text-stone-600">{emp.role}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${emp.type === 'PERMANENT' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}`}>
                    {emp.type === 'PERMANENT' ? t.permanent : t.dailyWage}
                  </span>
                </td>
                <td className="p-4 text-right font-medium">Rs. {emp.rate.toLocaleString()}</td>
                <td className="p-4 text-center">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">{t.activeStatus}</span>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => handleDelete(emp.id)} className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-stone-500">{t.noEmployees}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <h2 className="text-xl font-bold mb-4">{t.addEmployee}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t.name}</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.role}</label>
                <input type="text" required value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.empType}</label>
                <select required value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full px-4 py-2 border rounded-xl">
                  <option value="PERMANENT">{t.permanent}</option>
                  <option value="DAILY_WAGE">{t.dailyWage}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.salaryRate}</label>
                <input type="number" required value={formData.rate} onChange={e => setFormData({...formData, rate: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />
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
