import NepaliDate from 'nepali-datetime';

// Helper to normalize Devanagari numerals to standard digits (०-९ -> 0-9)
export function normalizeNepaliDigits(str: string): string {
  if (!str) return '';
  const devanagariDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return str.replace(/[०-९]/g, (ch) => {
    const idx = devanagariDigits.indexOf(ch);
    return idx !== -1 ? idx.toString() : ch;
  });
}

// Map of all known variations of BS months to their month number (1 to 12)
const BS_MONTH_MAP: Record<string, number> = {
  // Month 1: Baisakh / Baishakh
  baisakh: 1,
  baishakh: 1,
  vaishakh: 1,
  वैशाख: 1,
  बैशाख: 1,

  // Month 2: Jestha / Jetha
  jestha: 2,
  jyestha: 2,
  jeth: 2,
  जेठ: 2,
  जेष्ठ: 2,

  // Month 3: Asaar / Ashadh
  asaar: 3,
  ashadh: 3,
  ashad: 3,
  asar: 3,
  असार: 3,
  आषाढ: 3,

  // Month 4: Shrawan / Sawan
  shrawan: 4,
  shravan: 4,
  sawan: 4,
  saun: 4,
  साउन: 4,
  श्रावण: 4,

  // Month 5: Bhadra / Bhadau
  bhadra: 5,
  bhadau: 5,
  bhadrapad: 5,
  भदौ: 5,
  भाद्र: 5,
  भाद्रपद: 5,

  // Month 6: Ashwin / Asoj
  ashwin: 6,
  asoj: 6,
  ashoj: 6,
  aswin: 6,
  असोज: 6,
  आश्विन: 6,

  // Month 7: Kartik
  kartik: 7,
  kattik: 7,
  कात्तिक: 7,
  कार्तिक: 7,

  // Month 8: Mangsir / Mangshir / Marg
  mangsir: 8,
  mangshir: 8,
  marg: 8,
  मार्गशीर्ष: 8,
  मंसिर: 8,
  मार्ग: 8,

  // Month 9: Poush / Paush / Pus
  poush: 9,
  paush: 9,
  pus: 9,
  पुस: 9,
  पुष: 9,
  पौष: 9,

  // Month 10: Magh
  magh: 10,
  माघ: 10,

  // Month 11: Falgun / Phalgun / Fagun
  falgun: 11,
  phalgun: 11,
  fagun: 11,
  फागुन: 11,
  फाल्गुन: 11,

  // Month 12: Chaitra / Chait
  chaitra: 12,
  chait: 12,
  चैत: 12,
  चैत्र: 12,
};

/**
 * Safely extracts a numeric millisecond timestamp from various formats:
 * number, Firestore Timestamp object ({ seconds, nanoseconds }), string, or object with toMillis().
 */
export function safeGetCreatedAtMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val.toMillis === 'function') {
    try {
      const ms = val.toMillis();
      return typeof ms === 'number' && !isNaN(ms) ? ms : 0;
    } catch {
      return 0;
    }
  }
  if (typeof val.seconds === 'number') {
    return val.seconds * 1000 + (typeof val.nanoseconds === 'number' ? Math.floor(val.nanoseconds / 1000000) : 0);
  }
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num) && num > 0) return num;
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Parses any date representation (Nepali string "2081 Baisakh 12", "12 Baisakh 2081",
 * "२०८१ असोज ०८", "2081-06-08", numeric, Gregorian ISO, etc.)
 * into a comparable numeric value: YYYYMMDD (e.g. 20810608).
 * Recent dates yield larger numbers, older dates yield smaller numbers.
 */
