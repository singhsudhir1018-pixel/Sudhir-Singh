import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { Save, Loader2, CheckCircle, AlertTriangle, Upload, X, Image as ImageIcon } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { compressImage } from '../lib/imageUtils';

export default function FarmProfile() {
  const { language, user, farmId: storeFarmId } = useAppStore();
  const farmId = storeFarmId || user?.farmId || 'farm-1';
  const t = translations[language];

  const [profile, setProfile] = useState({
    farmName: '',
    address: '',
    panNumber: '',
    regNumber: '',
    email: '',
    phone: '',
    logoUrl: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);

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
            logoUrl: data.logoUrl || '',
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


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !farmId) return;
    
    setIsUploading(true);
    setFeedback(null);
    try {
      // 1. Instantly compress image to lightweight base64 Data URL (around 20-30KB)
      const dataUrl = await compressImage(file, 400, 400, 0.85);
      
      // 2. Immediately update state so user sees the logo immediately without waiting
      setProfile(prev => ({ ...prev, logoUrl: dataUrl }));

      // 3. Persist immediately to Firestore
      const docRef = doc(db, 'farms', farmId);
      await setDoc(docRef, { logoUrl: dataUrl, updatedAt: serverTimestamp() }, { merge: true });
      await setDoc(doc(db, 'settings', farmId), { 'profile.logoUrl': dataUrl }, { merge: true });

      // 4. Try Firebase Storage with 4s timeout for cloud URL if available
      try {
        const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const storageRef = ref(storage, `farm-logos/${farmId}/${safeName}`);
        const uploadTask = uploadBytes(storageRef, file);
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Storage timeout')), 4000)
        );
        await Promise.race([uploadTask, timeoutPromise]);
        const downloadUrl = await getDownloadURL(storageRef);
        if (downloadUrl) {
          setProfile(prev => ({ ...prev, logoUrl: downloadUrl }));
          await setDoc(docRef, { logoUrl: downloadUrl, updatedAt: serverTimestamp() }, { merge: true });
          await setDoc(doc(db, 'settings', farmId), { 'profile.logoUrl': downloadUrl }, { merge: true });
        }
      } catch (storageErr) {
        console.warn("Storage upload skipped or timed out, keeping high-res data URL:", storageErr);
      }

      setFeedback({ 
        type: "success", 
        message: language === 'ne' ? "फार्मको लोगो सफलतापूर्वक अपलोड भयो!" : "Farm logo uploaded and saved successfully!" 
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error("Logo upload failed:", err);
      setFeedback({ 
        type: "error", 
        message: language === 'ne' ? "लोगो अपलोड गर्न सकिएन। कृपया अर्को फोटो छनोट गर्नुहोस्।" : "Failed to upload logo. Please try another image." 
      });
    } finally {
      setIsUploading(false);
      if (logoInputRef.current) {
        logoInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLogo = async () => {
    setProfile(prev => ({ ...prev, logoUrl: "" }));
    if (farmId) {
      try {
        const docRef = doc(db, 'farms', farmId);
        await setDoc(docRef, { logoUrl: "", updatedAt: serverTimestamp() }, { merge: true });
        await setDoc(doc(db, 'settings', farmId), { 'profile.logoUrl': "" }, { merge: true });
        setFeedback({ 
          type: "success", 
          message: language === 'ne' ? "लोगो हटाइयो!" : "Logo removed successfully!" 
        });
        setTimeout(() => setFeedback(null), 3000);
      } catch (err) {
        console.error("Failed to remove logo:", err);
      }
    }
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmId) return;

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
        logoUrl: profile.logoUrl,
        farmId: farmId,
        updatedAt: serverTimestamp(),
        updatedBy: user?.uid || 'admin'
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
        <div className="col-span-1 md:col-span-2 mb-4">
          <h2 className="text-lg font-bold text-stone-800 border-b border-stone-100 pb-2 mb-4">Branding & Logo</h2>
          <div className="flex items-center space-x-6">
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-stone-300 flex items-center justify-center bg-stone-50 overflow-hidden relative shrink-0">
              {profile.logoUrl ? (
                <img src={profile.logoUrl} alt="Farm Logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-stone-400 text-xs text-center px-2">No Logo<br/>Uploaded</span>
              )}
              {isUploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                ref={logoInputRef}
                onChange={handleLogoUpload}
              />
              <button type="button" onClick={() => logoInputRef.current?.click()} className="flex items-center space-x-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-sm font-medium transition-colors">
                <Upload size={16} />
                <span>Upload Logo (JPG, PNG)</span>
              </button>
              <button type="button" onClick={handleRemoveLogo} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors block">
                Remove Logo
              </button>
            </div>
          </div>
        </div>
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
