import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Category, SubCategory } from '../types';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  const { language, user } = useAppStore();
  const farmId = user?.farmId;
  const t = translations[language];

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  useEffect(() => {
    if (!farmId) return;
    const q1 = query(collection(db, 'categories'), where('farmId', '==', farmId), where('type', '==', type));
    const unsub1 = onSnapshot(q1, snap => {
      const data: Category[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as Category));
      setCategories(data);
    });

    const q2 = query(collection(db, 'subcategories'), where('farmId', '==', farmId));
    const unsub2 = onSnapshot(q2, snap => {
      const data: SubCategory[] = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() } as SubCategory));
      setSubCategories(data);
    });

    return () => { unsub1(); unsub2(); };
  }, [farmId, type]);

  // Find selected category ID
  const selectedCatObj = categories.find(c => c.name === selectedCategoryName);
  const selectedCategoryId = selectedCatObj ? selectedCatObj.id : '';

  // Filter subcategories for the selected category
  const filteredSubCategories = subCategories.filter(sc => sc.categoryId === selectedCategoryId);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1">
          {t.parentCategory || 'Parent Category'} {required && <span className="text-rose-500">*</span>}
        </label>
        <select
          value={selectedCategoryName}
          onChange={e => {
            onCategoryChange(e.target.value);
            onSubCategoryChange(''); // Reset sub-category on parent change
          }}
          required={required}
          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
        >
          <option value="">{t.selectCategory || 'Select Category'}</option>
          {categories.map(c => (
            <option key={c.id} value={c.name}>{c.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold text-stone-700 mb-1">
          {t.subCategories || 'Sub-Category'}
        </label>
        <select
          value={selectedSubCategoryName || ''}
          onChange={e => onSubCategoryChange(e.target.value)}
          disabled={!selectedCategoryName}
          className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          <option value="">{selectedCategoryName ? 'Select Sub-Category' : 'Select Parent First'}</option>
          {filteredSubCategories.map(sc => (
            <option key={sc.id} value={sc.name}>{sc.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
