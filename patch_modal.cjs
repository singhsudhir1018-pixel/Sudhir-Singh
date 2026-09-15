const fs = require('fs');
let content = fs.readFileSync('src/components/AddContributionModal.tsx', 'utf8');

if (!content.includes('NepaliDatePicker')) {
  content = content.replace(
    /import \{ X, Save, Loader2 \} from 'lucide-react';/,
    "import { X, Save, Loader2 } from 'lucide-react';\nimport NepaliDatePicker from './NepaliDatePicker';"
  );
  
  const oldDate = /<input\s*type="text"\s*required\s*value=\{form\.dateBS\}\s*onChange=\{e => setForm\(\{\.\.\.form, dateBS: e\.target\.value\}\)\}\s*className="w-full px-4 py-2 border border-stone-200 rounded-xl focus:ring-2 focus:ring-green-500"\s*\/>/g;
  const newDate = `<NepaliDatePicker value={form.dateBS} onChange={(val) => setForm({...form, dateBS: val})} />`;
  
  content = content.replace(oldDate, newDate);
  fs.writeFileSync('src/components/AddContributionModal.tsx', content);
  console.log('Patched modal');
}
