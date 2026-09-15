const fs = require('fs');
let content = fs.readFileSync('src/pages/Accounts.tsx', 'utf8');

if (!content.includes('NepaliDatePicker')) {
  content = content.replace(
    /import \{ Plus, Edit2, Trash2, ArrowRightLeft, Landmark, Wallet \} from 'lucide-react';/,
    "import { Plus, Edit2, Trash2, ArrowRightLeft, Landmark, Wallet } from 'lucide-react';\nimport NepaliDatePicker from '../components/NepaliDatePicker';"
  );
  
  const oldDate = /<input type="text" required value=\{transferForm\.dateBS\} onChange=\{e => setTransferForm\(\{\.\.\.transferForm, dateBS: e\.target\.value\}\)\} className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500" \/>/g;
  const newDate = `<NepaliDatePicker value={transferForm.dateBS} onChange={(val) => setTransferForm({...transferForm, dateBS: val})} />`;
  
  content = content.replace(oldDate, newDate);
  fs.writeFileSync('src/pages/Accounts.tsx', content);
  console.log('Patched Accounts.tsx');
}
