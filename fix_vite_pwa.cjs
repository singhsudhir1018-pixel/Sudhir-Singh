const fs = require('fs');

let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace(
  /workbox: \{\s*globPatterns: \['\*\*\/\*\.\{js,css,html,ico,png,svg,woff,woff2\}'\]\s*\}/,
  "workbox: {\n        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],\n        maximumFileSizeToCacheInBytes: 5000000\n      }"
);

fs.writeFileSync('vite.config.ts', content);
console.log('Fixed Vite PWA');
