const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

if (!content.includes('farmName')) {
  content = content.replace(
    /import \{ useAppStore \} from '\.\.\/store';/,
    "import { useAppStore } from '../store';\nimport { doc, onSnapshot } from 'firebase/firestore';\nimport { db } from '../lib/firebase';"
  );
  
  content = content.replace(
    /const \{ language, setLanguage, user \} = useAppStore\(\);/,
    "const { language, setLanguage, user, farmId } = useAppStore();\n  const [farmName, setFarmName] = useState('');\n\n  useEffect(() => {\n    if (!farmId) return;\n    const unsub = onSnapshot(doc(db, 'farms', farmId), snap => {\n      if (snap.exists()) setFarmName(snap.data().name);\n    });\n    return () => unsub();\n  }, [farmId]);"
  );
  
  const h1Desktop = `<h1 className="text-xl font-bold text-green-700">{t.appTitle}</h1>`;
  const h1DesktopWithFarm = `<h1 className="text-xl font-bold text-green-700">{t.appTitle}</h1>
          {farmName && <p className="text-sm font-medium text-stone-500 mt-1 flex items-center"><Map size={14} className="mr-1"/> {farmName}</p>}`;
          
  content = content.replace(h1Desktop, h1DesktopWithFarm);
  
  const h1Mobile = `<h1 className="text-lg font-bold text-green-700">{t.appTitle}</h1>`;
  const h1MobileWithFarm = `<h1 className="text-lg font-bold text-green-700">{t.appTitle}</h1>
            {farmName && <p className="text-xs font-medium text-stone-500 flex items-center"><Map size={12} className="mr-1"/> {farmName}</p>}`;
            
  content = content.replace(h1Mobile, h1MobileWithFarm);

  fs.writeFileSync('src/components/Layout.tsx', content);
  console.log('Patched Layout with farmName');
}
