const fs = require('fs');

let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');
content = content.replace(
  /const { language, setLanguage, farmId } = useAppStore\(\);/,
  "const { language, setLanguage, user } = useAppStore();\n  const farmId = user?.farmId;"
);

fs.writeFileSync('src/pages/Settings.tsx', content);
console.log('Fixed Settings.tsx');
