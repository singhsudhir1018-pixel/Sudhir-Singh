const fs = require('fs');

const files = [
  'src/pages/Tasks.tsx',
  'src/pages/Transactions.tsx',
  'src/pages/Leases.tsx',
  'src/pages/Inventory.tsx',
  'src/pages/Employees.tsx',
  'src/pages/Accounts.tsx',
  'src/components/AddContributionModal.tsx'
];

for (let file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Remove overflow-hidden from modal wrappers
    content = content.replace(/overflow-hidden/g, '');
    fs.writeFileSync(file, content);
  }
}
console.log('Done removing overflow-hidden');
