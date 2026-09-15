const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const target = `  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // Don't overwrite if we are using the dummy user in UI preview mode
      if (auth.app.options.apiKey === 'dummy-key' && useAppStore.getState().user?.uid === 'dummy') {
        setLoading(false);
        return;
      }
      
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          role: 'ADMIN', // Ideally fetched from user claims or firestore document
          farmId: 'farm-1', // Ideally fetched
          languagePref: 'en'
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser]);`;

const replacement = `  useEffect(() => {
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
            role: 'ADMIN', 
            farmId: 'farm-1', 
            languagePref: 'en' as 'en' | 'ne'
          };

          if (!userSnap.exists()) {
            await setDoc(userRef, userData);
          } else {
            userData = { ...userData, ...userSnap.data() } as typeof userData;
          }

          setUser(userData);
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
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setUser]);`;

// try to replace using normal replace
if (content.includes(target)) {
  fs.writeFileSync('src/App.tsx', content.replace(target, replacement));
  console.log("Replaced exactly!");
} else {
  // if exact match fails, do regex or manual
  console.log("Did not match exact string, doing regex...");
  const regex = /useEffect\(\(\) => \{[\s\S]*?return \(\) => unsubscribe\(\);\n  \}, \[setUser\]\);/m;
  if(regex.test(content)) {
    fs.writeFileSync('src/App.tsx', content.replace(regex, replacement));
    console.log("Replaced via regex!");
  } else {
    console.log("Could not find block");
  }
}
