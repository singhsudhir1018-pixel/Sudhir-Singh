import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import NepaliDate from 'nepali-datetime';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAppStore } from '../store';

interface NepaliDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const MONTHS_EN = ['Baisakh', 'Jestha', 'Asaar', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
const MONTHS_NE = ['वैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत'];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const WEEKDAYS_NE = ['आइत', 'सोम', 'मङ्गल', 'बुध', 'बिही', 'शुक्र', 'शनि'];

function parseNepaliDateValue(value?: string): NepaliDate {
  try {
    if (value) {
      const parts = value.trim().split(' ');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const mText = parts[1];
        let mIndex = MONTHS_EN.findIndex(m => m === mText);
        if (mIndex === -1) mIndex = MONTHS_NE.findIndex(m => m === mText);
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && mIndex !== -1 && !isNaN(d)) {
          return new NepaliDate(y, mIndex, d);
        }
      }
    }
  } catch {
    // fallback to today
  }
  return new NepaliDate();
}

export default function NepaliDatePicker({ value, onChange, className = '' }: NepaliDatePickerProps) {
  const { language } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 640 : false
  );
  const [popoverStyle, setPopoverStyle] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const [selectedDate, setSelectedDate] = useState<NepaliDate>(() => parseNepaliDateValue(value));
  const [viewYear, setViewYear] = useState(selectedDate.getYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const parsed = parseNepaliDateValue(value);
    setSelectedDate(parsed);
    setViewYear(parsed.getYear());
    setViewMonth(parsed.getMonth());
  }, [value]);

  const updatePosition = useCallback(() => {
    if (typeof window === 'undefined') return;
    const mobile = window.innerWidth < 640;
    setIsMobile(mobile);
    if (mobile || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const popupWidth = 288;
    const popupHeight = 340;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    let top = rect.bottom + 8;
    if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
      top = Math.max(8, rect.top - popupHeight - 8);
    } else if (top + popupHeight > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - popupHeight - 8);
    }

    let left = rect.left;
    if (left + popupWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popupWidth - 8);
    }

    setPopoverStyle({ top, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => {
      if (!isMobile) updatePosition();
    };
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        popupRef.current &&
        !popupRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, isMobile, updatePosition]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const handleDayClick = (day: number) => {
    const newDate = new NepaliDate(viewYear, viewMonth, day);
    setSelectedDate(newDate);
    onChange(newDate.format('YYYY MMMM DD'));
    setIsOpen(false);
  };

  const firstDayOfMonth = new NepaliDate(viewYear, viewMonth, 1).getDay();
  let daysInMonth = 32;
  while (daysInMonth > 28) {
    try {
      new NepaliDate(viewYear, viewMonth, daysInMonth);
      break;
    } catch {
      daysInMonth--;
    }
  }

  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const paddingDays = Array.from({ length: firstDayOfMonth }, (_, i) => i);

  const isSelected = (day: number) => {
    return selectedDate.getYear() === viewYear && selectedDate.getMonth() === viewMonth && selectedDate.getDate() === day;
  };

  const isToday = (day: number) => {
    const today = new NepaliDate();
    return today.getYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
  };

  const monthNames = language === 'ne' ? MONTHS_NE : MONTHS_EN;
  const weekDayNames = language === 'ne' ? WEEKDAYS_NE : WEEKDAYS;

  const currentYear = new NepaliDate().getYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  const calendarCard = (
    <div
      ref={popupRef}
      onClick={(e) => e.stopPropagation()}
      className={`p-4 bg-white rounded-2xl shadow-2xl border border-stone-200 w-72 sm:w-72 ${
        isMobile ? 'max-w-[calc(100vw-2rem)]' : ''
      }`}
    >
      {isMobile && (
        <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-stone-100">
          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
            {language === 'ne' ? 'मिति छान्नुहोस् (वि.सं.)' : 'Select Date (B.S.)'}
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <button type="button" onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors">
          <ChevronLeft size={18} />
        </button>

        <div className="flex space-x-1.5">
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(parseInt(e.target.value, 10))}
            className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-800 outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {monthNames.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>

          <select
            value={viewYear}
            onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
            className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-800 outline-none focus:ring-2 focus:ring-green-500/20"
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <button type="button" onClick={handleNextMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {weekDayNames.map(wd => (
          <div key={wd} className="text-center text-[10px] font-bold text-stone-400 select-none">
            {wd}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map(p => (
          <div key={`pad-${p}`} className="h-8"></div>
        ))}

        {daysArray.map(day => (
          <button
            key={day}
            type="button"
            onClick={() => handleDayClick(day)}
            className={`
              h-8 w-full rounded-full flex items-center justify-center text-sm font-medium transition-colors
              ${isSelected(day)
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : isToday(day)
                  ? 'text-emerald-700 bg-emerald-50 font-bold'
                  : 'text-stone-700 hover:bg-stone-100'
              }
            `}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className="w-full px-3 sm:px-4 py-2 border border-stone-200 rounded-xl bg-white flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-green-500 hover:border-stone-300 transition-colors"
        onClick={() => setIsOpen(prev => !prev)}
      >
        <span className="text-stone-800 font-medium text-sm select-none truncate">
          {value || selectedDate.format('YYYY MMMM DD')}
        </span>
        <CalendarIcon size={17} className="text-stone-400 shrink-0 ml-2" />
      </div>

      {isOpen && typeof document !== 'undefined' && createPortal(
        isMobile ? (
          <div
            className="fixed inset-0 z-[9999] bg-stone-900/45 backdrop-blur-[1px] flex items-center justify-center p-4"
            onClick={() => setIsOpen(false)}
          >
            {calendarCard}
          </div>
        ) : (
          <div
            className="fixed z-[9999]"
            style={{ top: `${popoverStyle.top}px`, left: `${popoverStyle.left}px` }}
          >
            {calendarCard}
          </div>
        ),
        document.body
      )}
    </div>
  );
}
