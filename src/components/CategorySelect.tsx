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

  // Quick Inline Add SubCategory state
  const [isAddingNewSubCat, setIsAddingNewSubCat] = useState(false);
  const [newSubCatName, setNewSubCatName] = useState('');
  const [isSavingSubCat, setIsSavingSubCat] = useState(false);

  useEffect(() => {
    if (!effectiveFarmId) {
      setIsLoading(false);
      return;
    }

    // Attempt auto-seed if database has no categories yet
    seedDefaultCategoriesIfEmpty(effectiveFarmId).catch(() => {});

    // Listen to all categories for this farm
    const q1 = query(
      collection(db, 'categories'), 
      where('farmId', '==', effectiveFarmId)
    );

    const unsub1 = onSnapshot(q1, (snap) => {
      const data: Category[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Category));
      setDbCategories(data);
      setIsLoading(false);
    }, (err) => {
      console.warn('CategorySelect categories error:', err);
      setIsLoading(false);
    });

    // Listen to all subcategories for this farm
    const q2 = query(
      collection(db, 'subcategories'), 
      where('farmId', '==', effectiveFarmId)
    );

    const unsub2 = onSnapshot(q2, (snap) => {
      const data: SubCategory[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as SubCategory));
      setDbSubCategories(data);
    }, (err) => {
      console.warn('CategorySelect subcategories error:', err);
    });

    return () => { 
      unsub1(); 
      unsub2(); 
    };
  }, [effectiveFarmId]);

  // Derive categories matching current type (with case-insensitivity)
  const availableCategories = useMemo(() => {
    const matchingDb = dbCategories.filter(c => {
      if (!c.type) return true;
      return c.type.toUpperCase() === type.toUpperCase();
    });

    if (matchingDb.length > 0) {
      return matchingDb;
    }

    // If Firestore has no categories for this type yet, provide default fallback categories
    const fallbackDefaults = DEFAULT_FARM_CATEGORIES
      .filter(c => c.type === type)
      .map(c => ({
        id: `default-${c.name}`,
        farmId: effectiveFarmId,
        name: c.name,
        type: c.type
      } as Category));

    return fallbackDefaults;
  }, [dbCategories, type, effectiveFarmId]);

  // Find currently selected category object
  const selectedCatObj = useMemo(() => {
    return availableCategories.find(c => c.name.toLowerCase() === (selectedCategoryName || '').toLowerCase());
  }, [availableCategories, selectedCategoryName]);

  // Derive subcategories for selected category
  const availableSubCategories = useMemo(() => {
    if (!selectedCategoryName) return [];

    // Check if subcategories exist in DB
    if (selectedCatObj && !selectedCatObj.id.startsWith('default-')) {
      const fromDb = dbSubCategories.filter(sc => sc.categoryId === selectedCatObj.id);
      if (fromDb.length > 0) {
        return fromDb.map(sc => sc.name);
      }
    }

    // Check defaults
    const defaultMatch = DEFAULT_FARM_CATEGORIES.find(
      c => c.type === type && c.name.toLowerCase() === selectedCategoryName.toLowerCase()
    );

    if (defaultMatch) {
      return defaultMatch.subCategories;
    }

    return [];
  }, [selectedCategoryName, selectedCatObj, dbSubCategories, type]);

  // Quick save new category
  const handleQuickAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCatName.trim();
    if (!trimmed || !effectiveFarmId) return;

    setIsSavingCat(true);
    try {
      const docRef = await addDoc(collection(db, 'categories'), {
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

  // Quick save new subcategory
  const handleQuickAddSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubCatName.trim();
    if (!trimmed || !effectiveFarmId || !selectedCatObj) return;

    setIsSavingSubCat(true);
    try {
      let targetCatId = selectedCatObj.id;

      // If selected category was a fallback default that wasn't in DB yet, create it in DB first
      if (targetCatId.startsWith('default-')) {
        const catRef = await addDoc(collection(db, 'categories'), {
          farmId: effectiveFarmId,
          name: selectedCatObj.name,
          type: type,
          createdAt: Date.now()
        });
        targetCatId = catRef.id;
      }

      await addDoc(collection(db, 'subcategories'), {
        farmId: effectiveFarmId,
        categoryId: targetCatId,
        name: trimmed,
        createdAt: Date.now()
      });

      onSubCategoryChange(trimmed);
      setNewSubCatName('');
      setIsAddingNewSubCat(false);
    } catch (err) {
      console.error('Failed to quick add subcategory:', err);
    } finally {
      setIsSavingSubCat(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Parent Category Field */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-stone-700">
            {t.parentCategory || 'Parent Category'} {required && <span className="text-rose-500">*</span>}
          </label>
          <button
            type="button"
            onClick={() => setIsAddingNewCat(!isAddingNewCat)}
            className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 hover:underline"
          >
            <Plus size={12} />
            <span>{language === 'ne' ? 'नयाँ वर्ग थप्नुहोस्' : '+ Add New'}</span>
          </button>
        </div>

        {isAddingNewCat ? (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder={language === 'ne' ? 'नयाँ मुख्य वर्गको नाम...' : 'New category name...'}
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
            value={selectedCategoryName || ''}
            onChange={e => {
              onCategoryChange(e.target.value);
              onSubCategoryChange(''); // Reset sub-category on parent change
            }}
            required={required}
            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm text-stone-800"
          >
            <option value="">{t.selectCategory || '-- Select Category --'}</option>
            
            {/* If selected category is not in list (legacy), preserve it */}
            {selectedCategoryName && !availableCategories.some(c => c.name === selectedCategoryName) && (
              <option value={selectedCategoryName}>{selectedCategoryName}</option>
            )}

            {availableCategories.map(c => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Sub-Category Field */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-sm font-medium text-stone-700">
            {t.subCategories || 'Sub-Categories'}
          </label>
          {selectedCategoryName && (
            <button
              type="button"
              onClick={() => setIsAddingNewSubCat(!isAddingNewSubCat)}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 hover:underline"
            >
              <Plus size={12} />
              <span>{language === 'ne' ? 'उप-वर्ग थप्नुहोस्' : '+ Add Sub'}</span>
            </button>
          )}
        </div>

        {isAddingNewSubCat ? (
          <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
            <input
              type="text"
              value={newSubCatName}
              onChange={e => setNewSubCatName(e.target.value)}
              placeholder={language === 'ne' ? 'नयाँ उप-वर्गको नाम...' : 'New sub-category name...'}
              className="flex-1 px-3 py-2 text-sm bg-stone-50 border border-emerald-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleQuickAddSubCategory(e);
                }
              }}
            />
            <button
              type="button"
              onClick={handleQuickAddSubCategory}
              disabled={isSavingSubCat || !newSubCatName.trim()}
              className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              title={t.save || 'Save'}
            >
              {isSavingSubCat ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingNewSubCat(false);
                setNewSubCatName('');
              }}
              className="p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
              title={t.cancel || 'Cancel'}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <select
            value={selectedSubCategoryName || ''}
            onChange={e => onSubCategoryChange(e.target.value)}
            disabled={!selectedCategoryName}
            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm text-stone-800"
          >
            <option value="">
              {selectedCategoryName 
                ? (language === 'ne' ? '-- उप-वर्ग छान्नुहोस् (ऐच्छिक) --' : '-- Select Sub-Category (Optional) --') 
                : (language === 'ne' ? 'पहिले मुख्य वर्ग छान्नुहोस्' : 'Select Parent First')}
            </option>

            {/* If selected subcategory is not in list (legacy), preserve it */}
            {selectedSubCategoryName && !availableSubCategories.includes(selectedSubCategoryName) && (
              <option value={selectedSubCategoryName}>{selectedSubCategoryName}</option>
            )}

            {availableSubCategories.map(name => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
