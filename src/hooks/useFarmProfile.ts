import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAppStore } from '../store';

export interface FarmProfileInfo {
  name: string;
  address: string;
  panNumber: string;
  regNumber: string;
  phone: string;
  email: string;
  logoUrl: string;
}

const EMPTY_PROFILE: FarmProfileInfo = {
  name: '',
  address: '',
  panNumber: '',
  regNumber: '',
  phone: '',
  email: '',
  logoUrl: '',
};

export function useFarmProfile(overrideFarmId?: string): FarmProfileInfo {
  const storeFarmId = useAppStore(state => state.farmId);
  const farmId = overrideFarmId || storeFarmId;

  const [farmDoc, setFarmDoc] = useState<Record<string, any> | null>(null);
  const [settingsProfile, setSettingsProfile] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!farmId) {
      setFarmDoc(null);
      setSettingsProfile(null);
      return;
    }

    const unsubFarm = onSnapshot(
      doc(db, 'farms', farmId),
      snap => {
        setFarmDoc(snap.exists() ? snap.data() : null);
      },
      () => {}
    );

    const unsubSettings = onSnapshot(
      doc(db, 'settings', farmId),
      snap => {
        if (snap.exists() && snap.data()?.profile) {
          setSettingsProfile(snap.data().profile);
        } else {
          setSettingsProfile(null);
        }
      },
      () => {}
    );

    return () => {
      unsubFarm();
      unsubSettings();
    };
  }, [farmId]);

  if (!farmDoc && !settingsProfile) return EMPTY_PROFILE;

  const f = farmDoc || {};
  const s = settingsProfile || {};

  return {
    name: f.name || f.farmName || s.farmName || s.name || '',
    address: f.location || f.address || s.address || s.location || '',
    panNumber: f.panNumber || s.panNumber || '',
    regNumber: f.regNumber || s.regNumber || '',
    phone: f.phone || s.phone || '',
    email: f.email || s.email || '',
    logoUrl: f.logoUrl || s.logoUrl || '',
  };
}
