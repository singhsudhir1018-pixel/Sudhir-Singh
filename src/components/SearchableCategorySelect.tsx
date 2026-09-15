import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Category, SubCategory } from '../types';
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_FARM_CATEGORIES, seedDefaultCategoriesIfEmpty } from '../lib/defaultCategories';
import { Plus, X, Check, Loader2, ChevronDown, Search } from 'lucide-react';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

interface Props {
  type: 'INCOME' | 'EXPENSE' | 'INVENTORY';
  selectedCategoryName: string;
  selectedSubCategoryName?: string;
  onCategoryChange: (categoryName: string) => void;
  onSubCategoryChange: (subCategoryName: string) => void;
  required?: boolean;
}

export default function SearchableCategorySelect({
  type,
  selectedCategoryName,
  selectedSubCategoryName,
  onCategoryChange,
  onSubCategoryChange,
  required = false
}: Props) {
  const { language, farmId, user } = useAppStore();
  const effectiveFarmId = farmId || user?.farmId || 'farm-1';
  const t = translations[language];

  const [dbCategories, setDbCategories] = useState<Category[]>([]);
  const [dbSubCategories, setDbSubCategories] = useState<SubCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Inline Add state
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);

  // Dropdown states
  const [isCatOpen, setIsCatOpen] = useState(false);
  const [isSubOpen, setIsSubOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [subSearch, setSubSearch] = useState('');

  const catRef = useRef<HTMLDivElement>(null);
  const subRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(catRef, () => setIsCatOpen(false));
  useOnClickOutside(subRef, () => setIsSubOpen(false));

  useEffect(() => {
    if (!effectiveFarmId) {
      setIsLoading(false);
      return;
    }
    seedDefaultCategoriesIfEmpty(effectiveFarmId).catch(() => {});
    const q1 = query(collection(db, 'categories'), where('farmId', '==', effectiveFarmId));
    const unsub1 = onSnapshot(q1, (snap) => {
      const data: Category[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Category));
      setDbCategories(data);
      setIsLoading(false);
    });
    const q2 = query(collection(db, 'subcategories'), where('farmId', '==', effectiveFarmId));
    const unsub2 = onSnapshot(q2, (snap) => {
      const data: SubCategory[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as SubCategory));
      setDbSubCategories(data);
    });
    return () => { unsub1(); unsub2(); };
  }, [effectiveFarmId]);

  const availableCategories = useMemo(() => {
    const matchingDb = dbCategories.filter(c => !c.type || c.type.toUpperCase() === type.toUpperCase());
    if (matchingDb.length > 0) return matchingDb;
    return DEFAULT_FARM_CATEGORIES
      .filter(c => c.type === type)
      .map(c => ({ id: `default-${c.name}`, farmId: effectiveFarmId, name: c.name, type: c.type } as Category));
  }, [dbCategories, type, effectiveFarmId]);

  const groupedCategories = useMemo(() => {
    return availableCategories.map(cat => {
      let subs: string[] = [];
      if (!cat.id.startsWith('default-')) {
        subs = dbSubCategories.filter(sc => sc.categoryId === cat.id).map(sc => sc.name);
      } else {
        const defaultMatch = DEFAULT_FARM_CATEGORIES.find(c => c.type === type && c.name.toLowerCase() === cat.name.toLowerCase());
        if (defaultMatch) subs = defaultMatch.subCategories;
      }
      return { ...cat, subs };
    });
  }, [availableCategories, dbSubCategories, type]);

  const filteredCategories = useMemo(() => {
    return groupedCategories.filter(c => c.name.toLowerCase().includes(catSearch.toLowerCase()));
  }, [groupedCategories, catSearch]);

  const availableSubCategories = useMemo(() => {
    if (!selectedCategoryName) return [];
    const cat = groupedCategories.find(c => c.name === selectedCategoryName);
    return cat ? cat.subs : [];
  }, [groupedCategories, selectedCategoryName]);

  const filteredSubCategories = useMemo(() => {
    return availableSubCategories.filter(s => s.toLowerCase().includes(subSearch.toLowerCase()));
  }, [availableSubCategories, subSearch]);

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed || !effectiveFarmId) return;
    setIsSavingCat(true);
    try {
      await addDoc(collection(db, 'categories'), { farmId: effectiveFarmId, name: trimmed, type: type, createdAt: Date.now() });
      onCategoryChange(trimmed);
      onSubCategoryChange('');
      setNewCatName('');
      setIsAddingNewCat(false);
    } catch (err) {
      console.error('Failed to quick add category:', err);
    } finally {
      setIsSavingCat(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* PARENT CATEGORY */}
      <div className="w-full" ref={catRef}>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-stone-700">
            {language === 'ne' ? 'वर्ग (Category)' : 'Category'} {required && <span className="text-rose-500">*</span>}
          </label>
          <button type="button" onClick={() => setIsAddingNewCat(!isAddingNewCat)} className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 hover:underline">
            <Plus size={12} />
            <span>{language === 'ne' ? 'नयाँ थप्नुहोस्' : '+ Add New'}</span>
          </button>
        </div>
        {isAddingNewCat ? (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
            <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder={language === 'ne' ? 'नयाँ वर्गको नाम...' : 'New category name...'} className="flex-1 px-3 py-2 text-sm bg-stone-50 border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium" autoFocus onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleQuickAddCategory(e); } }} />
            <button type="button" onClick={handleQuickAddCategory} disabled={isSavingCat || !newCatName.trim()} className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {isSavingCat ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </button>
            <button type="button" onClick={() => { setIsAddingNewCat(false); setNewCatName(''); }} className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors">
              <X size={15} />
            </button>
          </div>
        ) : (
          <div className="relative">
            <div onClick={() => setIsCatOpen(!isCatOpen)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-stone-800 cursor-pointer flex justify-between items-center">
              <span>{selectedCategoryName || t.selectCategory || '-- Select Category --'}</span>
              <ChevronDown size={16} className={`text-stone-400 transition-transform ${isCatOpen ? 'rotate-180' : ''}`} />
            </div>
            {isCatOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-stone-100">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-stone-400" />
                    <input type="text" value={catSearch} onChange={e => setCatSearch(e.target.value)} placeholder={t.searchCategory || 'Search Category...'} className="w-full pl-8 pr-3 py-1.5 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500" autoFocus onClick={e => e.stopPropagation()} />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  {filteredCategories.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-stone-500 text-center">{t.noData || 'No data available'}</div>
                  ) : (
                    filteredCategories.map(cat => (
                      <div key={cat.id} onClick={() => { onCategoryChange(cat.name); onSubCategoryChange(''); setIsCatOpen(false); setCatSearch(''); }} className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCategoryName === cat.name ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-stone-50 text-stone-700'}`}>
                        {cat.name}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SUB CATEGORY */}
      {selectedCategoryName && (
        <div className="w-full animate-in fade-in slide-in-from-top-2" ref={subRef}>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            {language === 'ne' ? 'उप-वर्ग (Sub-Category)' : 'Sub-Category'}
          </label>
          <div className="relative">
            <div onClick={() => setIsSubOpen(!isSubOpen)} className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-stone-800 cursor-pointer flex justify-between items-center">
              <span>{selectedSubCategoryName || (language === 'ne' ? '-- उप-वर्ग छान्नुहोस् --' : '-- Select Sub-category --')}</span>
              <ChevronDown size={16} className={`text-stone-400 transition-transform ${isSubOpen ? 'rotate-180' : ''}`} />
            </div>
            {isSubOpen && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg max-h-60 overflow-hidden flex flex-col">
                <div className="p-2 border-b border-stone-100">
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-2.5 text-stone-400" />
                    <input type="text" value={subSearch} onChange={e => setSubSearch(e.target.value)} placeholder={t.searchSubCategory || 'Search Sub-category...'} className="w-full pl-8 pr-3 py-1.5 text-sm bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500" autoFocus onClick={e => e.stopPropagation()} />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1 p-1">
                  <div onClick={() => { onSubCategoryChange(''); setIsSubOpen(false); setSubSearch(''); }} className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${!selectedSubCategoryName ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-stone-50 text-stone-700'}`}>
                    {language === 'ne' ? '(साधारण)' : '(General)'}
                  </div>
                  {filteredSubCategories.length === 0 ? (
                    availableSubCategories.length > 0 && <div className="px-3 py-2 text-sm text-stone-500 text-center">{t.noData || 'No data available'}</div>
                  ) : (
                    filteredSubCategories.map(sub => (
                      <div key={sub} onClick={() => { onSubCategoryChange(sub); setIsSubOpen(false); setSubSearch(''); }} className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedSubCategoryName === sub ? 'bg-emerald-50 text-emerald-700 font-semibold' : 'hover:bg-stone-50 text-stone-700'}`}>
                        {sub}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
