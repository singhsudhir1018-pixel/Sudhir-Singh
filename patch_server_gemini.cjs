const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/gemini-3\.6-flash/g, 'gemini-2.5-flash');

const oldCatch = `    const errString = String(error);
    if (errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED') || error?.status === 429) {`;
const newCatch = `    const errString = String(error) + JSON.stringify(error);
    if (errString.includes('429') || errString.includes('RESOURCE_EXHAUSTED') || error?.status === 429) {`;

content = content.replace(new RegExp(oldCatch.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&'), 'g'), newCatch);

fs.writeFileSync('server.ts', content);
console.log('Fixed model name in server.ts');
