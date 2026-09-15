const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');
const newTypes = `
export interface PartnerContribution {
  id: string;
  farmId: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  dateBS: string;
  targetAccountId: string;
  paymentMethod: string;
  notes: string;
  createdAt: number;
  createdBy: string;
}
`;

if (!content.includes('PartnerContribution')) {
  fs.appendFileSync('src/types.ts', newTypes);
  console.log('Appended PartnerContribution type');
}
