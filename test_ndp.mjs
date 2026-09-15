import NepaliDate from 'nepali-datetime';
const d = new NepaliDate(2083, 4, 25);
console.log(d.format('YYYY MMMM DD'));
console.log(d.format('YYYY MMM DD'));
console.log('Year:', d.getYear(), 'Month:', d.getMonth(), 'Date:', d.getDate(), 'DayOfWeek:', d.getDay());

// how to get days in month
import { getDaysInMonth } from 'nepali-datetime';
if (typeof getDaysInMonth === 'function') {
  console.log('days in month:', getDaysInMonth(2083, 4));
} else {
  // Let's print out what NepaliDate exposes
  console.log(Object.keys(NepaliDate));
}
