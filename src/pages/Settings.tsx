import React from 'react';
import { useState, useEffect } from 'react';
import UserManagement from '../components/UserManagement';
import FarmProfile from '../components/FarmProfile';
import CategoryManagement from '../components/CategoryManagement';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { GeneralSettings, FarmProfileSettings, Category } from '../types';
import { Save, AlertTriangle, Upload, X, Tags, Plus, Edit2, Trash2 } from 'lucide-react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function Settings() {
  const { language, setLanguage, user } = useAppStore();
  const farmId = user?.farmId;
  const t = translations[language];
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'GENERAL' | 'CATEGORIES'>('PROFILE');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  
  
  
  

  

  

  

  const [profile, setProfile] = useState<any>({
    farmName: 'AgriFarm Pvt. Ltd.',
    address: 'Kathmandu, Nepal',
    panNumber: '',
    email: '',
    phone: '',
    regNumber: '',
  });

  const [general, setGeneral] = useState<any>({
    language: language,
    currency: 'Rs',
    currencyPosition: 'START',
    calendar: 'BS',
    dateFormat: 'YYYY Month DD',
    timeFormat: '12H',
    numberFormat: 'SOUTH_ASIAN',
  });

  useEffect(() => {
    if (!farmId) return;
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', farmId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.profile) setProfile(data.profile);
          if (data.general) setGeneral(data.general);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      }
    };
    fetchSettings();
  }, [farmId]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    try {
      await setDoc(doc(db, 'settings', farmId), { profile, farmId }, { merge: true });
      alert(t.userUpdated || 'Profile saved successfully!');
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    }
  };

    const logoInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGeneral({...general, logoUrl: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGeneralSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;
    try {
      await setDoc(doc(db, 'settings', farmId), { general, farmId }, { merge: true });
      setLanguage(general.language);
      alert(t.userUpdated || 'Preferences saved successfully!');
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    }
  };

  const handleDeleteData = () => {
    console.log('Deleting all data...');
    setIsDeleteModalOpen(false);
    alert('All data has been deleted.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-stone-800">{t.settings}</h1>
      </div>

      <div className="flex border-b border-stone-200 space-x-6">
        <button
          onClick={() => setActiveTab('PROFILE')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'PROFILE' ? 'border-green-600 text-green-700' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          {t.farmProfile}
        </button>
        <button
          onClick={() => setActiveTab('GENERAL')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'GENERAL' ? 'border-green-600 text-green-700' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          {t.generalPreferences}
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center space-x-1 ${
            activeTab === 'CATEGORIES' ? 'border-green-600 text-green-700' : 'border-transparent text-stone-500 hover:text-stone-700'
          }`}
        >
          <Tags size={16} />
          <span>{t.categoryManagement || 'Categories'}</span>
        </button>
          <button
            onClick={() => setActiveTab('USERS')}
            className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'USERS'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
            }`}
          >
            {t.userManagement || 'User Management'}
          </button>

      </div>

      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        {activeTab === 'PROFILE' && <FarmProfile />}

        {activeTab === 'GENERAL' && (
          <div className="space-y-8">
            <form onSubmit={handleGeneralSave} className="space-y-6">
              {/* App Branding */}
              <h2 className="text-lg font-bold text-stone-800 border-b border-stone-100 pb-2">Branding & Logo</h2>
              <div className="flex items-center space-x-6">
                <div className="w-20 h-20 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden">
                  {general.logoUrl ? (
                    <img src={general.logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <Upload className="text-stone-400" size={24} />
                  )}
                </div>
                <div className="space-x-3">
                  <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 text-sm font-medium">
                    {t.uploadLogo}
                  </button>
                  <button type="button" onClick={() => setGeneral({...general, logoUrl: ''})} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium">
                    {t.resetLogo}
                  </button>
                </div>
              </div>

              {/* Currency & Language */}
              <h2 className="text-lg font-bold text-stone-800 border-b border-stone-100 pb-2 mt-8">{t.currencyFormatting} & Language</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Language</label>
                  <select
                    value={general.language}
                    onChange={e => setGeneral({ ...general, language: e.target.value as 'en' | 'ne' })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="en">English</option>
                    <option value="ne">नेपाली (Nepali)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.currencySymbol}</label>
                  <input
                    type="text"
                    value={general.currency}
                    onChange={e => setGeneral({ ...general, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.currencyPosition}</label>
                  <select
                    value={general.currencyPosition}
                    onChange={e => setGeneral({ ...general, currencyPosition: e.target.value as 'START' | 'END' })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="START">{t.start} (Rs 100)</option>
                    <option value="END">{t.end} (100 Rs)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.numberFormat}</label>
                  <select
                    value={general.numberFormat}
                    onChange={e => setGeneral({ ...general, numberFormat: e.target.value as 'SOUTH_ASIAN' | 'INTERNATIONAL' })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="SOUTH_ASIAN">{t.southAsian}</option>
                    <option value="INTERNATIONAL">{t.international}</option>
                  </select>
                </div>
              </div>

              {/* Date & Time */}
              <h2 className="text-lg font-bold text-stone-800 border-b border-stone-100 pb-2 mt-8">{t.dateAndTime}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.calendarType}</label>
                  <select
                    value={general.calendar}
                    onChange={e => setGeneral({ ...general, calendar: e.target.value as 'BS' | 'AD' })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="BS">Bikram Sambat (B.S.)</option>
                    <option value="AD">Gregorian (A.D.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.dateFormat}</label>
                  <select
                    value={general.dateFormat}
                    onChange={e => setGeneral({ ...general, dateFormat: e.target.value })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY Month DD">YYYY Month DD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.timeFormat}</label>
                  <select
                    value={general.timeFormat}
                    onChange={e => setGeneral({ ...general, timeFormat: e.target.value as '12H' | '24H' })}
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="12H">12-Hour (10:04 PM)</option>
                    <option value="24H">24-Hour (22:04)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-stone-100">
                <button
                  type="submit"
                  className="flex items-center space-x-2 px-6 py-2.5 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl transition-colors"
                >
                  <Save size={18} />
                  <span>{t.save}</span>
                </button>
              </div>
            </form>

            {/* Danger Zone */}
            <div className="mt-12 p-6 bg-red-50 rounded-2xl border border-red-100">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="text-red-600" size={24} />
                <h3 className="text-lg font-bold text-red-700">{t.dangerZone}</h3>
              </div>
              <p className="text-sm text-red-600 mb-6 max-w-2xl">
                {t.deleteAllWarning}
              </p>
              <button
                onClick={() => setIsDeleteModalOpen(true)}
                className="px-6 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition-colors"
              >
                {t.deleteAllData}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'CATEGORIES' && <CategoryManagement />}
        {activeTab === 'USERS' && <UserManagement />}
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-stone-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-stone-100">
              <h2 className="text-xl font-bold text-red-600 flex items-center space-x-2">
                <AlertTriangle size={24} />
                <span>Are you absolutely sure?</span>
              </h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-stone-400 hover:text-stone-600 p-1">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-stone-600 mb-6">
                {t.deleteAllWarning}
              </p>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-5 py-2.5 text-stone-600 font-medium hover:bg-stone-100 rounded-xl transition-colors"
                >
                  {t.cancel}
                </button>
                <button 
                  onClick={handleDeleteData}
                  className="px-5 py-2.5 bg-red-600 text-white font-medium hover:bg-red-700 rounded-xl transition-colors"
                >
                  {t.confirmDelete}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

          </div>
  );
}
