import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { 
  TrendingUp, TrendingDown, Wallet, AlertTriangle, ArrowRight, 
  Map as MapIcon, UserCircle, CheckSquare, Briefcase, Sparkles, Activity
} from 'lucide-react';
import { Link } from 'react-router-dom';
import CashBankBalanceCard from '../components/CashBankBalanceCard';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Transaction, InventoryItem, Lease, Employee, Task, Partner } from '../types';
import { motion } from 'framer-motion';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';

export default function Dashboard() {
  const { language, farmId } = useAppStore();
  const t = translations[language];

  const [metrics, setMetrics] = useState({
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    lowStockItems: 0,
    activeLeases: 0,
    activeEmployees: 0,
    pendingTasks: 0,
    totalInvestment: 0,
  });

  const [monthlyData, setMonthlyData] = useState<any[]>([]);

  const [aiSummary, setAiSummary] = useState('');
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (!farmId) return;

    let totalInc = 0; let totalExp = 0; let lowStock = 0; let leases = 0; let employees = 0; let tasks = 0; let investment = 0;

    const unsubTxs = onSnapshot(query(collection(db, 'transactions'), where('farmId', '==', farmId)), snap => {
      totalInc = 0; totalExp = 0;
      
      const monthlyMap: Record<string, {name: string, income: number, expense: number}> = {};
      
      snap.forEach(d => {
        const tx = d.data() as Transaction;
        if (tx.type === 'INCOME') totalInc += tx.amount;
        if (tx.type === 'EXPENSE') totalExp += tx.amount;
        
        const month = tx.dateBS ? tx.dateBS.split(' ')[1] : 'Unknown';
        if (!monthlyMap[month]) monthlyMap[month] = { name: month, income: 0, expense: 0 };
        if (tx.type === 'INCOME') monthlyMap[month].income += tx.amount;
        if (tx.type === 'EXPENSE') monthlyMap[month].expense += tx.amount;
      });
      
      const chartData = Object.values(monthlyMap);
      if (chartData.length === 0) {
        setMonthlyData([
          { name: 'Baisakh', income: 0, expense: 0 },
          { name: 'Jestha', income: 0, expense: 0 }
        ]);
      } else {
        setMonthlyData(chartData);
      }
      
      updateMetrics();
    });

    const unsubInv = onSnapshot(query(collection(db, 'inventory'), where('farmId', '==', farmId)), snap => {
      lowStock = 0;
      snap.forEach(d => {
        const item = d.data() as InventoryItem;
        if (item.currentStock < item.minThreshold) lowStock++;
      });
      updateMetrics();
    });

    const unsubLeases = onSnapshot(query(collection(db, 'leases'), where('farmId', '==', farmId)), snap => {
      leases = snap.size;
      updateMetrics();
    });

    const unsubEmp = onSnapshot(query(collection(db, 'employees'), where('farmId', '==', farmId)), snap => {
      employees = snap.size;
      updateMetrics();
    });

    const unsubTasks = onSnapshot(query(collection(db, 'tasks'), where('farmId', '==', farmId)), snap => {
      tasks = 0;
      snap.forEach(d => {
        if ((d.data() as Task).status !== 'COMPLETED') tasks++;
      });
      updateMetrics();
    });

    const unsubPartners = onSnapshot(query(collection(db, 'partners'), where('farmId', '==', farmId)), snap => {
      investment = 0;
      snap.forEach(d => {
        investment += (d.data() as Partner).investmentAmount;
      });
      updateMetrics();
    });

    function updateMetrics() {
      setMetrics({
        totalIncome: totalInc,
        totalExpense: totalExp,
        netProfit: totalInc - totalExp,
        lowStockItems: lowStock,
        activeLeases: leases,
        activeEmployees: employees,
        pendingTasks: tasks,
        totalInvestment: investment,
      });
    }

    return () => { unsubTxs(); unsubInv(); unsubLeases(); unsubEmp(); unsubTasks(); unsubPartners(); };
  }, [farmId]);

  useEffect(() => {
    const fetchSummary = async () => {
      setLoadingAi(true);
      try {
        const response = await fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metrics, language }),
        });
        const data = await response.json();
        if (data.summary) {
          setAiSummary(data.summary);
        }
      } catch (err) {
        console.error('Failed to fetch AI summary', err);
      } finally {
        setLoadingAi(false);
      }
    };
    fetchSummary();
  }, [language, metrics.netProfit]); 

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.05, duration: 0.4, ease: "easeOut" }
    })
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-800 tracking-tight">{t.dashboard}</h1>
          <p className="text-stone-500 text-sm mt-1">Here's your farm's performance today.</p>
        </div>
        <div className="w-full md:w-80 lg:w-96 shrink-0">
          <CashBankBalanceCard dropdownAlign="right" />
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-800 rounded-3xl p-8 border border-emerald-500/30 shadow-2xl shadow-emerald-900/20 text-white"
      >
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-emerald-400 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-teal-400 rounded-full blur-3xl opacity-20" />
        
        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles size={20} className="text-emerald-100" />
            </div>
            <h2 className="font-bold text-lg tracking-wide">{t.aiHighlight || 'AI Farm Insights'}</h2>
          </div>
          
          {loadingAi ? (
            <div className="animate-pulse space-y-3 max-w-2xl">
              <div className="h-4 bg-white/20 rounded w-3/4"></div>
              <div className="h-4 bg-white/20 rounded w-full"></div>
              <div className="h-4 bg-white/20 rounded w-5/6"></div>
            </div>
          ) : (
            <div className="text-emerald-50 text-sm md:text-base leading-relaxed whitespace-pre-wrap max-w-3xl font-medium">
              {aiSummary || "Generating comprehensive insights based on your recent farm activities and financial data..."}
            </div>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[
          { label: t.totalInvestment || 'Total Investment', value: `Rs. ${metrics.totalInvestment.toLocaleString()}`, icon: Briefcase, color: 'text-amber-600', bg: 'bg-amber-100/50', border: 'border-amber-200' },
          { label: t.totalIncome || 'Total Income', value: `Rs. ${metrics.totalIncome.toLocaleString()}`, icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-100/50', border: 'border-emerald-200' },
          { label: t.totalExpense || 'Total Expense', value: `Rs. ${metrics.totalExpense.toLocaleString()}`, icon: TrendingDown, color: 'text-rose-600', bg: 'bg-rose-100/50', border: 'border-rose-200' },
          { label: t.netProfit || 'Net Profit', value: `Rs. ${metrics.netProfit.toLocaleString()}`, icon: Wallet, color: metrics.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600', bg: metrics.netProfit >= 0 ? 'bg-emerald-100/50' : 'bg-rose-100/50', border: metrics.netProfit >= 0 ? 'border-emerald-200' : 'border-rose-200' },
        ].map((metric, i) => (
          <motion.div 
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            key={i}
            className="group bg-white/80 backdrop-blur-xl p-6 rounded-3xl border border-stone-200/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4 relative z-10">
              <span className="text-stone-500 font-semibold text-sm tracking-wide">{metric.label}</span>
              <div className={`w-12 h-12 rounded-2xl ${metric.bg} ${metric.border} border flex items-center justify-center ${metric.color} group-hover:scale-110 transition-transform duration-300`}>
                <metric.icon size={22} strokeWidth={2.5} />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-stone-800 tracking-tight relative z-10">
              {metric.value}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-xl rounded-3xl border border-stone-200/60 p-6 shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-stone-800 text-lg">Income vs Expense (Monthly)</h3>
            <Activity size={20} className="text-stone-400" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} />
                <Tooltip 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{stroke: '#E7E5E4', strokeWidth: 2, strokeDasharray: '4 4'}}
                />
                <Area type="monotone" dataKey="income" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                <Area type="monotone" dataKey="expense" stroke="#F43F5E" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-xl rounded-3xl border border-stone-200/60 p-6 shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-stone-800 text-lg">Financial Overview</h3>
            <Wallet size={20} className="text-stone-400" />
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E7E5E4" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#78716C', fontSize: 12}} />
                <Tooltip 
                  cursor={{fill: '#F5F5F4'}}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <Bar dataKey="income" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="expense" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      <h3 className="text-lg font-bold text-stone-800 mt-8 mb-2 tracking-tight">Operational Overview</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t.activeLeases || 'Active Leases', value: metrics.activeLeases, icon: MapIcon, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: t.activeEmployees || 'Active Employees', value: metrics.activeEmployees, icon: UserCircle, color: 'text-teal-600', bg: 'bg-teal-50' },
          { label: t.taskSummary || 'Pending Tasks', value: metrics.pendingTasks, icon: CheckSquare, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: t.lowStockAlerts || 'Low Stock Alerts', value: metrics.lowStockItems, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', link: '/inventory' },
        ].map((metric, i) => (
          <motion.div 
            custom={i + 4}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            key={i} 
            className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-sm flex items-center justify-between group hover:border-emerald-200 transition-colors"
          >
            <div>
              <div className="text-sm font-semibold text-stone-500 mb-1">{metric.label}</div>
              <div className="text-2xl font-bold text-stone-800">{metric.value}</div>
              {metric.link && (
                <Link to={metric.link} className="text-xs font-semibold text-orange-600 hover:text-orange-700 mt-2 flex items-center">
                  View Details <ArrowRight size={12} className="ml-1" />
                </Link>
              )}
            </div>
            <div className={`w-12 h-12 rounded-full ${metric.bg} flex items-center justify-center ${metric.color} group-hover:scale-110 transition-transform`}>
              <metric.icon size={22} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
