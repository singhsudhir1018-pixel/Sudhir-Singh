import React from 'react';
import { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Plus, Check, Play, Clock, Edit2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Task } from '../types';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from '../components/NepaliDatePicker';

export default function Tasks() {
  const { language, farmId } = useAppStore();
  const t = translations[language];

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', category: '', dueDateBS: new NepaliDate().format('YYYY MMMM DD') });

  useEffect(() => {
    if (!farmId) return;
    const unsub = onSnapshot(query(collection(db, 'tasks'), where('farmId', '==', farmId)), snap => {
      const data: Task[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Task));
      data.sort((a, b) => (a.dueDateBS || '').localeCompare(b.dueDateBS || ''));
      setTasks(data);
    });
    return () => unsub();
  }, [farmId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        farmId,
        ...formData,
        status: 'TODO'
      });
      setIsModalOpen(false);
      setFormData({ title: '', category: '', dueDateBS: new NepaliDate().format('YYYY MMMM DD') });
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      await updateDoc(doc(db, 'tasks', id), { status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm(t.deleteConfirmation)) {
      await deleteDoc(doc(db, 'tasks', id));
    }
  };

  const groupedTasks = {
    TODO: tasks.filter(t => t.status === 'TODO'),
    IN_PROGRESS: tasks.filter(t => t.status === 'IN_PROGRESS'),
    COMPLETED: tasks.filter(t => t.status === 'COMPLETED')
  };
  
  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      'Feeding': t.feeding,
      'Medication': t.medication,
      'Cleaning': t.cleaning,
      'Harvest': t.harvest,
      'General': t.generalOp,
    };
    return map[cat] || cat;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-stone-800">{t.tasks}</h1>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700">
          <Plus size={18} />
          <span>{t.addTask}</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
              <th className="p-4">{t.taskDetails || 'Task'}</th>
              <th className="p-4">{t.category || 'Category'}</th>
              <th className="p-4">{t.dueDateBS || 'Due Date'}</th>
              <th className="p-4">{t.status || 'Status'}</th>
              <th className="p-4 text-center">{t.actions || 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-stone-500">
                  {t.noData || 'No tasks found'}
                </td>
              </tr>
            ) : (
              tasks.map(task => (
                <tr key={task.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="p-4 text-stone-800 font-medium">
                    <span className={task.status === 'COMPLETED' ? 'line-through text-stone-400' : ''}>
                      {task.title}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-medium bg-stone-100 text-stone-700 px-2 py-1 rounded-lg">
                      {getCategoryLabel(task.category)}
                    </span>
                  </td>
                  <td className="p-4 text-stone-600">{task.dueDateBS}</td>
                  <td className="p-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                      task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      task.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {task.status === 'TODO' ? t.todo : task.status === 'IN_PROGRESS' ? t.inProgress : t.completed}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center space-x-2">
                      {task.status === 'TODO' && (
                        <button onClick={() => updateStatus(task.id, 'IN_PROGRESS')} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50" title={t.start || 'Start'}>
                          <Play size={16} />
                        </button>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <button onClick={() => updateStatus(task.id, 'COMPLETED')} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title={t.completedStatus || 'Complete'}>
                          <Check size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm  shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4">{t.addTask}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t.category}</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} required className="w-full px-4 py-2 border rounded-xl bg-white">
                  <option value="">{t.selectCategory}</option>
                  <option value="Feeding">{t.feeding}</option>
                  <option value="Medication">{t.medication}</option>
                  <option value="Cleaning">{t.cleaning}</option>
                  <option value="Harvest">{t.harvest}</option>
                  <option value="General">{t.generalOp}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.taskDetails}</label>
                <input type="text" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required className="w-full px-4 py-2 border rounded-xl" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t.dueDateBS}</label>
                <NepaliDatePicker value={formData.dueDateBS} onChange={val => setFormData({...formData, dueDateBS: val})} />
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
