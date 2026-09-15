const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

// Import FarmProfile
content = content.replace(/import UserManagement from '\.\.\/components\/UserManagement';/, "import UserManagement from '../components/UserManagement';\nimport FarmProfile from '../components/FarmProfile';");

// The inline FarmProfile form starts around: {activeTab === 'PROFILE' && (
// and ends around: </form> or } inside the profile tab

const blockRegex = /\{activeTab === 'PROFILE' && \([\s\S]*?<\/form>\n\s*\)\}/m;
content = content.replace(blockRegex, "{activeTab === 'PROFILE' && <FarmProfile />}");

fs.writeFileSync('src/pages/Settings.tsx', content);
console.log('Settings.tsx updated to use FarmProfile component.');
