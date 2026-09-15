const fs = require('fs');
let content = fs.readFileSync('src/pages/Leases.tsx', 'utf8');

if (!content.includes('NepaliDatePicker')) {
  content = content.replace(
    /import \{ Plus, Trash2, Map, FileText, Edit2 \} from 'lucide-react';/,
    "import { Plus, Trash2, Map, FileText, Edit2 } from 'lucide-react';\nimport NepaliDatePicker from '../components/NepaliDatePicker';"
  );
  
  const oldStart = `<input type="text" required value={formData.startDateBS} onChange={e => setFormData({...formData, startDateBS: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />`;
  const newStart = `<NepaliDatePicker value={formData.startDateBS} onChange={val => setFormData({...formData, startDateBS: val})} />`;
  
  const oldEnd = `<input type="text" required value={formData.endDateBS} onChange={e => setFormData({...formData, endDateBS: e.target.value})} className="w-full px-4 py-2 border rounded-xl" />`;
  const newEnd = `<NepaliDatePicker value={formData.endDateBS} onChange={val => setFormData({...formData, endDateBS: val})} />`;
  
  content = content.replace(oldStart, newStart);
  content = content.replace(oldEnd, newEnd);
  
  fs.writeFileSync('src/pages/Leases.tsx', content);
  console.log('Patched Leases.tsx');
}
