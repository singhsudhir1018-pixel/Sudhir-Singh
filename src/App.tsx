import React from 'react';
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './lib/firebase';
import { useAppStore } from './store';
import { nativeMobileService } from './services/nativeMobileService';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Inventory from './pages/Inventory';
import Settings from './pages/Settings';
import Parties from './pages/Parties';
import Tasks from './pages/Tasks';
import Employees from './pages/Employees';
import Leases from './pages/Leases';
import Finance from './pages/Finance';
import Accounts from './pages/Accounts';
import GalleryReceipts from './pages/GalleryReceipts';
import Login from './pages/Login';

export default function App() {
  const { user, setUser, setFarmId } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize native mobile integrations (StatusBar, Back Button, Local Notifications)
    nativeMobileService.initNativeFeatures();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Don't overwrite if we are using the dummy user in UI preview mode
      if (auth.app.options.apiKey === 'dummy-key' && useAppStore.getState().user?.uid === 'dummy') {
        setLoading(false);
        return;
      }
      
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userSnap = await getDoc(userRef);
          
          let userData = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            role: 'ADMIN' as 'ADMIN', 
            farmId: 'farm-1', 
            languagePref: 'en' as 'en' | 'ne' 
          };

          if (!userSnap.exists()) {
            await setDoc(userRef, userData);
          } else {
            userData = { ...userData, ...userSnap.data() };
          }

          setUser(userData); setFarmId(userData.farmId);
        } catch (error) {
          console.error("Error fetching user data:", error);
          // Fallback if firestore rules fail during initial setup
          setUser({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'User',
            email: firebaseUser.email || '',
            role: 'ADMIN', 
            farmId: 'farm-1', 
            languagePref: 'en' as 'en' | 'ne'
          });
          setFarmId('farm-1');
        }
      } else {
        setUser(null); setFarmId(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser, setFarmId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {!user ? (
          <Route path="*" element={<Login />} />
        ) : (
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/leases" element={<Leases />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/gallery" element={<GalleryReceipts />} />
            <Route path="/finance" element={<Finance />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

