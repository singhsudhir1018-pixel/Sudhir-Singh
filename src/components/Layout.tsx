import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { translations } from '../lib/translations';
import { 
  LayoutDashboard, Receipt, Package, Settings as SettingsIcon, LogOut, 
  Languages, Users, Map as MapIcon, UserCircle, CheckSquare, PieChart, 
  Landmark, ChevronDown, Menu, X, Plus, Search, Command, Activity, Sun, Moon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Layout() {
  const isOnline = useNetworkStatus();
  const { language, setLanguage, user, farmId } = useAppStore();
  const [farmName, setFarmName] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!farmId) return;
    const unsub = onSnapshot(doc(db, 'farms', farmId), snap => {
      if (snap.exists()) setFarmName(snap.data().name);
    });
    return () => unsub();
  }, [farmId]);

  const t = translations[language];

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCmdPaletteOpen, setIsCmdPaletteOpen] = useState(false);
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Command Palette Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setIsCmdPaletteOpen(false);
        setIsFabOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const navItems = [
    { path: '/', label: t.dashboard, icon: LayoutDashboard },
    { path: '/tasks', label: t.tasks, icon: CheckSquare },
    { path: '/transactions', label: t.transactions, icon: Receipt },
    { path: '/accounts', label: t.cashAndBank || 'Cash & Bank', icon: Landmark },
    { path: '/inventory', label: t.inventory, icon: Package },
    { path: '/leases', label: t.leases, icon: MapIcon },
    { path: '/employees', label: t.employees, icon: UserCircle },
    { path: '/parties', label: t.parties, icon: Users },
    { path: '/finance', label: t.finance, icon: PieChart },
    { path: '/settings', label: t.settings, icon: SettingsIcon },
  ];

  const filteredNavItems = navItems.filter(item => 
    item.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex font-sans selection:bg-emerald-200">
      {/* Offline Sync Bar */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-50 px-4 py-1.5 flex items-center justify-center space-x-2 text-sm font-medium shadow-md"
          >
            <Activity size={16} className="animate-pulse" />
            <span>{language === 'en' ? 'Offline Mode - Data saved locally (Auto-syncs when online)' : 'अफलाइन - डाटा लोकल सेभ भएको छ (अनलाइन हुनासाथ सिंक हुनेछ)'}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Palette */}
      <AnimatePresence>
        {isCmdPaletteOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
              onClick={() => setIsCmdPaletteOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-100 overflow-hidden"
            >
              <div className="flex items-center px-4 border-b border-stone-100">
                <Search size={20} className="text-stone-400" />
                <input 
                  autoFocus
                  type="text"
                  placeholder="Search pages, actions... (e.g., 'Transactions')"
                  className="w-full px-4 py-4 bg-transparent outline-none text-stone-700 placeholder-stone-400"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                <button onClick={() => setIsCmdPaletteOpen(false)} className="p-1 text-stone-400 hover:bg-stone-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                <div className="px-3 py-2 text-xs font-semibold text-stone-400 uppercase tracking-wider">Navigation</div>
                {filteredNavItems.map(item => (
                  <button 
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setIsCmdPaletteOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl hover:bg-emerald-50 text-stone-700 hover:text-emerald-700 transition-colors"
                  >
                    <item.icon size={18} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
                {filteredNavItems.length === 0 && (
                  <div className="px-3 py-8 text-center text-stone-500">No results found.</div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar Desktop */}
      <aside className={`w-72 bg-white/80 backdrop-blur-xl border-r border-stone-200/50 flex flex-col ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 shadow-2xl' : 'hidden lg:flex'}`}>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-to-br from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
              {t.appTitle}
            </h1>
            {isMobileMenuOpen && (
              <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden p-2 text-stone-500 hover:bg-stone-100 rounded-xl">
                <X size={20} />
              </button>
            )}
          </div>
          {farmName && (
            <div className="mt-2 inline-flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-100/50">
              <MapIcon size={12} />
              <span>{farmName}</span>
            </div>
          )}
        </div>
        
        <div className="px-4 mb-4">
          <button 
            onClick={() => setIsCmdPaletteOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2 bg-stone-100 hover:bg-stone-200/70 text-stone-500 rounded-xl transition-colors text-sm font-medium border border-stone-200/50"
          >
            <div className="flex items-center space-x-2">
              <Search size={16} />
              <span>Search...</span>
            </div>
            <div className="flex items-center space-x-1 text-xs opacity-70">
              <Command size={12} /><span>K</span>
            </div>
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto pb-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block relative"
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeNavIndicator"
                    className="absolute inset-0 bg-emerald-50 rounded-xl border border-emerald-100/50"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className={`relative flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive ? 'text-emerald-700' : 'text-stone-500 hover:text-stone-800 hover:bg-stone-50'
                }`}>
                  <Icon size={20} className={isActive ? 'text-emerald-600' : ''} />
                  <span className="font-semibold text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/30 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative w-full">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-stone-200/50 h-16 flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-20">
          <div className="flex items-center space-x-3">
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="lg:hidden p-2 -ml-2 text-stone-600 hover:bg-stone-100 rounded-xl transition-colors">
              <Menu size={24} />
            </button>
            <div className="lg:hidden flex flex-col">
              <h1 className="text-lg font-bold bg-gradient-to-br from-emerald-600 to-emerald-800 bg-clip-text text-transparent">{t.appTitle}</h1>
            </div>
            <div className="hidden lg:block"> 
              <h2 className="text-lg font-semibold text-stone-800">
                {user?.name ? `${t.welcome}, ${user.name.split(' ')[0]}` : t.welcome}
              </h2>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 lg:space-x-4">
            {/* Status Indicator (Desktop only) */}
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 border border-stone-200/50">
              <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
              <span className="text-stone-600">{isOnline ? 'Synced' : 'Local'}</span>
            </div>

            <button
              onClick={() => setLanguage(language === 'en' ? 'ne' : 'en')}
              className="flex items-center space-x-2 p-2 lg:px-3 lg:py-1.5 rounded-xl border border-stone-200/50 hover:bg-stone-50 transition-colors text-stone-600"
            >
              <Languages size={18} />
              <span className="hidden lg:inline text-sm font-semibold">{language === 'en' ? 'नेपाली' : 'EN'}</span>
            </button>
            
            {/* User Profile */}
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 hover:bg-stone-50 p-1.5 rounded-xl transition-colors focus:outline-none border border-transparent hover:border-stone-200/50"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white font-bold shadow-sm">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-bold text-stone-700 leading-none">{user?.name || 'User'}</p>
                </div>
                <ChevronDown size={14} className={`hidden md:block text-stone-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-stone-200/50 overflow-hidden origin-top-right z-50"
                  >
                    <div className="p-4 border-b border-stone-100 bg-stone-50/50">
                      <p className="font-bold text-stone-800 truncate">{user?.name}</p>
                      <p className="text-sm text-stone-500 truncate">{user?.email}</p>
                      <div className="mt-2 inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">
                        {user?.role || 'Admin'}
                      </div>
                    </div>
                    <div className="p-2 border-t border-stone-100 bg-white">
                      <button 
                        onClick={handleLogout}
                        className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 transition-colors w-full text-left"
                      >
                        <LogOut size={18} />
                        <span className="font-semibold text-sm">{t.logout || 'Logout'}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-8 bg-stone-50/50 relative">
          <div className="max-w-7xl mx-auto h-full">
            <Outlet />
          </div>
        </div>
      </main>

      {/* Floating Action Button (Mobile Only) */}
      <div className="lg:hidden fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {isFabOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="absolute bottom-16 right-0 mb-4 flex flex-col gap-3 items-end"
            >
              <button onClick={() => { setIsFabOpen(false); navigate('/transactions'); }} className="flex items-center space-x-3 bg-white px-4 py-2 rounded-full shadow-lg border border-stone-100">
                <span className="font-semibold text-stone-700 text-sm">Income / Expense</span>
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-full"><Receipt size={16} /></div>
              </button>
              <button onClick={() => { setIsFabOpen(false); navigate('/tasks'); }} className="flex items-center space-x-3 bg-white px-4 py-2 rounded-full shadow-lg border border-stone-100">
                <span className="font-semibold text-stone-700 text-sm">New Task</span>
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-full"><CheckSquare size={16} /></div>
              </button>
              <button onClick={() => { setIsFabOpen(false); navigate('/inventory'); }} className="flex items-center space-x-3 bg-white px-4 py-2 rounded-full shadow-lg border border-stone-100">
                <span className="font-semibold text-stone-700 text-sm">Update Stock</span>
                <div className="bg-emerald-100 text-emerald-600 p-2 rounded-full"><Package size={16} /></div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button 
          whileTap={{ scale: 0.9 }}
          onClick={() => setIsFabOpen(!isFabOpen)}
          className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-white transition-colors duration-300 ${isFabOpen ? 'bg-stone-800' : 'bg-emerald-600'}`}
        >
          <motion.div animate={{ rotate: isFabOpen ? 45 : 0 }}>
            <Plus size={24} />
          </motion.div>
        </motion.button>
      </div>

    </div>
  );
}
