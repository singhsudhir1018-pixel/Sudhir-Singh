const fs = require('fs');

let content = fs.readFileSync('src/pages/Accounts.tsx', 'utf8');

content = content.replace(
  /const { language, farmId } = useAppStore\(\);/,
  "const { language, user } = useAppStore();\n  const farmId = user?.farmId;"
);

// We should also replace other occurrences where `useAppStore()` is destructured for farmId
fs.writeFileSync('src/pages/Accounts.tsx', content);
console.log('Fixed Accounts.tsx');
