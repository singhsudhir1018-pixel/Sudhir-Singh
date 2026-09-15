import React, { useState, useEffect, useRef } from 'react';
import NepaliDate from 'nepali-datetime';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
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

export default function NepaliDatePicker({ value, onChange, className = '' }: NepaliDatePickerProps) {
  const { language } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  
  // Parse value to initial year/month/day
  const [selectedDate, setSelectedDate] = useState<NepaliDate>(() => {
    try {
      if (value) {
        // Try parsing string "2083 Bhadra 25" format
        const parts = value.split(' ');
        if (parts.length === 3) {
          const y = parseInt(parts[0]);
          const mText = parts[1];
          let mIndex = MONTHS_EN.findIndex(m => m === mText);
          if (mIndex === -1) mIndex = MONTHS_NE.findIndex(m => m === mText);
          const d = parseInt(parts[2]);
          if (!isNaN(y) && mIndex !== -1 && !isNaN(d)) {
             return new NepaliDate(y, mIndex, d);
          }
        }
      }
    } catch(e) {}
    return new NepaliDate();
  });

  const [viewYear, setViewYear] = useState(selectedDate.getYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  // Generate calendar days
  const firstDayOfMonth = new NepaliDate(viewYear, viewMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  // Max days in this month
  let daysInMonth = 32;
  while(daysInMonth > 28) {
    try {
      new NepaliDate(viewYear, viewMonth, daysInMonth);
      break;
    } catch(e) {
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

  // Year options: -10 to +10 years from current
  const currentYear = new NepaliDate().getYear();
  const yearOptions = Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div 
        className="w-full px-4 py-2 border border-stone-200 rounded-xl bg-white flex items-center justify-between cursor-pointer focus-within:ring-2 focus-within:ring-green-500 hover:border-stone-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="text-stone-800 font-medium select-none">{value || selectedDate.format('YYYY MMMM DD')}</span>
        <CalendarIcon size={18} className="text-stone-400" />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-white rounded-2xl shadow-xl border border-stone-100 z-50 w-72 animate-in fade-in slide-in-from-top-2">
          
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={handlePrevMonth} className="p-1.5 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors">
              <ChevronLeft size={18} />
            </button>
            
            <div className="flex space-x-2">
              <select 
                value={viewMonth}
                onChange={(e) => setViewMonth(parseInt(e.target.value))}
                className="px-2 py-1 bg-stone-50 border border-stone-200 rounded-lg text-sm font-medium text-stone-800 outline-none focus:ring-2 focus:ring-green-500/20"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx} value={idx}>{m}</option>
                ))}
              </select>

              <select 
                value={viewYear}
                onChange={(e) => setViewYear(parseInt(e.target.value))}
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
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20' 
                    : isToday(day)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-stone-700 hover:bg-stone-100'
                  }
                `}
              >
                {day}
              </button>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
