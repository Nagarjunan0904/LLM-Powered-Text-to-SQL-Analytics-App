import { useState } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

const BASE_CODE_STYLE = { margin: 0, fontSize: '13px', padding: '16px' }

const ATTEMPT_BADGE = {
  1: { cls: 'bg-green-100 text-green-700', text: '✓ Generated on attempt 1 of 3' },
  2: { cls: 'bg-yellow-100 text-yellow-700', text: '⚡ Generated on attempt 2 of 3' },
  3: { cls: 'bg-red-100 text-red-700',    text: '⚠ Generated on attempt 3 of 3' },
}

export default function SqlPanel({ sql, attempts, corrected, latencyMs, originalSql }) {
  const [copied, setCopied] = useState(false)

  if (!sql) return null

  const showDiff = corrected && originalSql
  const badge = ATTEMPT_BADGE[attempts]

  function handleCopy() {
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-4 mb-4 bg-white rounded-xl border border-gray-200 shadow-sm flex-shrink-0 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          {badge && (
            <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${badge.cls}`}>
              {badge.text}
            </span>
          )}
          {latencyMs > 0 && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {latencyMs}ms
            </span>
          )}
          {corrected && (
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
              Self-corrected
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-xs border border-gray-300 rounded-lg px-3 py-1 hover:bg-gray-50 transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* ── Body ── */}
      {showDiff ? (
        <>
          {/* Two-pane diff */}
          <div className="grid grid-cols-2 gap-0">
            {/* LEFT — failed attempt */}
            <div className="border-r border-gray-200">
              <div className="bg-red-50 px-4 py-2 text-xs font-medium text-red-600 border-b border-red-100">
                ✗ Attempt 1 — Failed
              </div>
              <SyntaxHighlighter
                language="sql"
                style={atomOneDark}
                customStyle={{ ...BASE_CODE_STYLE, background: '#2d1515', borderRadius: 0 }}
                showLineNumbers
              >
                {originalSql}
              </SyntaxHighlighter>
            </div>
            {/* RIGHT — corrected SQL */}
            <div>
              <div className="bg-green-50 px-4 py-2 text-xs font-medium text-green-600 border-b border-green-100">
                ✓ Corrected SQL — Succeeded
              </div>
              <SyntaxHighlighter
                language="sql"
                style={atomOneDark}
                customStyle={{ ...BASE_CODE_STYLE, background: '#152d15', borderRadius: 0 }}
                showLineNumbers
              >
                {sql}
              </SyntaxHighlighter>
            </div>
          </div>
          {/* Explanation bar */}
          <div className="bg-yellow-50 px-4 py-2 text-xs text-yellow-700 border-t border-yellow-100">
            The self-correction loop detected a database error on attempt 1 and automatically
            fixed the SQL. This is what makes the app production-grade.
          </div>
        </>
      ) : (
        <SyntaxHighlighter
          language="sql"
          style={atomOneDark}
          customStyle={{ ...BASE_CODE_STYLE, borderRadius: '0 0 12px 12px' }}
          showLineNumbers
        >
          {sql}
        </SyntaxHighlighter>
      )}

      {/* ── Footer ── */}
      <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl flex items-center justify-between">
        <span className="text-xs text-gray-500">SQL</span>
        <span className="text-xs text-gray-500">{sql.length} chars</span>
      </div>
    </div>
  )
}
