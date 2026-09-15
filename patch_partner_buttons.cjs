const fs = require('fs');

let content = fs.readFileSync('src/pages/Parties.tsx', 'utf8');

const regex = /(<p className="font-bold text-orange-600">Rs. \{partner\.dividendPayable\.toLocaleString\(\)\}<\/p>\s*<\/div>\s*<\/div>)/;

const newButtons = `
                <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between space-x-2">
                  <button 
                    onClick={() => setSelectedPartnerForContrib(partner)}
                    className="flex-1 flex justify-center items-center space-x-1 py-2 px-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-sm font-medium transition-colors"
                  >
                    <Plus size={16} />
                    <span>{t.addContribution || 'Add Contribution'}</span>
                  </button>
                  <button 
                    onClick={() => setSelectedPartnerForLedger(partner)}
                    className="flex-1 flex justify-center items-center space-x-1 py-2 px-3 bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-xl text-sm font-medium transition-colors"
                  >
                    <BookOpen size={16} />
                    <span>{t.viewLedger || 'View Ledger'}</span>
                  </button>
                </div>
`;

content = content.replace(regex, (match) => match + newButtons);

fs.writeFileSync('src/pages/Parties.tsx', content);
console.log('Patched Partner buttons');
