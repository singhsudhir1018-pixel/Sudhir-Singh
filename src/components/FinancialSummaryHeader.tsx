import React from 'react';
import { 
  ArrowDownLeft, 
  ArrowUpRight 
} from 'lucide-react';
import { useFinancialSummary } from '../hooks/useFinancialSummary';
import { useAppStore } from '../store';
import { translations } from '../lib/translations';
import CashBankBalanceCard from './CashBankBalanceCard';

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
        <CashBankBalanceCard />
      </div>
    </div>
  );
}
