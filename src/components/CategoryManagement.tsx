import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Category, SubCategory } from '../types';
import { collection, onSnapshot, query, where, deleteDoc, doc, addDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Layers, 
  Tag, 
  X, 
  Save, 
  Search, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Package, 
  FolderPlus, 
  Check, 
  HelpCircle 
} from 'lucide-react';
import BulkAddCategoryModal from './BulkAddCategoryModal';
import { seedDefaultCategoriesIfEmpty } from '../lib/defaultCategories';

type CategoryType = 'EXPENSE' | 'INCOME' | 'INVENTORY';

export default function CategoryManagement() {
  const { language, farmId, user } = useAppStore();
  const effectiveFarmId = farmId || user?.farmId || 'farm-1';
  const t = translations[language];

  // Active Tab state: EXPENSE | INCOME | INVENTORY
  const [activeTab, setActiveTab] = useState<CategoryType>('EXPENSE');
  const [searchTerm, setSearchTerm] = useState('');

  // Firestore data
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Main Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'EXPENSE' as CategoryType });

  // Single Sub-Category Modal state
  const [isSubCategoryModalOpen, setIsSubCategoryModalOpen] = useState(false);
  const [targetCategoryForSub, setTargetCategoryForSub] = useState<Category | null>(null);
  const [editingSubCategory, setEditingSubCategory] = useState<SubCategory | null>(null);
  const [subCategoryNameInput, setSubCategoryNameInput] = useState('');

  // Bulk Add Modal state
  const [isBulkAddOpen, setIsBulkAddOpen] = useState(false);
  const [bulkPreselectId, setBulkPreselectId] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveFarmId) {
      setIsLoading(false);
      return;
    }

    // Auto-seed standard agricultural farm categories if none exist
    seedDefaultCategoriesIfEmpty(effectiveFarmId).catch(() => {});

    setIsLoading(true);
    const unsubCats = onSnapshot(
      query(collection(db, 'categories'), where('farmId', '==', effectiveFarmId)), 
      (snap) => {
        const data: Category[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() } as Category));
        setCategories(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Categories listener error:', err);
        setIsLoading(false);
      }
    );

    const unsubSubCats = onSnapshot(
      query(collection(db, 'subcategories'), where('farmId', '==', effectiveFarmId)), 
      (snap) => {
        const data: SubCategory[] = [];
        snap.forEach(d => data.push({ id: d.id, ...d.data() } as SubCategory));
        setSubCategories(data);
      },
      (err) => {
        console.error('Subcategories listener error:', err);
      }
    );

    return () => { 
      unsubCats(); 
      unsubSubCats(); 
    };
  }, [effectiveFarmId]);

  // Counts for tabs
  const expenseCount = categories.filter(c => c.type === 'EXPENSE').length;
  const incomeCount = categories.filter(c => c.type === 'INCOME').length;
  const inventoryCount = categories.filter(c => c.type === 'INVENTORY').length;

  // Filter categories by active tab and search term
  const filteredCategories = categories.filter(cat => {
    if (cat.type !== activeTab) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const matchesCatName = cat.name.toLowerCase().includes(term);
    const catSubCats = subCategories.filter(sc => sc.categoryId === cat.id);
    const matchesSubCats = catSubCats.some(sc => sc.name.toLowerCase().includes(term));
    return matchesCatName || matchesSubCats;
  });

  // Open Add Category Modal (pre-configured with current active tab)
  const openAddCategoryModal = () => {
    setEditingCategoryId(null);
    setCategoryForm({ name: '', type: activeTab });
    setIsCategoryModalOpen(true);
  };

  // Open Edit Category Modal
  const openEditCategoryModal = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCategoryForm({ name: cat.name, type: cat.type });
    setIsCategoryModalOpen(true);
  };

  // Save Main Category (Create or Update)
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveFarmId || !categoryForm.name.trim()) return;

    try {
      if (editingCategoryId) {
        await updateDoc(doc(db, 'categories', editingCategoryId), { 
          name: categoryForm.name.trim(),
          type: categoryForm.type 
        });
      } else {
        await addDoc(collection(db, 'categories'), { 
          farmId: effectiveFarmId, 
          name: categoryForm.name.trim(),
          type: categoryForm.type,
          createdAt: Date.now()
        });
      }
      setIsCategoryModalOpen(false);
      setCategoryForm({ name: '', type: activeTab });
      setEditingCategoryId(null);
    } catch (err) {
      console.error('Failed to save category', err);
    }
  };

  // Delete Category (and associated subcategories)
  const handleDeleteCategory = async (cat: Category) => {
    const catSubs = subCategories.filter(sc => sc.categoryId === cat.id);
    const confirmMsg = language === 'ne'
      ? `के तपाईं "${cat.name}" वर्ग मेटाउन निश्चित हुनुहुन्छ? यसअन्तर्गत रहेका ${catSubs.length} वटा उप-वर्गहरू पनि मेटिनेछन्।`
      : `Are you sure you want to delete category "${cat.name}"? All ${catSubs.length} sub-categories under it will also be deleted.`;

    if (window.confirm(confirmMsg)) {
      try {
        const batch = writeBatch(db);
        // Delete main category
        batch.delete(doc(db, 'categories', cat.id));
        // Delete associated subcategories
        catSubs.forEach(sc => {
          batch.delete(doc(db, 'subcategories', sc.id));
        });
        await batch.commit();
      } catch (err) {
        console.error('Failed to delete category', err);
      }
    }
  };

  // Open Add Single Sub-Category Modal
  const openAddSubCategoryModal = (cat: Category) => {
    setTargetCategoryForSub(cat);
    setEditingSubCategory(null);
    setSubCategoryNameInput('');
    setIsSubCategoryModalOpen(true);
  };

  // Open Edit Sub-Category Modal
  const openEditSubCategoryModal = (cat: Category, subCat: SubCategory) => {
    setTargetCategoryForSub(cat);
    setEditingSubCategory(subCat);
    setSubCategoryNameInput(subCat.name);
    setIsSubCategoryModalOpen(true);
  };

  // Save Single Sub-Category (Create or Update)
  const handleSaveSubCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveFarmId || !targetCategoryForSub || !subCategoryNameInput.trim()) return;

    try {
      if (editingSubCategory) {
        await updateDoc(doc(db, 'subcategories', editingSubCategory.id), {
          name: subCategoryNameInput.trim()
        });
      } else {
        await addDoc(collection(db, 'subcategories'), {
          farmId: effectiveFarmId,
          categoryId: targetCategoryForSub.id,
          name: subCategoryNameInput.trim(),
          createdAt: Date.now()
        });
      }
      setIsSubCategoryModalOpen(false);
      setSubCategoryNameInput('');
      setTargetCategoryForSub(null);
      setEditingSubCategory(null);
    } catch (err) {
      console.error('Failed to save subcategory', err);
    }
  };

  // Delete Single Sub-Category
  const handleDeleteSubCategory = async (sc: SubCategory) => {
    const confirmMsg = language === 'ne' 
      ? `के तपाईं "${sc.name}" उप-वर्ग मेटाउन चाहनुहुन्छ?`
      : `Delete sub-category "${sc.name}"?`;
      
    if (window.confirm(confirmMsg)) {
      try {
        await deleteDoc(doc(db, 'subcategories', sc.id));
      } catch (err) {
        console.error('Failed to delete sub-category', err);
      }
    }
  };

  // Tab theme configuration
  const tabConfig = {
    EXPENSE: {
      label: language === 'ne' ? 'खर्च (Expense)' : 'Expense',
      subText: language === 'ne' ? 'सबै खर्च वर्गहरू' : 'Expense Categories',
      count: expenseCount,
      icon: ArrowDownCircle,
      activeBg: 'bg-rose-600 text-white shadow-sm shadow-rose-200',
      inactiveBg: 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80',
      badgeActive: 'bg-rose-700/80 text-white',
      badgeInactive: 'bg-stone-200 text-stone-700',
      themeBorder: 'border-rose-100',
      pillBg: 'bg-rose-50 text-rose-800 border-rose-200 hover:border-rose-300'
    },
    INCOME: {
      label: language === 'ne' ? 'आम्दानी (Income)' : 'Income',
      subText: language === 'ne' ? 'सबै आम्दानी वर्गहरू' : 'Income Categories',
      count: incomeCount,
      icon: ArrowUpCircle,
      activeBg: 'bg-emerald-600 text-white shadow-sm shadow-emerald-200',
      inactiveBg: 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80',
      badgeActive: 'bg-emerald-700/80 text-white',
      badgeInactive: 'bg-stone-200 text-stone-700',
      themeBorder: 'border-emerald-100',
      pillBg: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:border-emerald-300'
    },
    INVENTORY: {
      label: language === 'ne' ? 'जिन्सी / स्टक (Inventory)' : 'Inventory',
      subText: language === 'ne' ? 'सबै जिन्सी वर्गहरू' : 'Inventory Categories',
      count: inventoryCount,
      icon: Package,
      activeBg: 'bg-blue-600 text-white shadow-sm shadow-blue-200',
      inactiveBg: 'bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200/80',
      badgeActive: 'bg-blue-700/80 text-white',
      badgeInactive: 'bg-stone-200 text-stone-700',
      themeBorder: 'border-blue-100',
      pillBg: 'bg-blue-50 text-blue-800 border-blue-200 hover:border-blue-300'
    }
  };

  const currentTheme = tabConfig[activeTab];

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-stone-100">
        <div>
          <h2 className="text-xl font-bold text-stone-800 flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
              <Layers size={22} />
            </div>
            <span>{t.categoryManagement || 'Category Management'}</span>
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            {language === 'ne' 
              ? 'खर्च, आम्दानी र जिन्सी वर्गहरूलाई ट्याब अनुसार व्यवस्थित र तालिका ढाँचामा व्यवस्थापन गर्नुहोस्'
              : 'Manage Expense, Income, and Inventory categories organized by tabs in structured table format'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { 
              setBulkPreselectId(null); 
              setIsBulkAddOpen(true); 
            }}
            className="flex items-center space-x-1.5 px-3.5 py-2 bg-white border border-stone-300 text-stone-700 hover:text-emerald-700 hover:border-emerald-300 font-medium hover:bg-emerald-50/50 rounded-xl transition-colors shadow-sm text-sm"
          >
            <FolderPlus size={16} className="text-emerald-600" />
            <span>{t.bulkAddSubCategories || 'Bulk Import'}</span>
          </button>

          <button
            onClick={openAddCategoryModal}
            className={`flex items-center space-x-1.5 px-4 py-2 font-medium text-white rounded-xl transition-all shadow-sm text-sm ${
              activeTab === 'EXPENSE' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200' :
              activeTab === 'INCOME' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' :
              'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
            }`}
          >
            <Plus size={16} />
            <span>{language === 'ne' ? `+ नयाँ ${currentTheme.label.split(' ')[0]} वर्ग` : `+ Add ${currentTheme.label} Category`}</span>
          </button>
        </div>
      </div>

      {/* 3 Dedicated Category TABs */}
      <div className="bg-stone-100/70 p-1.5 rounded-2xl flex flex-col sm:flex-row gap-1.5 border border-stone-200/80">
        {(['EXPENSE', 'INCOME', 'INVENTORY'] as CategoryType[]).map((type) => {
          const cfg = tabConfig[type];
          const Icon = cfg.icon;
          const isActive = activeTab === type;

          return (
            <button
              key={type}
              onClick={() => {
                setActiveTab(type);
                setSearchTerm('');
              }}
              className={`flex-1 flex items-center justify-between px-4 py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                isActive ? cfg.activeBg : cfg.inactiveBg
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon size={18} className={isActive ? 'text-white' : 'text-stone-500'} />
                <div className="text-left">
                  <div className="font-bold leading-none">{cfg.label}</div>
                  <div className={`text-[11px] font-normal mt-0.5 ${isActive ? 'text-white/80' : 'text-stone-400'}`}>
                    {cfg.subText}
                  </div>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
                isActive ? cfg.badgeActive : cfg.badgeInactive
              }`}>
                {cfg.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={language === 'ne' ? `${currentTheme.label} वा उप-वर्ग खोज्नुहोस्...` : `Search ${currentTheme.label} or sub-category...`}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent shadow-sm"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="text-xs text-stone-500 flex items-center gap-1.5 self-end sm:self-center font-medium bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200/60">
          <span>{language === 'ne' ? 'देखाउँदै:' : 'Showing:'}</span>
          <span className="font-bold text-stone-800">{filteredCategories.length}</span>
          <span>{language === 'ne' ? 'मुख्य वर्ग' : 'categories'}</span>
        </div>
      </div>

      {/* Categories TABLE Format */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/90 border-b border-stone-200 text-stone-700 text-xs font-bold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-14 text-center">
                  {language === 'ne' ? 'क्र.सं.' : '#'}
                </th>
                <th className="py-3.5 px-4 min-w-[200px]">
                  {language === 'ne' ? 'मुख्य वर्ग (Main Category)' : 'Main Category'}
                </th>
                <th className="py-3.5 px-4 min-w-[320px]">
                  {language === 'ne' ? 'उप-वर्गहरू (Sub-Categories)' : 'Sub-Categories'}
                </th>
                <th className="py-3.5 px-4 w-28 text-center">
                  {language === 'ne' ? 'संख्या' : 'Count'}
                </th>
                <th className="py-3.5 px-4 w-52 text-right">
                  {t.actions || 'Actions'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-stone-400">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-stone-200 border-t-emerald-600 mb-2"></div>
                    <p>{t.loading || 'Loading categories...'}</p>
                  </td>
                </tr>
              ) : filteredCategories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                        <Tag size={24} />
                      </div>
                      <div className="text-base font-semibold text-stone-700">
                        {searchTerm 
                          ? (language === 'ne' ? 'कुनै नतिजा फेला परेन' : 'No matching categories found')
                          : (language === 'ne' ? `यस ${currentTheme.label} ट्याबमा कुनै वर्ग छैन` : `No categories found in ${currentTheme.label}`)}
                      </div>
                      <p className="text-xs text-stone-500">
                        {searchTerm
                          ? (language === 'ne' ? 'कृपया अर्को शब्द खोजेर प्रयास गर्नुहोस्।' : 'Try searching with a different keyword.')
                          : (language === 'ne' ? 'तलको बटन क्लिक गरेर नयाँ मुख्य वर्ग थप्नुहोस्।' : 'Add a new category to get started.')}
                      </p>
                      {!searchTerm && (
                        <button
                          onClick={openAddCategoryModal}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <Plus size={14} />
                          <span>{language === 'ne' ? `+ नयाँ ${currentTheme.label.split(' ')[0]} वर्ग थप्नुहोस्` : `+ Add First Category`}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCategories.map((cat, idx) => {
                  const catSubs = subCategories.filter(sc => sc.categoryId === cat.id);

                  return (
                    <tr key={cat.id} className="hover:bg-stone-50/70 transition-colors group">
                      {/* Serial Number */}
                      <td className="py-4 px-4 text-center text-xs font-semibold text-stone-400">
                        {idx + 1}
                      </td>

                      {/* Main Category */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-xl border flex items-center justify-center ${
                            cat.type === 'EXPENSE' ? 'bg-rose-50 border-rose-100 text-rose-600' :
                            cat.type === 'INCOME' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            'bg-blue-50 border-blue-100 text-blue-600'
                          }`}>
                            <Tag size={16} />
                          </div>
                          <div>
                            <div className="font-bold text-stone-800 text-sm">{cat.name}</div>
                            <div className="text-[11px] text-stone-400 font-medium">
                              ID: <span className="font-mono text-stone-500">{cat.id.slice(0, 8)}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Sub-Categories (Badges / Chips list) */}
                      <td className="py-4 px-4">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {catSubs.length === 0 ? (
                            <div className="flex items-center space-x-2 text-xs text-stone-400 italic bg-stone-50 px-2.5 py-1 rounded-lg border border-dashed border-stone-200">
                              <span>{language === 'ne' ? 'कुनै उप-वर्ग छैन' : 'No sub-categories'}</span>
                              <button
                                onClick={() => openAddSubCategoryModal(cat)}
                                className="text-emerald-600 font-semibold hover:underline not-italic ml-1"
                              >
                                {language === 'ne' ? '+ थप्नुहोस्' : '+ Add'}
                              </button>
                            </div>
                          ) : (
                            <>
                              {catSubs.map((sc) => (
                                <span
                                  key={sc.id}
                                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 bg-stone-100/80 hover:bg-white text-stone-700 border border-stone-200 rounded-lg text-xs font-medium shadow-2xs group/chip transition-all hover:border-emerald-300"
                                >
                                  <span>{sc.name}</span>
                                  <button
                                    onClick={() => openEditSubCategoryModal(cat, sc)}
                                    title={language === 'ne' ? 'सम्पादन' : 'Edit sub-category'}
                                    className="opacity-0 group-hover/chip:opacity-100 text-stone-400 hover:text-blue-600 transition-opacity p-0.5"
                                  >
                                    <Edit2 size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSubCategory(sc)}
                                    title={language === 'ne' ? 'मेटाउनुहोस्' : 'Delete sub-category'}
                                    className="opacity-0 group-hover/chip:opacity-100 text-stone-400 hover:text-rose-600 transition-opacity p-0.5"
                                  >
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                              
                              {/* Quick inline + Add Sub button */}
                              <button
                                onClick={() => openAddSubCategoryModal(cat)}
                                className="inline-flex items-center space-x-1 px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-dashed border-emerald-300 rounded-lg text-xs font-semibold transition-colors"
                                title={language === 'ne' ? 'नयाँ उप-वर्ग थप्नुहोस्' : 'Add sub-category'}
                              >
                                <Plus size={12} />
                                <span>{language === 'ne' ? 'थप्नुहोस्' : 'Add'}</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Sub-Categories Count */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          catSubs.length > 0 
                            ? 'bg-stone-100 text-stone-700 border border-stone-200' 
                            : 'bg-stone-50 text-stone-400 border border-dashed border-stone-200'
                        }`}>
                          {catSubs.length} {language === 'ne' ? 'वटा' : 'items'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center space-x-1">
                          {/* Quick Single Sub Add button */}
                          <button
                            onClick={() => openAddSubCategoryModal(cat)}
                            className="p-1.5 text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-medium flex items-center space-x-1"
                            title={language === 'ne' ? 'उप-वर्ग थप्नुहोस्' : 'Add Sub-category'}
                          >
                            <Plus size={15} />
                            <span className="hidden md:inline">{language === 'ne' ? 'उप-वर्ग' : 'Sub-cat'}</span>
                          </button>

                          {/* Bulk Add button pre-selected */}
                          <button
                            onClick={() => {
                              setBulkPreselectId(cat.id);
                              setIsBulkAddOpen(true);
                            }}
                            className="p-1.5 text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-medium flex items-center space-x-1"
                            title={t.bulkAddSubCategories || 'Bulk Import'}
                          >
                            <FolderPlus size={15} />
                            <span className="hidden lg:inline">Bulk</span>
                          </button>

                          <div className="w-px h-4 bg-stone-200 mx-1"></div>

                          {/* Edit Category */}
                          <button
                            onClick={() => openEditCategoryModal(cat)}
                            className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title={t.edit || 'Edit'}
                          >
                            <Edit2 size={16} />
                          </button>

                          {/* Delete Category */}
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title={t.delete || 'Delete'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Category Modal (Add / Edit) */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-100">
            <div className="flex justify-between items-center p-5 border-b border-stone-100 bg-stone-50/50">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
                  <Tag size={18} />
                </div>
                <h2 className="text-lg font-bold text-stone-800">
                  {editingCategoryId 
                    ? (language === 'ne' ? 'मुख्य वर्ग सम्पादन' : 'Edit Main Category')
                    : (language === 'ne' ? `नयाँ ${tabConfig[categoryForm.type].label} वर्ग थप्नुहोस्` : `Add ${categoryForm.type} Category`)}
                </h2>
              </div>
              <button 
                onClick={() => setIsCategoryModalOpen(false)} 
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                  {t.type || 'Type'}
                </label>
                <select
                  value={categoryForm.type}
                  onChange={e => setCategoryForm({ ...categoryForm, type: e.target.value as CategoryType })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-sm"
                  required
                >
                  <option value="EXPENSE">{t.expense || 'Expense (खर्च)'}</option>
                  <option value="INCOME">{t.income || 'Income (आम्दानी)'}</option>
                  <option value="INVENTORY">{t.inventoryCategories || 'Inventory (जिन्सी/स्टक)'}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                  {language === 'ne' ? 'वर्गको नाम (Category Name)' : 'Category Name'}
                </label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={e => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                  placeholder={
                    categoryForm.type === 'EXPENSE' ? 'e.g. Feed / दाना, Medicine / औषधि' :
                    categoryForm.type === 'INCOME' ? 'e.g. Fish Sales / माछा बिक्री, Harvest' :
                    'e.g. Equipment / औजार, Raw Materials'
                  }
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                <button 
                  type="button" 
                  onClick={() => setIsCategoryModalOpen(false)} 
                  className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors text-sm"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 text-white font-medium hover:bg-emerald-700 rounded-xl transition-colors text-sm shadow-sm"
                >
                  <Save size={16} />
                  <span>{t.save || 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Sub-Category Modal (Add / Edit) */}
      {isSubCategoryModalOpen && targetCategoryForSub && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-stone-100">
            <div className="flex justify-between items-center p-5 border-b border-stone-100 bg-stone-50/50">
              <div>
                <h2 className="text-lg font-bold text-stone-800">
                  {editingSubCategory 
                    ? (language === 'ne' ? 'उप-वर्ग सम्पादन' : 'Edit Sub-Category')
                    : (language === 'ne' ? 'नयाँ उप-वर्ग थप्नुहोस्' : 'Add Sub-Category')}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  {language === 'ne' ? 'मुख्य वर्ग:' : 'Under parent:'} <span className="font-bold text-emerald-700">{targetCategoryForSub.name}</span>
                </p>
              </div>
              <button 
                onClick={() => setIsSubCategoryModalOpen(false)} 
                className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSubCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1.5">
                  {language === 'ne' ? 'उप-वर्गको नाम (Sub-Category Name)' : 'Sub-Category Name'}
                </label>
                <input
                  type="text"
                  value={subCategoryNameInput}
                  onChange={e => setSubCategoryNameInput(e.target.value)}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-medium"
                  placeholder="e.g. Fish Feed 2mm, Vitamin C, Layer Feed"
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                <button 
                  type="button" 
                  onClick={() => setIsSubCategoryModalOpen(false)} 
                  className="px-4 py-2 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors text-sm"
                >
                  {t.cancel || 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="flex items-center space-x-1.5 px-5 py-2 bg-emerald-600 text-white font-medium hover:bg-emerald-700 rounded-xl transition-colors text-sm shadow-sm"
                >
                  <Save size={16} />
                  <span>{t.save || 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {isBulkAddOpen && (
        <BulkAddCategoryModal 
          onClose={() => setIsBulkAddOpen(false)} 
          categories={categories}
          preSelectedCategoryId={bulkPreselectId}
        />
      )}
    </div>
  );
}
