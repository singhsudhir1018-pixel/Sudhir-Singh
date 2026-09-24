import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Plus, Check, Play, Clock, Edit2, Trash2, Tag, Flag, User, AlertCircle } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Task, Employee } from '../types';
import NepaliDate from 'nepali-datetime';
import NepaliDatePicker from '../components/NepaliDatePicker';
import EditTaskModal from '../components/EditTaskModal';

export default function Tasks() {
  const { language, farmId } = useAppStore();
  const t = translations[language];

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);

  const [formData, setFormData] = useState({ 
    title: '', 
    description: '',
    category: 'General', 
    priority: 'MEDIUM' as 'HIGH' | 'MEDIUM' | 'LOW',
    dueDateBS: new NepaliDate().format('YYYY MMMM DD'),
    dueTime: '',
    assignedWorker: '',
  });

  // Real-time tasks subscription
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

  // Load farm employees
  useEffect(() => {
    if (!farmId) return;
    const loadEmps = async () => {
      try {
        const q = query(collection(db, 'employees'), where('farmId', '==', farmId));
        const snap = await getDocs(q);
        const emps: Employee[] = [];
        snap.forEach(d => emps.push({ id: d.id, ...d.data() } as Employee));
        setEmployees(emps);
      } catch (err) {
        console.error("Error loading employees:", err);
      }
    };
    loadEmps();
  }, [farmId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !formData.title.trim()) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        farmId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        priority: formData.priority,
        dueDateBS: formData.dueDateBS,
        dueTime: formData.dueTime,
        assignedWorker: formData.assignedWorker.trim(),
        status: 'TODO',
        createdAt: Date.now()
      });
      setIsModalOpen(false);
      setFormData({ 
        title: '', 
        description: '',
        category: 'General', 
        priority: 'MEDIUM',
        dueDateBS: new NepaliDate().format('YYYY MMMM DD'),
        dueTime: '',
        assignedWorker: '',
      });
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED') => {
    try {
      await updateDoc(doc(db, 'tasks', id), { status, updatedAt: Date.now() });
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTaskId) return;
    try {
      await deleteDoc(doc(db, 'tasks', deleteTaskId));
      setDeleteTaskId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const getCategoryLabel = (cat: string) => {
    const map: Record<string, string> = {
      'Feeding': t.feeding || 'Feeding',
      'Medication': t.medication || 'Medication',
      'Cleaning': t.cleaning || 'Cleaning',
      'Harvest': t.harvest || 'Harvest',
      'General': t.generalOp || 'General',
      'Irrigation': language === 'ne' ? 'सिँचाइ' : 'Irrigation',
      'Maintenance': language === 'ne' ? 'मर्मत' : 'Maintenance'
    };
    return map[cat] || cat;
  };

  const getPriorityBadge = (p?: string) => {
    switch (p) {
      case 'HIGH':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-red-100 text-red-700">
            {t.priorityHigh || 'High'}
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-100 text-emerald-700">
            {t.priorityLow || 'Low'}
          </span>
        );
      case 'MEDIUM':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-100 text-amber-700">
            {t.priorityMedium || 'Medium'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{t.tasks}</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            {language === 'ne' 
              ? 'दैनिक फार्म कार्य, जिम्मेवारी र प्राथमिकता व्यवस्थापन' 
              : 'Daily farm operations, worker assignments, and scheduling'}
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 font-semibold shadow-sm transition-colors text-sm"
        >
          <Plus size={18} />
          <span>{t.addTask}</span>
        </button>
      </div>

      {/* Tasks Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[850px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-semibold text-xs uppercase tracking-wider">
              <th className="p-4">{t.taskDetails || 'Task'}</th>
              <th className="p-4">{t.category || 'Category'}</th>
              <th className="p-4">{t.priority || 'Priority'}</th>
              <th className="p-4">{t.assignedWorker || 'Assignee'}</th>
              <th className="p-4">{t.dueDateBS || 'Due Date'}</th>
              <th className="p-4">{t.status || 'Status'}</th>
              <th className="p-4 text-center">{t.actions || 'Actions'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-sm">
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center text-stone-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                  {t.noData || 'No tasks found. Click "+ Add Task" to create one.'}
                </td>
              </tr>
            ) : (
              tasks.map(task => (
                <tr key={task.id} className="hover:bg-stone-50/80 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-stone-800">
                      <span className={task.status === 'COMPLETED' ? 'line-through text-stone-400 font-normal' : ''}>
                        {task.title}
                      </span>
                    </div>
                    {task.description && (
                      <p className="text-xs text-stone-500 mt-0.5 line-clamp-1">
                        {task.description}
                      </p>
                    )}
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-medium bg-stone-100 text-stone-700 px-2.5 py-1 rounded-lg">
                      {getCategoryLabel(task.category)}
                    </span>
                  </td>
                  <td className="p-4">
                    {getPriorityBadge(task.priority)}
                  </td>
                  <td className="p-4">
                    {task.assignedWorker ? (
                      <span className="inline-flex items-center space-x-1 text-xs text-stone-700 font-medium bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                        <User size={12} className="text-emerald-600" />
                        <span>{task.assignedWorker}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-stone-400 italic">-</span>
                    )}
                  </td>
                  <td className="p-4 text-stone-600">
                    <div className="font-medium text-xs">{task.dueDateBS}</div>
                    {task.dueTime && (
                      <div className="text-[11px] text-stone-400 flex items-center space-x-1 mt-0.5">
                        <Clock size={11} />
                        <span>{task.dueTime}</span>
                      </div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg inline-flex items-center space-x-1 ${
                      task.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                      task.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        task.status === 'COMPLETED' ? 'bg-emerald-600' :
                        task.status === 'IN_PROGRESS' ? 'bg-amber-600' : 'bg-blue-600'
                      }`}></span>
                      <span>
                        {task.status === 'TODO' ? (t.todo || 'To Do') : task.status === 'IN_PROGRESS' ? (t.inProgress || 'In Progress') : (t.completed || 'Completed')}
                      </span>
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center space-x-1.5">
                      {/* Status toggle actions */}
                      {task.status === 'TODO' && (
                        <button 
                          onClick={() => updateStatus(task.id, 'IN_PROGRESS')} 
                          className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors" 
                          title={t.start || 'Start'}
                        >
                          <Play size={16} />
                        </button>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <button 
                          onClick={() => updateStatus(task.id, 'COMPLETED')} 
                          className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors" 
                          title={t.completed || 'Complete'}
                        >
                          <Check size={16} />
                        </button>
                      )}

                      {/* EDIT BUTTON (PENCIL ICON) */}
                      <button 
                        onClick={() => setEditingTask(task)} 
                        className="p-1.5 rounded-lg text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors" 
                        title={t.editTask || 'Edit Task'}
                      >
                        <Edit2 size={16} />
                      </button>

                      {/* DELETE BUTTON */}
                      <button 
                        onClick={() => setDeleteTaskId(task.id)} 
                        className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors" 
                        title="Delete"
                      >
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

      {/* ADD TASK MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl p-6 border border-stone-100 my-8">
            <h2 className="text-xl font-bold mb-4 text-stone-800">{t.addTask}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">{t.taskTitle} *</label>
                <input 
                  type="text" 
                  value={formData.title} 
                  onChange={e => setFormData({...formData, title: e.target.value})} 
                  placeholder={language === 'ne' ? 'कार्यको शीर्षक...' : 'Task title...'}
                  required 
                  className="w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">{t.taskDescription}</label>
                <textarea 
                  rows={2}
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder={language === 'ne' ? 'थप विवरण वा निर्देशन...' : 'Notes or instructions...'}
                  className="w-full px-4 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-sm resize-none" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">{t.category}</label>
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})} 
                    className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm"
                  >
                    <option value="Feeding">{t.feeding}</option>
                    <option value="Medication">{t.medication}</option>
                    <option value="Cleaning">{t.cleaning}</option>
                    <option value="Harvest">{t.harvest}</option>
                    <option value="Irrigation">{language === 'ne' ? 'सिँचाइ' : 'Irrigation'}</option>
                    <option value="Maintenance">{language === 'ne' ? 'मर्मत सम्भार' : 'Maintenance'}</option>
                    <option value="General">{t.generalOp}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">{t.priority}</label>
                  <select 
                    value={formData.priority} 
                    onChange={e => setFormData({...formData, priority: e.target.value as 'HIGH' | 'MEDIUM' | 'LOW'})} 
                    className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm"
                  >
                    <option value="HIGH">🔴 {t.priorityHigh}</option>
                    <option value="MEDIUM">🟡 {t.priorityMedium}</option>
                    <option value="LOW">🟢 {t.priorityLow}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">{t.scheduledDate}</label>
                  <NepaliDatePicker value={formData.dueDateBS} onChange={val => setFormData({...formData, dueDateBS: val})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-1">{t.scheduledTime}</label>
                  <input 
                    type="time" 
                    value={formData.dueTime} 
                    onChange={e => setFormData({...formData, dueTime: e.target.value})} 
                    className="w-full px-4 py-2 border rounded-xl text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">{t.assignedWorker}</label>
                <select 
                  value={formData.assignedWorker} 
                  onChange={e => setFormData({...formData, assignedWorker: e.target.value})} 
                  className="w-full px-4 py-2.5 border rounded-xl bg-white text-sm"
                >
                  <option value="">{t.selectWorker}</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.name}>{emp.name} ({emp.role || emp.type})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-stone-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-stone-600 font-semibold hover:bg-stone-100 rounded-xl text-sm">
                  {t.cancel}
                </button>
                <button type="submit" className="px-5 py-2 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700 shadow-sm text-sm">
                  {t.saveEntry || t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL COMPONENT */}
      {editingTask && (
        <EditTaskModal
          task={editingTask}
          isOpen={Boolean(editingTask)}
          onClose={() => setEditingTask(null)}
          onSuccess={() => setEditingTask(null)}
        />
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTaskId && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-stone-800 mb-1">{t.deleteConfirmation}</h3>
            <p className="text-xs text-stone-500 mb-5">
              {language === 'ne' 
                ? 'यो कार्य स्थायी रूपमा हटाइनेछ। के तपाईं जारी राख्न चाहनुहुन्छ?' 
                : 'This task will be permanently removed. Are you sure?'}
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={() => setDeleteTaskId(null)} 
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-semibold hover:bg-stone-50 text-sm"
              >
                {t.cancel}
              </button>
              <button 
                onClick={confirmDelete} 
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 text-sm shadow-sm"
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
