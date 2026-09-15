const fs = require('fs');

let content = fs.readFileSync('src/components/FarmProfile.tsx', 'utf8');
content = content.replace(
  /const { farmId, language, user } = useAppStore\(\);/,
  "const { language, user } = useAppStore();\n  const farmId = user?.farmId;"
);

// If there's an early return without setting isLoading to false:
content = content.replace(
  /if \(!farmId\) return;/,
  "if (!farmId) {\n      setIsLoading(false);\n      return;\n    }"
);

fs.writeFileSync('src/components/FarmProfile.tsx', content);
console.log('Fixed FarmProfile.tsx');
