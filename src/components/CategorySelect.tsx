import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Category, SubCategory } from '../types';
import { collection, onSnapshot, query, where, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_FARM_CATEGORIES, seedDefaultCategoriesIfEmpty } from '../lib/defaultCategories';
import { Plus, X, Check, Loader2 } from 'lucide-react';

interface Props {
  type: 'INCOME' | 'EXPENSE' | 'INVENTORY';
  selectedCategoryName: string;
  selectedSubCategoryName?: string;
  onCategoryChange: (categoryName: string) => void;
  onSubCategoryChange: (subCategoryName: string) => void;
  required?: boolean;
}

export default function CategorySelect({
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

  // Quick Inline Add Category state
  const [isAddingNewCat, setIsAddingNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isSavingCat, setIsSavingCat] = useState(false);

  useEffect(() => {
    if (!effectiveFarmId) {
      setIsLoading(false);
      return;
    }

    seedDefaultCategoriesIfEmpty(effectiveFarmId).catch(() => {});

    const q1 = query(
      collection(db, 'categories'), 
      where('farmId', '==', effectiveFarmId)
    );

    const unsub1 = onSnapshot(q1, (snap) => {
      const data: Category[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Category));
      setDbCategories(data);
      setIsLoading(false);
    });

    const q2 = query(
      collection(db, 'subcategories'), 
      where('farmId', '==', effectiveFarmId)
    );

    const unsub2 = onSnapshot(q2, (snap) => {
      const data: SubCategory[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as SubCategory));
      setDbSubCategories(data);
    });

    return () => { 
      unsub1(); 
      unsub2(); 
    };
  }, [effectiveFarmId]);

  const availableCategories = useMemo(() => {
    const matchingDb = dbCategories.filter(c => {
      if (!c.type) return true;
      return c.type.toUpperCase() === type.toUpperCase();
    });

    if (matchingDb.length > 0) {
      return matchingDb;
    }

    return DEFAULT_FARM_CATEGORIES
      .filter(c => c.type === type)
      .map(c => ({
        id: `default-${c.name}`,
        farmId: effectiveFarmId,
        name: c.name,
        type: c.type
      } as Category));
  }, [dbCategories, type, effectiveFarmId]);

  const groupedCategories = useMemo(() => {
    return availableCategories.map(cat => {
      let subs: string[] = [];
      if (!cat.id.startsWith('default-')) {
        subs = dbSubCategories.filter(sc => sc.categoryId === cat.id).map(sc => sc.name);
      } else {
        const defaultMatch = DEFAULT_FARM_CATEGORIES.find(
          c => c.type === type && c.name.toLowerCase() === cat.name.toLowerCase()
        );
        if (defaultMatch) {
          subs = defaultMatch.subCategories;
        }
      }
      return { ...cat, subs };
    });
  }, [availableCategories, dbSubCategories, type]);

  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed || !effectiveFarmId) return;

    setIsSavingCat(true);
    try {
      await addDoc(collection(db, 'categories'), {
        farmId: effectiveFarmId,
        name: trimmed,
        type: type,
        createdAt: Date.now()
      });

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

  const selectedValue = selectedCategoryName 
    ? `${selectedCategoryName}|${selectedSubCategoryName || ''}` 
    : '';

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <label className="block text-sm font-medium text-stone-700">
          {language === 'ne' ? 'वर्ग (Category)' : 'Category'} {required && <span className="text-rose-500">*</span>}
        </label>
        <button
          type="button"
          onClick={() => setIsAddingNewCat(!isAddingNewCat)}
          className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 hover:underline"
        >
          <Plus size={12} />
          <span>{language === 'ne' ? 'नयाँ थप्नुहोस्' : '+ Add New'}</span>
        </button>
      </div>

      {isAddingNewCat ? (
        <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder={language === 'ne' ? 'नयाँ वर्गको नाम...' : 'New category name...'}
            className="flex-1 px-3 py-2 text-sm bg-stone-50 border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleQuickAddCategory(e);
              }
            }}
          />
          <button
            type="button"
            onClick={handleQuickAddCategory}
            disabled={isSavingCat || !newCatName.trim()}
            className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            title={t.save || 'Save'}
          >
            {isSavingCat ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddingNewCat(false);
              setNewCatName('');
            }}
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
            title={t.cancel || 'Cancel'}
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        <select
          value={selectedValue}
          onChange={e => {
            const val = e.target.value;
            if (!val) {
              onCategoryChange('');
              onSubCategoryChange('');
              return;
            }
            const [cat, sub] = val.split('|');
            onCategoryChange(cat);
            onSubCategoryChange(sub || '');
          }}
          required={required}
          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-stone-800"
        >
          <option value="">{t.selectCategory || '-- Select Category --'}</option>
          
          {selectedCategoryName && !groupedCategories.some(c => c.name === selectedCategoryName) && (
             <option value={`${selectedCategoryName}|${selectedSubCategoryName || ''}`}>
               {selectedCategoryName} {selectedSubCategoryName ? `- ${selectedSubCategoryName}` : ''}
             </option>
          )}

          {groupedCategories.map(cat => {
            if (cat.subs.length > 0) {
              return (
                <optgroup key={cat.id} label={cat.name}>
                  {/* Option to select just the parent category if they want */}
                  <option value={`${cat.name}|`}>{cat.name} {language === 'ne' ? '(साधारण)' : '(General)'}</option>
                  {cat.subs.map(sub => (
                    <option key={sub} value={`${cat.name}|${sub}`}>
                      {sub}
                    </option>
                  ))}
                </optgroup>
              );
            } else {
              return (
                <option key={cat.id} value={`${cat.name}|`}>
                  {cat.name}
                </option>
              );
            }
          })}
        </select>
      )}
    </div>
  );
}
