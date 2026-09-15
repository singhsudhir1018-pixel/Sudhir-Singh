import NepaliDate from 'nepali-datetime';
try {
  console.log(new NepaliDate(2083, 4, 25).format('YYYY MMMM DD'));
} catch (e) {
  console.error("1", e.message);
}
