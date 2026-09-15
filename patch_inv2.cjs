const fs = require('fs');
let content = fs.readFileSync('src/pages/Inventory.tsx', 'utf8');
content = content.replace(
  "import { InventoryItem, Category } from '../types';",
  "import { InventoryItem, Category } from '../types';\nimport NepaliDatePicker from '../components/NepaliDatePicker';"
);
fs.writeFileSync('src/pages/Inventory.tsx', content);
console.log('Fixed Inventory');