export function getNepaliDateSortValue(dateInput?: any): number {
  if (!dateInput) return 0;

  // 1. If already a number
  if (typeof dateInput === 'number') {
    if (isNaN(dateInput)) return 0;
    // If it's formatted as YYYYMMDD (e.g. 20810115)
    if (dateInput >= 20000101 && dateInput <= 21501232) return dateInput;
    // If it's a timestamp in seconds or ms, convert to NepaliDate
    try {
      const ms = dateInput < 10000000000 ? dateInput * 1000 : dateInput;
      const nd = new NepaliDate(new Date(ms));
      if (!isNaN(nd.getYear())) {
        return nd.getYear() * 10000 + (nd.getMonth() + 1) * 100 + nd.getDate();
      }
    } catch {
      return 0;
    }
  }

  // 2. If object
  if (typeof dateInput !== 'string') {
    if (typeof dateInput.year === 'number' && typeof dateInput.month === 'number') {
      const y = dateInput.year;
      const m = dateInput.month;
      const d = typeof dateInput.day === 'number' ? dateInput.day : 1;
      return y * 10000 + m * 100 + d;
    }
    const ms = safeGetCreatedAtMs(dateInput);
    if (ms > 0) {
      try {
        const nd = new NepaliDate(new Date(ms));
        if (!isNaN(nd.getYear())) {
          return nd.getYear() * 10000 + (nd.getMonth() + 1) * 100 + nd.getDate();
        }
      } catch {}
    }
    return 0;
  }

  const str = normalizeNepaliDigits(dateInput.trim().replace(/\u00A0/g, ' '));
  if (!str) return 0;

  // 3. Numeric formats: "YYYY-MM-DD", "YYYY/MM/DD", "YYYY.MM.DD"
  const ymdMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymdMatch) {
    const y = parseInt(ymdMatch[1], 10);
    const m = parseInt(ymdMatch[2], 10);
    const d = parseInt(ymdMatch[3], 10);
    if (y < 2060) {
      try {
        const nd = new NepaliDate(new Date(y, m - 1, d));
        if (!isNaN(nd.getYear())) {
          return nd.getYear() * 10000 + (nd.getMonth() + 1) * 100 + nd.getDate();
        }
      } catch {}
    }
    return y * 10000 + m * 100 + d;
  }

  // "DD-MM-YYYY", "DD/MM/YYYY", "DD.MM.YYYY"
  const dmyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (dmyMatch) {
    const d = parseInt(dmyMatch[1], 10);
    const m = parseInt(dmyMatch[2], 10);
    const y = parseInt(dmyMatch[3], 10);
    if (y < 2060) {
      try {
        const nd = new NepaliDate(new Date(y, m - 1, d));
        if (!isNaN(nd.getYear())) {
          return nd.getYear() * 10000 + (nd.getMonth() + 1) * 100 + nd.getDate();
        }
      } catch {}
    }
    return y * 10000 + m * 100 + d;
  }

  // 4. Tokenized text parsing (handles "2081 Baisakh 12", "12 Baisakh 2081", "Baisakh 12, 2081", "२०८१ असोज ०८", etc.)
  const cleanTokens = str.replace(/[,;]/g, ' ').split(/\s+/).filter(Boolean);
  let foundYear: number | null = null;
  let foundMonth: number | null = null;
  let foundDay: number | null = null;

  for (const token of cleanTokens) {
    const lower = token.toLowerCase();

    // Check if month name
    let matchedMonth = BS_MONTH_MAP[lower];
    if (!matchedMonth) {
      for (const [key, val] of Object.entries(BS_MONTH_MAP)) {
        if (lower.startsWith(key) || key.startsWith(lower)) {
          matchedMonth = val;
          break;
        }
      }
    }

    if (matchedMonth && !foundMonth) {
      foundMonth = matchedMonth;
      continue;
    }

    // Check if numeric token
    const num = parseInt(token.replace(/\D/g, ''), 10);
    if (!isNaN(num)) {
      if (num >= 2000 && num <= 2150) {
        foundYear = num;
      } else if (num >= 1 && num <= 32 && !foundDay) {
        foundDay = num;
      } else if (num > 0 && num <= 12 && !foundMonth) {
        foundMonth = num;
      }
    }
  }

  if (foundYear && foundMonth) {
    const d = foundDay || 1;
    if (foundYear < 2060) {
      try {
        const nd = new NepaliDate(new Date(foundYear, foundMonth - 1, d));
        if (!isNaN(nd.getYear())) {
          return nd.getYear() * 10000 + (nd.getMonth() + 1) * 100 + nd.getDate();
        }
      } catch {}
    }
    return foundYear * 10000 + foundMonth * 100 + d;
  }

  // 5. Fallback: try parsing ISO date or native Gregorian Date
  try {
    const parsedDate = new Date(str);
    if (!isNaN(parsedDate.getTime())) {
      const nd = new NepaliDate(parsedDate);
      if (!isNaN(nd.getYear())) {
        return nd.getYear() * 10000 + (nd.getMonth() + 1) * 100 + nd.getDate();
      }
    }
  } catch {}

  // 6. Fallback: try nepali-datetime direct parser
  try {
    const nd = new NepaliDate(str);
    if (!isNaN(nd.getYear())) {
      return nd.getYear() * 10000 + (nd.getMonth() + 1) * 100 + nd.getDate();
    }
  } catch {}

  return 0;
}

/**
 * Sorts transactions with the most recent dateBS at the top (descending),
 * and older dateBS at the bottom.
 * If dateBS is the same, sorts by creation timestamp (createdAt) descending
 * so the newest recorded entries appear at the top.
 */
export function sortTransactionsDesc<T extends { dateBS?: any; createdAt?: any }>(a: T, b: T): number {
  const dateValA = getNepaliDateSortValue(a?.dateBS);
  const dateValB = getNepaliDateSortValue(b?.dateBS);

  if (dateValB !== dateValA) {
    return dateValB - dateValA; // larger value (more recent date) first
  }

  const timeA = safeGetCreatedAtMs(a?.createdAt);
  const timeB = safeGetCreatedAtMs(b?.createdAt);
  return timeB - timeA; // newly recorded first
}

/**
 * Sorts transactions with the oldest dateBS at the top (ascending),
 * and newer dateBS at the bottom.
 */
export function sortTransactionsAsc<T extends { dateBS?: any; createdAt?: any }>(a: T, b: T): number {
  const dateValA = getNepaliDateSortValue(a?.dateBS);
  const dateValB = getNepaliDateSortValue(b?.dateBS);

  if (dateValA !== dateValB) {
    return dateValA - dateValB; // smaller value (older date) first
  }

  const timeA = safeGetCreatedAtMs(a?.createdAt);
  const timeB = safeGetCreatedAtMs(b?.createdAt);
  return timeA - timeB; // earlier recorded first
}
