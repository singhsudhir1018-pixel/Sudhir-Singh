const fs = require('fs');
let content = fs.readFileSync('src/components/Layout.tsx', 'utf8');

if (!content.includes('useNetworkStatus')) {
  content = content.replace(
    /import \{ useAppStore \} from '\.\.\/store';/,
    "import { useAppStore } from '../store';\nimport { useNetworkStatus } from '../hooks/useNetworkStatus';"
  );
  
  content = content.replace(
    /export default function Layout\(\) \{/,
    "export default function Layout() {\n  const isOnline = useNetworkStatus();"
  );
  
  const networkIndicator = `
          <div className="flex items-center space-x-4">
            {!isOnline ? (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <span className="hidden sm:inline">Offline - Saved Locally</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="hidden sm:inline">Online & Synced</span>
              </div>
            )}
            <button
`;
  
  content = content.replace(/<div className="flex items-center space-x-4">\s*<button/, networkIndicator);
  
  fs.writeFileSync('src/components/Layout.tsx', content);
  console.log('Patched Layout with Network Status');
}
