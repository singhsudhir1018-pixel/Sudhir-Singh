const fs = require('fs');
let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

content = content.replace(
  /\{\/\* Category Form Modal \*\/\}[\s\S]*?\{\/\* Category Form Modal \*\/\}|\{\/\* Category Form Modal \*\/\}[\s\S]*?\}\)\}\s*<\/div>\s*$/g, 
  "    </div>\n  );\n}\n"
);
// just strip from `{\/* Category Form Modal *\/}` to the end, then add the closing tags.
const index = content.indexOf('{/* Category Form Modal */}');
if (index !== -1) {
    content = content.substring(0, index) + "    </div>\n  );\n}\n";
}
fs.writeFileSync('src/pages/Settings.tsx', content);
console.log('Fixed settings modal');
