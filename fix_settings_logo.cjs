const fs = require('fs');

let content = fs.readFileSync('src/pages/Settings.tsx', 'utf8');

const fileInputRef = `  const logoInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGeneral({...general, logoUrl: reader.result as string});
      };
      reader.readAsDataURL(file);
    }
  };
`;

if (!content.includes('logoInputRef')) {
  content = content.replace(
    /const handleGeneralSave = async /,
    fileInputRef + '\n  const handleGeneralSave = async '
  );
  
  const uploadButton = `<button type="button" className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 text-sm font-medium">
                    {t.uploadLogo}
                  </button>`;
  const newUploadButton = `<input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg hover:bg-stone-200 text-sm font-medium">
                    {t.uploadLogo}
                  </button>`;
                  
  content = content.replace(uploadButton, newUploadButton);
  fs.writeFileSync('src/pages/Settings.tsx', content);
  console.log('Fixed Logo Upload');
}
