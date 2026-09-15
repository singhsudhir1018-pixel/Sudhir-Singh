const fs = require('fs');
let content = fs.readFileSync('src/pages/Leases.tsx', 'utf8');

const regexToReplace = /<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">[\s\S]*?\{leases\.length === 0[\s\S]*?<\/div>\s*\)\}\s*<\/div>/;

const tableFormat = `
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.titleId || 'Title'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.totalArea || 'Area / Ponds'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.lessorName || 'Lessor'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.duration || 'Duration'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600">{t.totalLeaseAmount || 'Amount (Rs.)'}</th>
                <th className="py-3 px-4 text-sm font-semibold text-stone-600 text-right">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {leases.map(lease => (
                <tr key={lease.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
                        <Map size={16} />
                      </div>
                      <span className="font-bold text-stone-800">{lease.title}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <p className="text-sm text-stone-800">{lease.area}</p>
                    <p className="text-xs text-stone-500">{lease.ponds} {t.numberOfPonds || 'Ponds'}</p>
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-800">
                    {lease.lessorName}
                  </td>
                  <td className="py-3 px-4 text-sm text-stone-800">
                    {lease.startDateBS} - {lease.endDateBS}
                  </td>
                  <td className="py-3 px-4 text-sm font-bold text-stone-900">
                    Rs. {lease.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-end space-x-2">
                      <button className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors" title={t.documents || 'Documents'}>
                        <FileText size={18} />
                      </button>
                      <button onClick={() => openEditLease(lease)} className="text-stone-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title={t.edit || 'Edit'}>
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(lease.id)} className="text-stone-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors" title={t.delete || 'Delete'}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leases.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center p-12 text-stone-500 bg-stone-50/50">
                    {t.noActiveLeases || 'No active leases found.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
`;

content = content.replace(regexToReplace, tableFormat);
fs.writeFileSync('src/pages/Leases.tsx', content);
console.log('Updated Leases to table format');
