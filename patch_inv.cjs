const fs = require('fs');
let content = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');

if (!content.includes('NepaliDatePicker')) {
  content = content.replace(
    /import \{ Plus, Edit2, Trash2, AlertCircle \} from 'lucide-react';/,
    "import { Plus, Edit2, Trash2, AlertCircle } from 'lucide-react';\nimport NepaliDatePicker from '../components/NepaliDatePicker';"
  );
  
  const oldDate = /<input\s*type="text"\s*value=\{formData.expiryDateBS\}\s*onChange=\{e => setFormData\(\{\.\.\.formData, expiryDateBS: e\.target\.value\}\)\}\s*placeholder="YYYY Month DD"\s*className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"\s*\/>/;
  const newDate = `<NepaliDatePicker value={formData.expiryDateBS} onChange={(val) => setFormData({...formData, expiryDateBS: val})} />`;
  
  content = content.replace(oldDate, newDate);
  fs.writeFileSync('src/pages/Inventory.tsx', content);
  console.log('Patched Inventory.tsx');
}
