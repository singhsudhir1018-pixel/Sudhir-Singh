const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Add Menu icon to imports
content = content.replace(
  /import \{ LayoutDashboard, CheckSquare, Receipt, Package, Users, PieChart, Settings as SettingsIcon, Map, Languages, LogOut, ChevronDown, User, Landmark \} from 'lucide-react';/,
  "import { LayoutDashboard, CheckSquare, Receipt, Package, Users, PieChart, Settings as SettingsIcon, Map, Languages, LogOut, ChevronDown, User, Landmark, Menu, X } from 'lucide-react';"
);

// Add isMobileMenuOpen state
content = content.replace(
  /const \[isDropdownOpen, setIsDropdownOpen\] = useState\(false\);/,
  "const [isDropdownOpen, setIsDropdownOpen] = useState(false);\n  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);"
);

// Fix Sidebar classes for mobile
content = content.replace(
  /<aside className="w-64 bg-white border-r border-stone-200 flex flex-col hidden md:flex">/,
  `<aside className={\`w-64 bg-white border-r border-stone-200 flex flex-col \${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden md:flex'}\`}>`
);

// Add mobile menu closing wrapper logic and close button inside sidebar if needed.
// Actually, let's just make the Link clicks close the mobile menu.
content = content.replace(
  /to=\{item\.path\}/g,
  "to={item.path}\n                onClick={() => setIsMobileMenuOpen(false)}"
);

// Add hamburger button to header
content = content.replace(
  /<div className="md:hidden">/,
  `<div className="md:hidden flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-lg">
              <Menu size={24} />
            </button>
            <div>`
);
content = content.replace(
  /\{farmName && <p className="text-xs font-medium text-stone-500 flex items-center"><Map size=\{12\} className="mr-1"\/> \{farmName\}<\/p>\}\n          <\/div>/,
  `{farmName && <p className="text-xs font-medium text-stone-500 flex items-center"><Map size={12} className="mr-1"/> {farmName}</p>}
            </div>
          </div>`
);

// Remove "My Profile" and "Farm Settings" from dropdown
content = content.replace(
  /<div className="p-2 space-y-1">[\s\S]*?<div className="p-2 border-t border-stone-100">/,
  `<div className="p-2 border-t border-stone-100">`
);

fs.writeFileSync('src/components/Layout.tsx', content);
console.log('Fixed Layout');
