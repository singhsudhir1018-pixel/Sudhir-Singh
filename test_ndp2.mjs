import NepaliDate from 'nepali-datetime';
console.log('exports:', Object.keys(NepaliDate));
console.log('prototype:', Object.getOwnPropertyNames(NepaliDate.prototype));

const d = new NepaliDate("2083-05-25"); // 2083 Bhadra 25 (05 is Bhadra)
console.log(d.format('YYYY MMMM DD'));
console.log(d.format('YYYY MMM DD'));
console.log('Year:', d.getYear(), 'Month:', d.getMonth(), 'Date:', d.getDate(), 'DayOfWeek:', d.getDay());

// Try to find days in month
let nextMonth = new NepaliDate(d);
nextMonth.setMonth(d.getMonth() + 1);
nextMonth.setDate(0);
console.log('days in month:', nextMonth.getDate());
