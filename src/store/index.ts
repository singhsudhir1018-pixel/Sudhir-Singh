import { create } from 'zustand';
import { UserProfile } from '../types';

interface AppState {
  language: 'en' | 'ne';
  setLanguage: (lang: 'en' | 'ne') => void;
  user: UserProfile | null;
  setUser: (user: UserProfile | null) => void;
  farmId: string | null;
  setFarmId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
  user: null,
  setUser: (user) => set({ user }),
  farmId: null,
  setFarmId: (id) => set({ farmId: id }),
}));
