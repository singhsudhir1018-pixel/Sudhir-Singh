import NepaliDate from 'nepali-datetime';
let d = new NepaliDate('2083 Bhadra 25');
console.log(d.format('YYYY MMMM DD'));
try {
  let d2 = new NepaliDate('2083-05-25');
  console.log(d2.format('YYYY MMMM DD'));
} catch (e) { console.error(e) }

try {
  let d3 = NepaliDate.parseFromStringWithFormat('2083 Bhadra 25', 'YYYY MMMM DD');
  console.log(d3); // wait, it might return a timestamp or NepaliDate?
} catch(e) { console.log("error parse"); }

// Let's just create a quick util to parse "2083 Bhadra 25"
