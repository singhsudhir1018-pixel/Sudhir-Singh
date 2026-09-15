import NepaliDate from 'nepali-datetime';
try {
  const y = 2083;
  const m = 4;
  let d = new NepaliDate(y, m, 1);
  console.log(d.getDay());
  
  // Also check how daysInMonth loop behaves:
  let daysInMonth = 32;
  while(daysInMonth > 28) {
    try {
      new NepaliDate(y, m, daysInMonth);
      break;
    } catch(e) {
      daysInMonth--;
    }
  }
  console.log("Days:", daysInMonth);
} catch (e) {
  console.error(e);
}
