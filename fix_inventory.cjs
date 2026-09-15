const fs = require('fs');
let content = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

if (!content.includes("import CategorySelect")) {
  content = content.replace(
    /import \{ useAppStore \} from '\.\.\/store';/,
    "import { useAppStore } from '../store';\nimport CategorySelect from '../components/CategorySelect';"
  );
}

// Update initial form state
content = content.replace(
  /category: '',\n\s*currentStock: '',/,
  "category: '',\n    subCategory: '',\n    currentStock: '',"
);

// Update openEdit
content = content.replace(
  /category: item\.category,\n\s*currentStock: item\.currentStock\.toString\(\),/,
  "category: item.category,\n      subCategory: item.subCategory || '',\n      currentStock: item.currentStock.toString(),"
);

// Update payload
content = content.replace(
  /category: formData\.category,/,
  "category: formData.category,\n      subCategory: formData.subCategory,"
);

// Replace select dropdown
// <div className="grid grid-cols-2 gap-4">
//   <div>
//     <label...>{t.itemName}</label>
//     <input.../>
//   </div>
//   <div>
//     <label...>{t.category}</label>
//     <select...</select>
//   </div>
// </div>
content = content.replace(
  /<div className="grid grid-cols-2 gap-4">\s*<div>\s*<label className="block text-sm font-medium text-stone-700 mb-1">\{t\.itemName\}<\/label>[\s\S]*?<\/div>\s*<div>\s*<label className="block text-sm font-medium text-stone-700 mb-1">\{t\.category\}<\/label>[\s\S]*?<\/div>\s*<\/div>/,
  `<div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">{t.itemName}</label>
                  <input
                    type="text"
                    value={formData.itemName}
                    onChange={e => setFormData({...formData, itemName: e.target.value})}
                    required
                    className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                
                <CategorySelect 
                  type="INVENTORY"
                  selectedCategoryName={formData.category}
                  selectedSubCategoryName={formData.subCategory}
                  onCategoryChange={(val) => setFormData({...formData, category: val})}
                  onSubCategoryChange={(val) => setFormData({...formData, subCategory: val})}
                  required
                />`
);

// Update table to show subcategory
content = content.replace(
  /<div className="text-sm text-stone-500">\{item\.category\}<\/div>/,
  `<div className="text-sm text-stone-500">{item.category}{item.subCategory ? \` - \${item.subCategory}\` : ''}</div>`
);

fs.writeFileSync('src/pages/Inventory.tsx', content);
console.log('Fixed Inventory.tsx');
