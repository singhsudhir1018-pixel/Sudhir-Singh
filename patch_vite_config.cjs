const fs = require('fs');
let content = fs.readFileSync('vite.config.ts', 'utf8');

content = content.replace(
  /import \{defineConfig, Plugin\} from 'vite';/,
  "import {defineConfig, Plugin} from 'vite';\nimport { VitePWA } from 'vite-plugin-pwa';"
);

const pwaPlugin = `VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        id: '/',
        name: 'AgriFarm Management System',
        short_name: 'AgriFarm',
        description: 'Comprehensive Agriculture Farm Management Platform',
        theme_color: '#16a34a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
      }
    }), `;

content = content.replace(
  /plugins: \[react\(\), tailwindcss\(\), aistudioMediaPlugin\(\)\]/,
  `plugins: [react(), tailwindcss(), aistudioMediaPlugin(), ${pwaPlugin}]`
);

fs.writeFileSync('vite.config.ts', content);
console.log('Patched vite.config.ts');
