const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const overlay = `{isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-stone-900/50 z-40 md:hidden animate-in fade-in"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}`;
      
if (!content.includes('bg-stone-900/50 z-40')) {
  content = content.replace(
    /{ \/\* Main Content \*\/ }/,
    overlay + '\n      {/* Main Content */}'
  );
  fs.writeFileSync('src/components/Layout.tsx', content);
}
