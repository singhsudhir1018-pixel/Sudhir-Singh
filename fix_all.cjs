const fs = require('fs');

function addImport(file) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("import NepaliDatePicker")) {
    content = content.replace("import NepaliDate from 'nepali-datetime';", "import NepaliDate from 'nepali-datetime';\nimport NepaliDatePicker from '../components/NepaliDatePicker';");
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}

addImport('src/pages/Accounts.tsx');
addImport('src/pages/Inventory.tsx');
addImport('src/pages/Tasks.tsx');

let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(/languagePref: 'en'/g, "languagePref: 'en' as 'en' | 'ne'");
fs.writeFileSync('src/App.tsx', app);
console.log('Fixed App.tsx');

