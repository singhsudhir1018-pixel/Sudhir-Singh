const fs = require('fs');
let content = fs.readFileSync('index.html', 'utf8');

const metaTags = `    <meta name="theme-color" content="#16a34a" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="AgriFarm" />
    <link rel="apple-touch-icon" href="/pwa-192x192.png" />
    <link rel="icon" type="image/png" href="/pwa-192x192.png" />`;

content = content.replace(/<title>/, metaTags + '\n    <title>');
fs.writeFileSync('index.html', content);
console.log('Patched index.html');
