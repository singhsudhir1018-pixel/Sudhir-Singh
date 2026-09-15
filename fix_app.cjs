const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  /const { user, setUser } = useAppStore\(\);/,
  "const { user, setUser, setFarmId } = useAppStore();"
);

content = content.replace(
  /setUser\(userData\);/g,
  "setUser(userData); setFarmId(userData.farmId);"
);

content = content.replace(
  /setUser\(\{[\s\S]*?farmId: 'farm-1',[\s\S]*?languagePref: 'en'[\s\S]*?\}\);/,
  (match) => match + "\n          setFarmId('farm-1');"
);

content = content.replace(
  /setUser\(null\);/,
  "setUser(null); setFarmId(null);"
);

// We need to make sure the hook dependencies are updated if they include setUser
content = content.replace(
  /\[setUser\]\);/,
  "[setUser, setFarmId]);"
);

fs.writeFileSync('src/App.tsx', content);
console.log('Fixed App.tsx');
