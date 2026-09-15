import { getStorage } from 'firebase/storage';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBwj4eeEZ4mG7uBJ162UchkUc9HAvQOTrI",
  authDomain: "agrifarm-management-system.firebaseapp.com",
  projectId: "agrifarm-management-system",
  storageBucket: "agrifarm-management-system.firebasestorage.app",
  messagingSenderId: "218610140216",
  appId: "1:218610140216:web:3aeddc2c3d4324b25e52cd"
};

// Initialize Firebase only if we have a config (or dummy config for UI preview)
const app = initializeApp(firebaseConfig.apiKey ? firebaseConfig : {
    apiKey: "dummy-key",
    authDomain: "dummy.firebaseapp.com",
    projectId: "dummy-project"
});

export const auth = getAuth(app);
export const db = initializeFirestore(app, { 
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true 
});
export const storage = getStorage(app);
