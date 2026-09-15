const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryManagement.tsx', 'utf8');

content = content.replace(
  /import \{ Plus, Edit2, Trash2, ChevronDown, ChevronRight, Layers, FileText \} from 'lucide-react';/,
  "import { Plus, Edit2, Trash2, ChevronDown, ChevronRight, Layers, FileText, X } from 'lucide-react';"
);

fs.writeFileSync('src/components/CategoryManagement.tsx', content);
console.log('Fixed CategoryManagement');
