const fs = require('fs');

// Fix translations
let content = fs.readFileSync('src/lib/translations.ts', 'utf8');
content = content.replace(/address: 'Residential \/ Contact Address',/g, '');
content = content.replace(/status: 'Status',/g, '');
content = content.replace(/address: 'ठेगाना',/g, '');
content = content.replace(/status: 'स्थिति',/g, '');
fs.writeFileSync('src/lib/translations.ts', content);

// Fix UserManagement.tsx backticks
let umContent = fs.readFileSync('src/components/UserManagement.tsx', 'utf8');
umContent = umContent.replace(/\\`/g, '`');
umContent = umContent.replace(/\\\$/g, '$');
fs.writeFileSync('src/components/UserManagement.tsx', umContent);

console.log('Fixed syntax issues.');
