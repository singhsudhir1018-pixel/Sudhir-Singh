import React, { useState, useEffect } from 'react';
import { Task, Employee } from '../types';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import NepaliDatePicker from './NepaliDatePicker';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, Save, AlertCircle, Clock, UserCheck, Tag, Flag, CheckCircle2 } from 'lucide-react';

interface EditTaskModalProps {
  task: Task;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function EditTaskModal({ task, isOpen, onClose, onSuccess }: EditTaskModalProps) {
  const { language, farmId } = useAppStore();
  const t = translations[language];

  const [title, setTitle] = useState(task.title || '');
  const [description, setDescription] = useState(task.description || '');
  const [category, setCategory] = useState(task.category || 'General');
  const [priority, setPriority] = useState<'HIGH' | 'MEDIUM' | 'LOW'>(task.priority || 'MEDIUM');
  const [dueDateBS, setDueDateBS] = useState(task.dueDateBS || '');
  const [dueTime, setDueTime] = useState(task.dueTime || '');
  const [assignedWorker, setAssignedWorker] = useState(task.assignedWorker || '');
  const [status, setStatus] = useState<'TODO' | 'IN_PROGRESS' | 'COMPLETED'>(task.status || 'TODO');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state whenever task prop changes
  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setCategory(task.category || 'General');
      setPriority(task.priority || 'MEDIUM');
      setDueDateBS(task.dueDateBS || '');
      setDueTime(task.dueTime || '');
      setAssignedWorker(task.assignedWorker || '');
      setStatus(task.status || 'TODO');
      setErrorMsg(null);
    }
  }, [task]);

  // Load farm employees for the assignment dropdown
  useEffect(() => {
    if (!farmId) return;
    const fetchEmployees = async () => {
      try {
        const q = query(collection(db, 'employees'), where('farmId', '==', farmId));
        const snap = await getDocs(q);
        const emps: Employee[] = [];
        snap.forEach(d => emps.push({ id: d.id, ...d.data() } as Employee));
        setEmployees(emps);
      } catch (err) {
        console.error("Error loading employees for tasks:", err);
      }
    };
    fetchEmployees();
  }, [farmId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg(language === 'ne' ? 'कृपया कार्यको शीर्षक लेख्नुहोस्।' : 'Please enter a task title.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const taskRef = doc(db, 'tasks', task.id);
      await updateDoc(taskRef, {
        title: title.trim(),
        description: description.trim(),
        category,
        priority,
        dueDateBS,
        dueTime: dueTime.trim(),
        assignedWorker: assignedWorker.trim(),
        status,
        updatedAt: Date.now()
      });

      setSaving(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error updating task:", err);
      setErrorMsg(err.message || (language === 'ne' ? 'कार्य अद्यावधिक गर्न सकिएन।' : 'Failed to update task.'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-stone-100 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-800">{t.editTask}</h2>
              <p className="text-xs text-stone-500">ID: #{task.id.slice(0, 8)}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-2 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Task Title */}
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">
              {t.taskTitle} <span className="text-red-500">*</span>
            </label>
            <input 
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === 'ne' ? 'कार्यको मुख्य शीर्षक...' : 'Task title / activity name...'}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-800 font-medium"
            />
          </div>

          {/* Description / Notes */}
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">
              {t.taskDescription}
            </label>
            <textarea 
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === 'ne' ? 'कार्यको थप विवरण, निर्देशन वा कैफियत...' : 'Detailed instructions, dosage, target field or notes...'}
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-800 resize-none text-sm"
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center space-x-1.5">
                <Tag size={15} className="text-stone-400" />
                <span>{t.category}</span>
              </label>
              <select 
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-800 bg-white text-sm"
              >
                <option value="Feeding">{t.feeding || 'Feeding'}</option>
                <option value="Medication">{t.medication || 'Medication'}</option>
                <option value="Cleaning">{t.cleaning || 'Cleaning'}</option>
                <option value="Harvest">{t.harvest || 'Harvest'}</option>
                <option value="Irrigation">{language === 'ne' ? 'सिँचाइ (Irrigation)' : 'Irrigation'}</option>
                <option value="Maintenance">{language === 'ne' ? 'मर्मत सम्भार (Maintenance)' : 'Maintenance'}</option>
                <option value="General">{t.generalOp || 'General'}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center space-x-1.5">
                <Flag size={15} className="text-stone-400" />
                <span>{t.priority}</span>
              </label>
              <select 
                value={priority}
                onChange={(e) => setPriority(e.target.value as 'HIGH' | 'MEDIUM' | 'LOW')}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-800 bg-white text-sm"
              >
                <option value="HIGH">🔴 {t.priorityHigh}</option>
                <option value="MEDIUM">🟡 {t.priorityMedium}</option>
                <option value="LOW">🟢 {t.priorityLow}</option>
              </select>
            </div>
          </div>

          {/* Scheduled Date (B.S.) & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                {t.scheduledDate}
              </label>
              <NepaliDatePicker 
                value={dueDateBS} 
                onChange={(val) => setDueDateBS(val)} 
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center space-x-1.5">
                <Clock size={15} className="text-stone-400" />
                <span>{t.scheduledTime}</span>
              </label>
              <input 
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-4 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-800 text-sm"
              />
            </div>
          </div>

          {/* Assigned Worker / Person */}
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5 flex items-center space-x-1.5">
              <UserCheck size={15} className="text-stone-400" />
              <span>{t.assignedWorker}</span>
            </label>
            <div className="space-y-2">
              <select 
                value={assignedWorker}
                onChange={(e) => setAssignedWorker(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 text-stone-800 bg-white text-sm"
              >
                <option value="">{t.selectWorker}</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.name}>
                    {emp.name} ({emp.role || emp.type})
                  </option>
                ))}
                {assignedWorker && !employees.some(e => e.name === assignedWorker) && (
                  <option value={assignedWorker}>{assignedWorker} (Custom)</option>
                )}
              </select>
              
              {/* Optional custom input if employee not in list */}
              <input 
                type="text"
                placeholder={language === 'ne' ? 'वा नयाँ कामदारको नाम सिधै लेख्नुहोस्...' : 'Or enter custom assignee name...'}
                value={assignedWorker}
                onChange={(e) => setAssignedWorker(e.target.value)}
                className="w-full px-4 py-2 text-xs rounded-xl border border-stone-200 text-stone-700 placeholder-stone-400 bg-stone-50/50"
              />
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-1.5">
              {t.taskStatus}
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setStatus('TODO')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  status === 'TODO' 
                    ? 'bg-blue-50 border-blue-400 text-blue-700 shadow-sm' 
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
                <span>{t.statusTodo}</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('IN_PROGRESS')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  status === 'IN_PROGRESS' 
                    ? 'bg-amber-50 border-amber-400 text-amber-700 shadow-sm' 
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                <span>{t.statusInProgress}</span>
              </button>

              <button
                type="button"
                onClick={() => setStatus('COMPLETED')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all ${
                  status === 'COMPLETED' 
                    ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm' 
                    : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                <span>{t.statusCompleted}</span>
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 text-stone-600 font-semibold hover:bg-stone-100 rounded-xl transition-colors text-sm"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 text-white font-semibold hover:bg-emerald-700 active:scale-98 rounded-xl shadow-md shadow-emerald-600/20 transition-all text-sm disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>{t.saving || 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>{t.saveChanges || 'Save Changes'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
