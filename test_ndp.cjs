const NepaliDate = require('nepali-datetime');
const d = new NepaliDate(2083, 4, 25); // 2083 Bhadra 25 (Months are 0-indexed: Baisakh=0, Bhadra=4)
console.log(d.format('YYYY MMMM DD'));
console.log(d.format('YYYY MMM DD'));
console.log('Year:', d.getYear(), 'Month:', d.getMonth(), 'Date:', d.getDate(), 'DayOfWeek:', d.getDay());

// Number of days in month?
// Try constructing next month day 0? 
// No, standard Date trick `new Date(year, month+1, 0)` might not work.
// Let's check the library docs or source code by reading node_modules.
