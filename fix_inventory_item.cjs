const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');

content = content.replace(
  /export interface InventoryItem \{\n  id: string;\n  farmId: string;\n  itemName: string;\n  category: string;\n/,
  "export interface InventoryItem {\n  id: string;\n  farmId: string;\n  itemName: string;\n  category: string;\n  subCategory?: string;\n"
);
fs.writeFileSync('src/types.ts', content);
