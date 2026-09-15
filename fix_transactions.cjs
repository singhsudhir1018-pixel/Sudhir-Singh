const fs = require('fs');
let content = fs.readFileSync('src/pages/Transactions.tsx', 'utf8');

if (!content.includes("import CategorySelect")) {
  content = content.replace(
    /import \{ useAppStore \} from '\.\.\/store';/,
    "import { useAppStore } from '../store';\nimport CategorySelect from '../components/CategorySelect';"
  );
}

// Update initial form state
content = content.replace(
  /category: '',\n\s*partyId: '',/,
  "category: '',\n    subCategory: '',\n    partyId: '',"
);

// Update openEdit
content = content.replace(
  /category: tx\.category,\n\s*partyId: tx\.partyId \|\| '',/,
  "category: tx.category,\n      subCategory: tx.subCategory || '',\n      partyId: tx.partyId || '',"
);

// Update receipt parser logic
content = content.replace(
  /category: data\.category \|\| prev\.category,/,
  "category: data.category || prev.category,\n          subCategory: data.subCategory || prev.subCategory,"
);

// Replace select dropdown. We need to be careful with the grid.
content = content.replace(
  /<div className="grid grid-cols-2 gap-4">\s*<div>\s*<label className="block text-sm font-medium text-stone-700 mb-1">\{t\.amount\}<\/label>[\s\S]*?<\/div>\s*<div>\s*<label className="block text-sm font-medium text-stone-700 mb-1">\{t\.category\}<\/label>[\s\S]*?<\/div>\s*<\/div>/,
  `<div>
                    <label className="block text-sm font-medium text-stone-700 mb-1">{t.amount}</label>
                    <input
                      type="number"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                      required
                      min="0"
                      className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                  
                  <CategorySelect 
                    type={formData.type}
                    selectedCategoryName={formData.category}
                    selectedSubCategoryName={formData.subCategory}
                    onCategoryChange={(val) => setFormData({...formData, category: val})}
                    onSubCategoryChange={(val) => setFormData({...formData, subCategory: val})}
                    required
                  />`
);

// Also display subcategory in the table
content = content.replace(
  /<div className="text-sm text-stone-500">\{tx\.category\}<\/div>/,
  `<div className="text-sm text-stone-500">{tx.category}{tx.subCategory ? \` - \${tx.subCategory}\` : ''}</div>`
);

fs.writeFileSync('src/pages/Transactions.tsx', content);
console.log('Fixed Transactions.tsx');
