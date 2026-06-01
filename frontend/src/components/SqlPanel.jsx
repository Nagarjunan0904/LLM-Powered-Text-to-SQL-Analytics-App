import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

export default function SqlPanel({ sql, attempts, corrected, latencyMs }) {
  const displayed = sql
  if (!displayed) return null

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <div className="flex items-center justify-between px-4 py-1.5 text-xs text-gray-500 border-b border-gray-200">
        <span className="font-medium text-gray-700">Generated SQL</span>
        <div className="flex gap-3">
          {latencyMs > 0 && <span>{latencyMs} ms</span>}
          {attempts > 0 && <span>{attempts} attempt{attempts !== 1 ? 's' : ''}</span>}
          {corrected && <span className="text-amber-600 font-medium">corrected</span>}
        </div>
      </div>
      <SyntaxHighlighter
        language="sql"
        style={oneLight}
        customStyle={{ margin: 0, padding: '12px 16px', fontSize: '13px', background: 'transparent' }}
      >
        {displayed}
      </SyntaxHighlighter>
    </div>
  )
}
