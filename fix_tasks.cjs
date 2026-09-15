const fs = require('fs');

let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

const oldGrid = `<div className="grid grid-cols-1 md:grid-cols-3 gap-6">`;
const oldGridEnd = `      {isModalOpen && (`;

const newTable = `<div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium text-sm">
              <th className="p-4">{t.taskDetails || 'Task'}</th>
              <th className="p-4">{t.category || 'Category'}</th>
              <th className="p-4">{t.dueDateBS || 'Due Date'}</th>
              <th className="p-4">{t.status || 'Status'}</th>
              <th className="p-4 text-center">{t.actions || 'Actions'}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-stone-500">
                  {t.noData || 'No tasks found'}
                </td>
              </tr>
            ) : (
              tasks.map(task => (
                <tr key={task.id} className="border-b border-stone-100 hover:bg-stone-50">
                  <td className="p-4 text-stone-800 font-medium">
                    <span className={task.status === 'COMPLETED' ? 'line-through text-stone-400' : ''}>
                      {task.title}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs font-medium bg-stone-100 text-stone-700 px-2 py-1 rounded-lg">
                      {getCategoryLabel(task.category)}
                    </span>
                  </td>
                  <td className="p-4 text-stone-600">{task.dueDateBS}</td>
                  <td className="p-4">
                    <span className={\`text-xs font-medium px-2 py-1 rounded-lg \${
                      task.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                      task.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }\`}>
                      {task.status === 'TODO' ? t.todo : task.status === 'IN_PROGRESS' ? t.inProgress : t.completed}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center space-x-2">
                      {task.status === 'TODO' && (
                        <button onClick={() => updateStatus(task.id, 'IN_PROGRESS')} className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50" title={t.start || 'Start'}>
                          <Play size={16} />
                        </button>
                      )}
                      {task.status === 'IN_PROGRESS' && (
                        <button onClick={() => updateStatus(task.id, 'COMPLETED')} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50" title={t.completedStatus || 'Complete'}>
                          <Check size={16} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (`;

content = content.replace(
  new RegExp(oldGrid + '[\\s\\S]*?\\{isModalOpen && \\('),
  newTable
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Tasks Table');
