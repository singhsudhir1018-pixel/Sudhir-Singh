const fs = require('fs');
let content = fs.readFileSync('src/lib/translations.ts', 'utf8');

const englishAdditions = `
    // Partner Contributions
    addContribution: 'Add Contribution',
    viewLedger: 'View Ledger',
    contributionAmount: 'Amount Added (Rs.)',
    contributionDate: 'Contribution Date (B.S.)',
    paymentDestination: 'Payment Destination Account',
    paymentMethod: 'Payment Method',
    remarksNotes: 'Remarks / Notes',
    saveContribution: 'Save Contribution',
    contributionHistory: 'Contribution History',
    runningTotal: 'Running Total',
    noContributions: 'No contributions found for this partner.',
    printExport: 'Print / Export',
    cashBankDropdownLabel: '-- Select Account --',
`;

const nepaliAdditions = `
    // Partner Contributions
    addContribution: 'थप लगानी',
    viewLedger: 'लेजर हेर्नुहोस्',
    contributionAmount: 'थप रकम (रु.)',
    contributionDate: 'लगानी मिति (B.S.)',
    paymentDestination: 'रकम जम्मा हुने खाता',
    paymentMethod: 'भुक्तानी माध्यम',
    remarksNotes: 'कैफियत / टिप्पणी',
    saveContribution: 'लगानी सुरक्षित गर्नुहोस्',
    contributionHistory: 'लगानी इतिहास',
    runningTotal: 'कुल लगानी',
    noContributions: 'यस साझेदारको कुनै लगानी रेकर्ड भेटिएन।',
    printExport: 'प्रिन्ट / निकाल्नुहोस्',
    cashBankDropdownLabel: '-- खाता छान्नुहोस् --',
`;

let enRegex = /(en:\s*\{[\s\S]*?)(\s*\})/m;
let neRegex = /(ne:\s*\{[\s\S]*?)(\s*\})/m;

content = content.replace(enRegex, (match, p1, p2) => p1 + englishAdditions + p2);
content = content.replace(neRegex, (match, p1, p2) => p1 + nepaliAdditions + p2);

fs.writeFileSync('src/lib/translations.ts', content);
console.log('Translations updated for Partner Contributions.');
