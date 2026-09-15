const fs = require('fs');

let content = fs.readFileSync('src/pages/Parties.tsx', 'utf8');

content = content.replace(
  /import \{ Party, Partner, BankAccount \} from '\.\.\/types';/,
  "import { Party, Partner, BankAccount } from '../types';\nimport AddContributionModal from '../components/AddContributionModal';\nimport PartnerLedgerModal from '../components/PartnerLedgerModal';"
);

// We need to add state variables
content = content.replace(
  /const \[editingId, setEditingId\] = useState<string \| null>\(null\);/,
  "const [editingId, setEditingId] = useState<string | null>(null);\n  const [selectedPartnerForContrib, setSelectedPartnerForContrib] = useState<Partner | null>(null);\n  const [selectedPartnerForLedger, setSelectedPartnerForLedger] = useState<Partner | null>(null);"
);

// Render the Modals before the final </div>
const modalRenders = `
      {selectedPartnerForContrib && (
        <AddContributionModal
          partner={selectedPartnerForContrib}
          accounts={accounts}
          isOpen={true}
          onClose={() => setSelectedPartnerForContrib(null)}
        />
      )}
      {selectedPartnerForLedger && (
        <PartnerLedgerModal
          partner={selectedPartnerForLedger}
          isOpen={true}
          onClose={() => setSelectedPartnerForLedger(null)}
        />
      )}
    </div>
  );
`;

content = content.replace(/<\/div>\n\s*\);\n\}/, modalRenders + "}");

// Now inject the buttons in the Partner Card. 
// Let's find the rendering of partner cards.
const partnerCardRegex = /<div className="pt-4 border-t border-stone-100 flex justify-between items-center">[\s\S]*?<\/div>\s*<\/div>\s*\)\)\}/;
// Actually we need to see what's in the partner card first.
fs.writeFileSync('src/pages/Parties.tsx', content);
console.log('Patched Parties state and modals');
