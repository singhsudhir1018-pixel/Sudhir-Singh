import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Save, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

export default function FarmProfile() {
  const { language, user } = useAppStore();
  const farmId = user?.farmId;
  const t = translations[language];

  const [profile, setProfile] = useState({
    farmName: '',
    address: '',
    panNumber: '',
    regNumber: '',
    email: '',
    phone: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  useEffect(() => {
    if (!farmId) {
      setIsLoading(false);
      return;
    }

    const fetchFarmProfile = async () => {
      try {
        const docRef = doc(db, 'farms', farmId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            farmName: data.name || data.farmName || '',
            address: data.location || data.address || '',
            panNumber: data.panNumber || '',
            regNumber: data.regNumber || '',
            email: data.email || '',
            phone: data.phone || '',
          });
        } else {
          // Fallback to settings collection if not found in farms
          const settingsRef = doc(db, 'settings', farmId);
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists() && settingsSnap.data().profile) {
            setProfile(settingsSnap.data().profile);
          }
        }
      } catch (err) {
        console.error("Failed to load farm profile:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFarmProfile();
  }, [farmId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId || !user?.uid) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const docRef = doc(db, 'farms', farmId);
      
      const payload = {
        name: profile.farmName,
        farmName: profile.farmName,
        location: profile.address,
        address: profile.address,
        panNumber: profile.panNumber,
        regNumber: profile.regNumber,
        email: profile.email,
        phone: profile.phone,
        farmId: farmId,
        updatedAt: serverTimestamp(),
        updatedBy: user.uid
      };

      await setDoc(docRef, payload, { merge: true });
      
      // Also sync to settings collection to maintain backwards compatibility
      await setDoc(doc(db, 'settings', farmId), { 
        profile: payload, 
        farmId 
      }, { merge: true });

      setFeedback({ type: 'success', message: t.farmProfileSaved || 'Farm profile saved successfully!' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setFeedback(null), 3000);
    } catch (error: any) {
      console.error("Error saving farm profile:", error);
      setFeedback({ type: 'error', message: error.message || 'Failed to save farm profile.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <h2 className="text-lg font-bold text-stone-800">{t.farmProfile || 'Farm Profile'}</h2>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl flex items-center space-x-2 border ${
          feedback.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {feedback.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="font-medium">{feedback.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.farmName || 'Farm Name'} *</label>
          <input
            type="text"
            value={profile.farmName}
            onChange={e => setProfile({ ...profile, farmName: e.target.value })}
            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50 focus:bg-white transition-colors"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.addressPlaceholder || 'Address / Location'}</label>
          <input
            type="text"
            value={profile.address}
            onChange={e => setProfile({ ...profile, address: e.target.value })}
            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50 focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.panVatPlaceholder || 'PAN / VAT Number'}</label>
          <input
            type="text"
            value={profile.panNumber}
            onChange={e => setProfile({ ...profile, panNumber: e.target.value })}
            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50 focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.regNumber || 'Registration Number'}</label>
          <input
            type="text"
            value={profile.regNumber}
            onChange={e => setProfile({ ...profile, regNumber: e.target.value })}
            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50 focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.emailAddress || 'Email Address'}</label>
          <input
            type="email"
            value={profile.email}
            onChange={e => setProfile({ ...profile, email: e.target.value })}
            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50 focus:bg-white transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t.mobileNumber || 'Phone Number'}</label>
          <input
            type="text"
            value={profile.phone}
            onChange={e => setProfile({ ...profile, phone: e.target.value })}
            className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 bg-stone-50 focus:bg-white transition-colors"
          />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center space-x-2 px-6 py-2.5 bg-green-600 text-white font-medium hover:bg-green-700 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>{t.saving || 'Saving...'}</span>
            </>
          ) : (
            <>
              <Save size={18} />
              <span>{t.save || 'Save'}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
