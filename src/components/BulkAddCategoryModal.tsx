import React, { useState } from 'react';
import { translations } from '../lib/translations';
import { useAppStore } from '../store';
import { X, Save, Eye, Check } from 'lucide-react';
import { Category } from '../types';
import { writeBatch, doc, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'framer-motion';

interface Props {
  onClose: () => void;
  categories: Category[];
  preSelectedCategoryId?: string | null;
}

export default function BulkAddCategoryModal({ onClose, categories, preSelectedCategoryId }: Props) {
  const { language, farmId, user } = useAppStore();
  const effectiveFarmId = farmId || user?.farmId;
  const t = translations[language];
  
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(preSelectedCategoryId || '');
  const [inputText, setInputText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Parse text into unique, clean subcategories
  const getParsedSubCategories = () => {
    if (!inputText) return [];
    const rawItems = inputText.split(/[\n,]+/);
    const cleaned = rawItems.map(i => i.trim()).filter(i => i.length > 0);
    return Array.from(new Set(cleaned)); // Remove duplicates
  };

  const parsedItems = getParsedSubCategories();

  const handleSave = async () => {
    if (!effectiveFarmId || !selectedCategoryId || parsedItems.length === 0) return;
    
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const subCatsRef = collection(db, 'subcategories');
      
      parsedItems.forEach(name => {
        const newDocRef = doc(subCatsRef);
        batch.set(newDocRef, {
          farmId: effectiveFarmId,
          categoryId: selectedCategoryId,
          name,
          createdAt: Date.now()
        });
      });
      
      await batch.commit();
      onClose();
    } catch (err) {
      console.error('Batch write failed', err);
      alert('Failed to save bulk sub-categories');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl"
      >
        <div className="flex justify-between items-center p-6 border-b border-stone-100 bg-stone-50/50">
          <h2 className="text-xl font-bold text-stone-800">
            {t.bulkAddSubCategories || 'Bulk Add / Copy-Paste Sub-categories'}
          </h2>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-stone-700 mb-2">
              {t.parentCategory || 'Parent Category'}
            </label>
            <select
              value={selectedCategoryId}
              onChange={e => setSelectedCategoryId(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium"
            >
              <option value="" disabled>{t.selectParentCategory || 'Select Parent Category'}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.type})</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-end mb-2">
              <label className="block text-sm font-semibold text-stone-700">
                {t.subCategories || 'Sub-Categories'}
              </label>
              <button 
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center space-x-1"
              >
                <Eye size={14} /> <span>{t.preview || 'Preview'} ({parsedItems.length})</span>
              </button>
            </div>
            
            {showPreview ? (
              <div className="w-full h-48 px-4 py-3 bg-emerald-50/50 border border-emerald-100 rounded-xl overflow-y-auto content-start flex flex-wrap gap-2">
                {parsedItems.length > 0 ? parsedItems.map((item, idx) => (
                  <span key={idx} className="inline-flex items-center space-x-1 px-3 py-1.5 bg-white border border-emerald-200 text-emerald-800 rounded-lg text-sm font-medium shadow-sm">
                    <Check size={14} className="text-emerald-500" />
                    <span>{item}</span>
                  </span>
                )) : (
                  <span className="text-stone-400 text-sm font-medium italic">No items found</span>
                )}
              </div>
            ) : (
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder={t.bulkAddPlaceholder || "Paste multiple sub-categories here...\ne.g.\nFish Feed 2mm\nFish Feed 4mm\nMedicine A"}
                className="w-full h-48 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-medium resize-none leading-relaxed"
              />
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 p-6 border-t border-stone-100 bg-stone-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-stone-600 font-semibold hover:bg-stone-200 rounded-xl transition-colors"
          >
            {t.cancel || 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedCategoryId || parsedItems.length === 0}
            className="flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Save size={18} />
            <span>{isSaving ? '...' : `${t.importSubCategories || 'Import'} ${parsedItems.length > 0 ? `(${parsedItems.length})` : ''}`}</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
