const fs = require('fs');

let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

// Add import
if (!content.includes("import CategoryManagement")) {
  content = content.replace(
    /import FarmProfile from '\.\.\/components\/FarmProfile';/,
    "import FarmProfile from '../components/FarmProfile';\nimport CategoryManagement from '../components/CategoryManagement';"
  );
}

// Remove category state variables
content = content.replace(/const \[categories, setCategories\] = useState[^;]+;/g, '');
content = content.replace(/const \[isCategoryModalOpen, setIsCategoryModalOpen\] = useState[^;]+;/g, '');
content = content.replace(/const \[editingCategoryId, setEditingCategoryId\] = useState[^;]+;/g, '');
content = content.replace(/const \[categoryForm, setCategoryForm\] = useState[^;]+;/g, '');

// Remove categories useEffect
content = content.replace(/useEffect\(\(\) => \{\s*if \(\!farmId\) return;\s*const q = query\(collection\(db, 'categories'\)[^;]+;\s*const unsub = onSnapshot[^;]+;\s*return \(\) => unsub\(\);\s*\}, \[farmId\]\);/g, '');

// Remove handleSaveCategory
content = content.replace(/const handleSaveCategory = async[\s\S]*?\} catch \(err\) \{\s*console\.error\('Failed to save category', err\);\s*\}\s*\};/g, '');

// Remove handleDeleteCategory
content = content.replace(/const handleDeleteCategory = async[\s\S]*?\} catch \(err\) \{\s*console\.error\('Failed to delete category', err\);\s*\}\s*\}\s*\};/g, '');

// Replace activeTab === 'CATEGORIES' block
content = content.replace(/\{activeTab === 'CATEGORIES' && \([\s\S]*?\{activeTab === 'USERS'/g, "{activeTab === 'CATEGORIES' && <CategoryManagement />}\n        {activeTab === 'USERS'");

// Remove the category modal completely
content = content.replace(/\{isCategoryModalOpen && \([\s\S]*?\}\s*\}\s*\)\s*\}/g, "");

fs.writeFileSync('src/pages/Settings.tsx', content);
console.log('Fixed Settings.tsx');
