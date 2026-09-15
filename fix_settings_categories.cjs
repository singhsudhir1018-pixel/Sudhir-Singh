const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

// Remove the remaining useEffect hook for categories
content = content.replace(/useEffect\(\(\) => \{\s*if \(\!farmId\) return;\s*const q = query\(collection\(db, 'categories'\)[\s\S]*?return \(\) => unsub\(\);\s*\}, \[farmId\]\);/g, '');

// Also remove `import CategoryManagement from '../components/CategoryManagement';` if it was duplicated
fs.writeFileSync('src/pages/Settings.tsx', content);
console.log('Fixed settings leftover');
