import React, { useState, useRef } from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight, 
  Wallet, 
  Landmark, 
  Banknote, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  X,
  CreditCard
} from 'lucide-react';
import { useFinancialSummary } from '../hooks/useFinancialSummary';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { Link } from 'react-router-dom';

interface Props {
  className?: string;
  onSelectReceivables?: () => void;
  onSelectPayables?: () => void;
}

export default function FinancialSummaryHeader({ 
  className = '', 
  onSelectReceivables, 
  onSelectPayables 
}: Props) {
  const { language } = useAppStore();
  const t = translations[language];
  const summary = useFinancialSummary();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(dropdownRef, () => {
    setIsDropdownOpen(false);
  });

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'CASH':
        return <Banknote size={18} className="text-emerald-600" />;
      case 'BANK':
        return <Landmark size={18} className="text-blue-600" />;
      case 'WALLET':
        return <Wallet size={18} className="text-indigo-600" />;
      default:
        return <CreditCard size={18} className="text-stone-600" />;
    }
  };

  const getAccountBadge = (type: string) => {
    switch (type) {
      case 'CASH':
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-100 text-emerald-800 rounded-full">
            {language === 'ne' ? 'नगद' : 'Cash'}
          </span>
        );
      case 'BANK':
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-blue-100 text-blue-800 rounded-full">
            {language === 'ne' ? 'बैंक' : 'Bank'}
          </span>
        );
      case 'WALLET':
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-indigo-100 text-indigo-800 rounded-full">
            {language === 'ne' ? 'वालेट' : 'Wallet'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
        {/* CARD 1: TO RECEIVE */}
        <div 
          onClick={onSelectReceivables}
          className={`bg-gradient-to-br from-blue-50/95 via-sky-50/80 to-blue-100/50 border border-blue-200/90 rounded-2xl p-5 shadow-sm transition-all duration-200 relative overflow-hidden group ${
            onSelectReceivables ? 'cursor-pointer hover:shadow-md hover:border-blue-300' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700/90">
                {t.toReceive || 'To Receive'}
              </span>
              <span className="text-[11px] text-blue-600/80 font-medium">
                {language === 'ne' ? 'उठाउन बाँकी / असुली' : 'Receivables from Buyers'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-700 flex items-center justify-center border border-blue-200 group-hover:scale-105 transition-transform">
              <ArrowDownLeft size={22} className="stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-950 tracking-tight">
              Rs. {summary.toReceive.toLocaleString()}
            </div>
            <div className="flex items-center space-x-1 text-xs text-blue-700/80 mt-1 font-medium">
              <span>{summary.buyerCount}</span>
              <span>{language === 'ne' ? 'क्रेताहरूबाट लिन बाँकी' : 'Buyers with pending dues'}</span>
            </div>
          </div>
        </div>

        {/* CARD 2: TO PAY */}
        <div 
          onClick={onSelectPayables}
          className={`bg-gradient-to-br from-rose-50/95 via-red-50/80 to-rose-100/50 border border-rose-200/90 rounded-2xl p-5 shadow-sm transition-all duration-200 relative overflow-hidden group ${
            onSelectPayables ? 'cursor-pointer hover:shadow-md hover:border-rose-300' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700/90">
                {t.toPay || 'To Pay'}
              </span>
              <span className="text-[11px] text-rose-600/80 font-medium">
                {language === 'ne' ? 'तिर्न बाँकी / भुक्तानी' : 'Payables to Suppliers'}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-700 flex items-center justify-center border border-rose-200 group-hover:scale-105 transition-transform">
              <ArrowUpRight size={22} className="stroke-[2.5]" />
            </div>
          </div>

          <div className="mt-1">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-950 tracking-tight">
              Rs. {summary.toPay.toLocaleString()}
            </div>
            <div className="flex items-center space-x-1 text-xs text-rose-700/80 mt-1 font-medium">
              <span>{summary.supplierCount}</span>
              <span>{language === 'ne' ? 'आपूर्तिकर्ताहरूलाई तिर्न बाँकी' : 'Suppliers to be settled'}</span>
            </div>
          </div>
        </div>

        {/* CARD 3: TOTAL BALANCE - CASH & BANK (INTERACTIVE DROPDOWN) */}
        <div 
          ref={dropdownRef}
          className="relative"
        >
          <div 
            onClick={() => setIsDropdownOpen(prev => !prev)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsDropdownOpen(prev => !prev); }}
            className={`bg-gradient-to-br from-emerald-50/95 via-teal-50/80 to-emerald-100/50 border border-emerald-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group h-full flex flex-col justify-between ${
              isDropdownOpen ? 'ring-2 ring-emerald-500/50 border-emerald-400' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  {t.totalBalanceCashBank || 'Total Balance (Cash & Bank)'}
                </span>
                <span className="text-[11px] text-emerald-700/80 font-medium">
                  {language === 'ne' ? 'कुल मौज्दात (नगद र बैंक)' : 'Total Liquid Balance'}
                </span>
              </div>
              <div className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-600/10 text-emerald-800 border border-emerald-300/60 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Wallet size={16} />
                {isDropdownOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>

            <div className="mt-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-emerald-950 tracking-tight">
                Rs. {summary.totalCashBankBalance.toLocaleString()}
              </div>
              <div className="flex items-center justify-between text-xs text-emerald-800/80 mt-1 font-medium">
                <span className="truncate max-w-[210px]" title={`Investment Rs. ${summary.totalInvestment.toLocaleString()} - Expense Rs. ${summary.totalExpense.toLocaleString()}`}>
                  {language === 'ne' 
                    ? `लगानी रु. ${summary.totalInvestment.toLocaleString()} - खर्च रु. ${summary.totalExpense.toLocaleString()}`
                    : `Inv. Rs. ${summary.totalInvestment.toLocaleString()} - Exp. Rs. ${summary.totalExpense.toLocaleString()}`}
                </span>
                <span className="underline decoration-emerald-400/60 underline-offset-2 ml-1 shrink-0">
                  {isDropdownOpen 
                    ? (language === 'ne' ? 'बन्द गर्नुहोस्' : 'Close') 
                    : (language === 'ne' ? 'खाता विवरण ▼' : 'Breakdown ▼')}
                </span>
              </div>
            </div>
          </div>

          {/* EXPANDABLE CASH & BANK BREAKDOWN DROPDOWN POPOVER */}
          {isDropdownOpen && (
            <div className="absolute top-full right-0 mt-2 w-full sm:w-[420px] bg-white rounded-2xl border border-stone-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Popover Header */}
              <div className="p-4 bg-stone-50 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-stone-800 text-sm flex items-center space-x-2">
                    <Landmark size={16} className="text-emerald-600" />
                    <span>{t.cashAndBankBreakdown || 'Cash & Bank Breakdown'}</span>
                  </h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    {language === 'ne' 
                      ? 'कुल लगानीबाट कुल खर्च घटाएर बाँकी रकम' 
                      : 'Remaining balance: Total Investment minus Total Expense'}
                  </p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(false); }}
                  className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-200/60 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Investment vs Expense Formula Banner */}
              <div className="p-3 bg-emerald-50/70 border-b border-emerald-100 text-xs">
                <div className="flex justify-between items-center text-stone-700 font-medium mb-1">
                  <span>{language === 'ne' ? 'कुल लगानी (Total Investment):' : 'Total Investment:'}</span>
                  <span className="font-bold text-emerald-800">Rs. {summary.totalInvestment.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-stone-700 font-medium mb-1.5">
                  <span>{language === 'ne' ? 'कुल खर्च (Total Expense):' : 'Total Expense:'}</span>
                  <span className="font-bold text-rose-700">- Rs. {summary.totalExpense.toLocaleString()}</span>
                </div>
                <div className="border-t border-emerald-200 pt-1.5 flex justify-between items-center font-bold text-emerald-950 text-sm">
                  <span>{language === 'ne' ? 'बाँकी मौज्दात (Cash & Bank):' : 'Net Cash & Bank Balance:'}</span>
                  <span className="text-emerald-700">Rs. {summary.totalCashBankBalance.toLocaleString()}</span>
                </div>
              </div>

              {/* Subtotal Mini Badges */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-stone-100/50 border-b border-stone-100 text-center">
                <div className="bg-white p-2 rounded-xl border border-stone-200/60 shadow-xs">
                  <span className="text-[10px] text-stone-500 font-semibold block uppercase">
                    {language === 'ne' ? 'नगद' : 'Cash'}
                  </span>
                  <span className="font-bold text-xs text-emerald-700">
                    Rs. {summary.totalCash.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-stone-200/60 shadow-xs">
                  <span className="text-[10px] text-stone-500 font-semibold block uppercase">
                    {language === 'ne' ? 'बैंक' : 'Bank'}
                  </span>
                  <span className="font-bold text-xs text-blue-700">
                    Rs. {summary.totalBank.toLocaleString()}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-stone-200/60 shadow-xs">
                  <span className="text-[10px] text-stone-500 font-semibold block uppercase">
                    {language === 'ne' ? 'वालेट' : 'Wallet'}
                  </span>
                  <span className="font-bold text-xs text-indigo-700">
                    Rs. {summary.totalWallet.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Accounts List */}
              <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 p-2">
                {summary.accounts.length === 0 ? (
                  <div className="py-8 text-center text-stone-400 text-sm">
                    {t.noActiveAccounts || 'No active liquidity accounts found'}
                  </div>
                ) : (
                  summary.accounts.map((acc) => (
                    <div 
                      key={acc.id}
                      className="p-3 hover:bg-stone-50 rounded-xl transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                          {getAccountIcon(acc.type)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-stone-800 text-sm">
                              {acc.name}
                            </span>
                            {getAccountBadge(acc.type)}
                          </div>
                          <div className="text-[11px] text-stone-500 mt-0.5">
                            {acc.bankName ? `${acc.bankName} • ` : ''}
                            {acc.accountNumber ? `A/C: ${acc.accountNumber}` : (acc.type === 'CASH' ? 'Cash in Hand' : 'Digital Wallet')}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`font-bold text-sm ${acc.currentBalance >= 0 ? 'text-stone-900' : 'text-rose-600'}`}>
                          Rs. {(acc.currentBalance || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Popover Footer Link */}
              <div className="p-3 bg-stone-50 border-t border-stone-100 flex items-center justify-between text-xs">
                <span className="text-stone-500">
                  {language === 'ne' ? 'कुल मौज्दात:' : 'Aggregated Total:'} <strong className="text-emerald-700">Rs. {summary.totalCashBankBalance.toLocaleString()}</strong>
                </span>
                <Link
                  to="/accounts"
                  onClick={() => setIsDropdownOpen(false)}
                  className="flex items-center space-x-1 text-emerald-700 hover:text-emerald-800 font-semibold hover:underline"
                >
                  <span>{t.manageAccounts || 'Manage Accounts'}</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
