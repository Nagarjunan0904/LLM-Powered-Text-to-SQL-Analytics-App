export default function ResultsTable({ columns, rows }) {
  if (!rows.length) return null

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead className="sticky top-0 bg-gray-100">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="text-left px-4 py-2 font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2 border-b border-gray-100 text-gray-700 whitespace-nowrap">
                  {cell === null ? <span className="text-gray-400 italic">null</span> : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
