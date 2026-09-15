const fs = require('fs');
let content = fs.readFileSync('src/pages/Transactions.tsx', 'utf8');

if (!content.includes('NepaliDatePicker')) {
  content = content.replace(
    /import \{ Plus, Upload, MoreHorizontal, Filter, Search \} from 'lucide-react';/,
    "import { Plus, Upload, MoreHorizontal, Filter, Search } from 'lucide-react';\nimport NepaliDatePicker from '../components/NepaliDatePicker';"
  );
  
  const oldInput = `<input 
                      type="text" 
                      value={formData.dateBS}
                      onChange={e => setFormData({...formData, dateBS: e.target.value})}
                      placeholder="YYYY Month DD"
                      required
                      className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                    />`;
  const newInput = `<NepaliDatePicker value={formData.dateBS} onChange={(val) => setFormData({...formData, dateBS: val})} />`;
  
  content = content.replace(oldInput, newInput);
  fs.writeFileSync('src/pages/Transactions.tsx', content);
  console.log('Patched Transactions.tsx');
}
