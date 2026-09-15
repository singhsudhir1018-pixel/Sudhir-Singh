const fs = require('fs');
let content = fs.readFileSync('src/lib/translations.ts', 'utf8');

// Insert english translations
content = content.replace(
  /categories: 'Categories',/,
  `categories: 'Categories',
    subCategories: 'Sub-Categories',
    bulkAddSubCategories: 'Bulk Add / Copy-Paste Sub-categories',
    parentCategory: 'Parent Category',
    bulkAddPlaceholder: 'Paste multiple sub-categories here...\\ne.g.\\nFish Feed 2mm\\nFish Feed 4mm\\nMedicine A',
    preview: 'Preview',
    importSubCategories: 'Import Sub-categories',
    selectParentCategory: 'Select Parent Category',`
);

// Insert nepali translations
content = content.replace(
  /categories: 'वर्गहरू \(Categories\)',/,
  `categories: 'वर्गहरू (Categories)',
    subCategories: 'उप-वर्गहरू (Sub-Categories)',
    bulkAddSubCategories: 'एकैपटक धेरै उप-वर्ग थप्नुहोस् (Bulk Add)',
    parentCategory: 'मुख्य वर्ग (Parent Category)',
    bulkAddPlaceholder: 'यहाँ धेरै उप-वर्गहरू पेस्ट गर्नुहोस्...\\nजस्तै:\\nदाना २ एम.एम.\\nभिटामिन',
    preview: 'पूर्वावलोकन (Preview)',
    importSubCategories: 'उप-वर्गहरू सुरक्षित गर्नुहोस्',
    selectParentCategory: 'मुख्य वर्ग छान्नुहोस्',`
);

fs.writeFileSync('src/lib/translations.ts', content);
console.log('Fixed Translations');
