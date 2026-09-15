const fs = require('fs');

let content = fs.readFileSync('src/types.ts', 'utf8');

// Replace duplicate subCategory lines
content = content.replace(/  subCategory\?: string;\n  subCategory\?: string;\n/g, "  subCategory?: string;\n");
fs.writeFileSync('src/types.ts', content);
