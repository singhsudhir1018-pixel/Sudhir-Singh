const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/ai/parse-receipt',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, res => {
  console.log(`STATUS: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});
req.on('error', e => console.error(e));
req.write(JSON.stringify({}));
req.end();
