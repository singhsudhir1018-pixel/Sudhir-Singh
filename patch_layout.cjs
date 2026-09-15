const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

// Add new imports for Dropdown and Click Outside
content = content.replace(
  /import { useState, useEffect } from 'react';/,
  "import { useState, useEffect, useRef } from 'react';"
);
if (!content.includes('useState')) {
    content = content.replace(
        /import React from 'react';/,
        "import React, { useState, useEffect, useRef } from 'react';"
    );
}

// Ensure icons are imported
content = content.replace(
    /import { LayoutDashboard, Receipt, Package, Settings as SettingsIcon, LogOut, Languages, Users, Map, UserCircle, CheckSquare, PieChart, Landmark } from 'lucide-react';/,
    "import { LayoutDashboard, Receipt, Package, Settings as SettingsIcon, LogOut, Languages, Users, Map, UserCircle, CheckSquare, PieChart, Landmark, ChevronDown, User } from 'lucide-react';"
);

// Remove the Logout button from sidebar
const sidebarLogoutRegex = /<div className="p-4 border-t border-stone-200">[\s\S]*?<\/button>\s*<\/div>/;
content = content.replace(sidebarLogoutRegex, "");

// Replace the entire Header logic
const headerRegex = /<header className="bg-white border-b border-stone-200 h-16 flex items-center justify-between px-6 shrink-0">[\s\S]*?<\/header>/;

const newHeader = `
        <header className="bg-white border-b border-stone-200 h-16 flex items-center justify-between px-6 shrink-0 relative z-20">
          <div className="md:hidden">
            <h1 className="text-lg font-bold text-green-700">{t.appTitle}</h1>
          </div>
          <div className="hidden md:block"> 
            <h2 className="text-lg font-medium text-stone-800">{user?.name ? \`\${t.welcome}, \${user.name}\` : ''}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setLanguage(language === 'en' ? 'ne' : 'en')}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 transition-colors"
            >
              <Languages size={18} className="text-stone-500" />
              <span className="text-sm font-medium">{language === 'en' ? 'नेपाली' : 'English'}</span>
            </button>
            
            {/* User Profile Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 hover:bg-stone-50 p-1.5 rounded-xl transition-colors focus:outline-none"
              >
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white font-bold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-semibold text-stone-700 leading-tight">{user?.name || 'User'}</p>
                  <p className="text-xs text-stone-500">{getRoleDisplay(user?.role)}</p>
                </div>
                <ChevronDown size={16} className={\`text-stone-400 transition-transform duration-200 \${isDropdownOpen ? 'rotate-180' : ''}\`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden origin-top-right transform transition-all animate-in fade-in slide-in-from-top-2">
                  <div className="p-4 border-b border-stone-50 bg-stone-50/50">
                    <p className="font-bold text-stone-800 truncate">{user?.name}</p>
                    <p className="text-sm text-stone-500 truncate">{user?.email}</p>
                    <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-green-100 text-green-700 text-xs font-medium border border-green-200">
                      {getRoleDisplay(user?.role)}
                    </div>
                  </div>
                  
                  <div className="p-2 space-y-1">
                    <Link 
                      to="/settings" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 text-stone-700 transition-colors"
                    >
                      <User size={18} className="text-stone-400" />
                      <span className="font-medium text-sm">{t.myProfile || 'My Profile'}</span>
                    </Link>
                    
                    <Link 
                      to="/settings" 
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 text-stone-700 transition-colors"
                    >
                      <SettingsIcon size={18} className="text-stone-400" />
                      <span className="font-medium text-sm">{t.farmSettings || 'Farm Settings'}</span>
                    </Link>
                  </div>
                  
                  <div className="p-2 border-t border-stone-100">
                    <button 
                      onClick={handleLogout}
                      className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 transition-colors w-full text-left"
                    >
                      <LogOut size={18} className="text-red-500" />
                      <span className="font-medium text-sm">{t.logout || 'Logout'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
`;

content = content.replace(headerRegex, newHeader);

// Add Hooks inside the Layout component
const hookCode = `
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const getRoleDisplay = (role: string | undefined) => {
    if (!role) return '';
    switch(role) {
      case 'ADMIN': return t.roleAdmin || 'Admin';
      case 'MANAGER': return t.roleManager || 'Manager';
      case 'ACCOUNTANT': return t.roleAccountant || 'Accountant';
      default: return t.roleWorker || 'Worker';
    }
  };
`;

content = content.replace(/const location = useLocation\(\);/, "const location = useLocation();\n" + hookCode);

fs.writeFileSync('src/components/Layout.tsx', content);
console.log('Layout updated.');
