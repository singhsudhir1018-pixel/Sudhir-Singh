const fs = require('fs');
let content = fs.readFileSync('src/lib/translations.ts', 'utf8');

const englishAdditions = `
    // Header Profile Keys
    myProfile: 'My Profile',
    farmSettings: 'Farm Settings',
    roleAdmin: 'Admin',
    roleManager: 'Manager',
    roleAccountant: 'Accountant',
    roleWorker: 'Worker',
`;

const nepaliAdditions = `
    // Header Profile Keys
    myProfile: 'मेरो प्रोफाइल',
    farmSettings: 'फार्म सेटिङहरू',
    roleAdmin: 'प्रशासक',
    roleManager: 'प्रबन्धक',
    roleAccountant: 'लेखापाल',
    roleWorker: 'कर्मचारी',
`;

let enRegex = /(en:\s*\{[\s\S]*?)(\s*\})/m;
let neRegex = /(ne:\s*\{[\s\S]*?)(\s*\})/m;

content = content.replace(enRegex, (match, p1, p2) => p1 + englishAdditions + p2);
content = content.replace(neRegex, (match, p1, p2) => p1 + nepaliAdditions + p2);

fs.writeFileSync('src/lib/translations.ts', content);
console.log('Translations updated for Header Profile.');
