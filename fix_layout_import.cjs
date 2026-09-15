const fs = require('fs');

let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

content = content.replace(
  /import \{ LayoutDashboard, Receipt, Package, Settings as SettingsIcon, LogOut, Languages, Users, Map, UserCircle, CheckSquare, PieChart, Landmark, ChevronDown, User \} from 'lucide-react';/,
  "import { LayoutDashboard, Receipt, Package, Settings as SettingsIcon, LogOut, Languages, Users, Map, UserCircle, CheckSquare, PieChart, Landmark, ChevronDown, User, Menu, X } from 'lucide-react';"
);

fs.writeFileSync('src/components/Layout.tsx', content);
console.log('Fixed Layout import');
