const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/role: 'ADMIN',/, "role: 'ADMIN' as 'ADMIN',");
fs.writeFileSync('src/App.tsx', content);
