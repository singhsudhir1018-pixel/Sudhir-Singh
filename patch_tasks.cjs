const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

if (!content.includes('NepaliDatePicker')) {
  content = content.replace(
    /import \{ Plus, Trash2, Check, Clock, Play \} from 'lucide-react';/,
    "import { Plus, Trash2, Check, Clock, Play } from 'lucide-react';\nimport NepaliDatePicker from '../components/NepaliDatePicker';"
  );
  
  const oldDate = `<input type="text" value={formData.dueDateBS} onChange={e => setFormData({...formData, dueDateBS: e.target.value})} required className="w-full px-4 py-2 border rounded-xl" />`;
  const newDate = `<NepaliDatePicker value={formData.dueDateBS} onChange={val => setFormData({...formData, dueDateBS: val})} />`;
  
  content = content.replace(oldDate, newDate);
  fs.writeFileSync('src/pages/Tasks.tsx', content);
  console.log('Patched Tasks.tsx');
}
