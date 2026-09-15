const fs = require('fs');
let content = fs.readFileSync('src/lib/firebase.ts', 'utf8');

content = content.replace(
  /import \{ getFirestore \} from 'firebase\/firestore';/,
  "import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';"
);

content = content.replace(
  /export const db = getFirestore\(app\);/,
  "export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });"
);

fs.writeFileSync('src/lib/firebase.ts', content);
console.log('Patched firebase.ts');
