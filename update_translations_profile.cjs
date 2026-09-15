const fs = require('fs');
let content = fs.readFileSync('src/lib/translations.ts', 'utf8');

const englishAdditions = `
    // Profile Keys
    farmProfileSaved: 'Farm profile saved successfully!',
    saving: 'Saving...',
`;

const nepaliAdditions = `
    // Profile Keys
    farmProfileSaved: 'फार्म विवरण सफलतापूर्वक बचत भयो!',
    saving: 'बचत गर्दै...',
`;

let enRegex = /(en:\s*\{[\s\S]*?)(\s*\})/m;
let neRegex = /(ne:\s*\{[\s\S]*?)(\s*\})/m;

content = content.replace(enRegex, (match, p1, p2) => p1 + englishAdditions + p2);
content = content.replace(neRegex, (match, p1, p2) => p1 + nepaliAdditions + p2);

fs.writeFileSync('src/lib/translations.ts', content);
console.log('Translations updated for Farm Profile.');
