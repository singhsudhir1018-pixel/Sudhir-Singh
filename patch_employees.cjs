const fs = require('fs');
let content = fs.readFileSync('src/pages/Employees.tsx', 'utf8');

if (!content.includes('NepaliDatePicker')) {
  content = content.replace(
    /import \{ Plus, Trash2, UserCircle \} from 'lucide-react';/,
    "import { Plus, Trash2, UserCircle } from 'lucide-react';\nimport NepaliDatePicker from '../components/NepaliDatePicker';"
  );
  
  const oldDate = /<input type="text" required value=\{formData\.joinDateBS\} onChange=\{e => setFormData\(\{...formData, joinDateBS: e\.target\.value\}\)\} className="w-full px-4 py-2 border rounded-xl" \/>/g;
  const newDate = `<NepaliDatePicker value={formData.joinDateBS} onChange={val => setFormData({...formData, joinDateBS: val})} />`;
  
  content = content.replace(oldDate, newDate);
  fs.writeFileSync('src/pages/Employees.tsx', content);
  console.log('Patched Employees.tsx');
}
