const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

const importRegex = /import React, { useState, useEffect } from 'react';/;
content = content.replace(importRegex, `import React, { useState, useEffect } from 'react';\nimport UserManagement from '../components/UserManagement';`);

const tabButtonRegex = /<button[\s\S]*?onClick=\{\(\) => setActiveTab\('CATEGORIES'\)\}[\s\S]*?<\/button>/;
const usersTabHtml = `
          <button
            onClick={() => setActiveTab('USERS')}
            className={\`px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap \${
              activeTab === 'USERS'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
            }\`}
          >
            {t.userManagement || 'User Management'}
          </button>
`;
content = content.replace(tabButtonRegex, (match) => match + usersTabHtml);

const newTabContentRegex = /\{activeTab === 'CATEGORIES' && \([\s\S]*?\}\)/;
const usersTabContent = `
        {activeTab === 'USERS' && (
          <UserManagement />
        )}
`;
// Insert after CATEGORIES block
let lastIndex = content.lastIndexOf("        {activeTab === 'CATEGORIES' && (");
// Actually, it's safer to just replace the whole CATEGORIES block with itself + USERS block.
let categoriesBlockRegex = /(\{activeTab === 'CATEGORIES' && \([\s\S]*?<\/div>\n        \}\))/;
content = content.replace(categoriesBlockRegex, (match) => match + usersTabContent);

// Update type of activeTab if necessary
content = content.replace(/useState<'GENERAL' \| 'CATEGORIES'>\('GENERAL'\);/, `useState<'GENERAL' | 'CATEGORIES' | 'USERS'>('GENERAL');`);

fs.writeFileSync('src/pages/Settings.tsx', content);
console.log('Settings patched.');
