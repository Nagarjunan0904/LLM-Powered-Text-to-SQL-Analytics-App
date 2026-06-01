import { useState } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter'
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs'

const BASE_CODE_STYLE = { margin: 0, fontSize: '13px', padding: '16px' }

const ATTEMPT_BADGE = {
  1: { bg: 'rgba(16,185,129,0.1)',  text: '#10b981', border: 'rgba(16,185,129,0.2)',  label: '✓ Generated on attempt 1 of 3' },
  2: { bg: 'rgba(245,158,11,0.1)', text: '#f59e0b', border: 'rgba(245,158,11,0.2)', label: '⚡ Generated on attempt 2 of 3' },
  3: { bg: 'rgba(239,68,68,0.1)',  text: '#ef4444', border: 'rgba(239,68,68,0.2)',  label: '⚠ Generated on attempt 3 of 3' },
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
    <div
      className="mx-4 mb-4 rounded-xl flex-shrink-0 overflow-hidden animate-fadeInUp"
      style={{ background: '#111111', border: '1px solid #2a2a2a' }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #2a2a2a' }}>
        <div className="flex items-center gap-2 flex-wrap">
          {badge && (
            <span
              className="text-xs font-medium px-2.5 py-0.5 rounded-full"
              style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}` }}
            >
              {badge.label}
            </span>
          )}
          {latencyMs > 0 && (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#a3a3a3', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              {latencyMs}ms
            </span>
          )}
          {corrected && (
            <span
              className="text-xs px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}
            >
              Self-corrected
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="text-xs rounded-lg px-3 py-1 transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#a3a3a3' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.1)'
            e.currentTarget.style.color = '#f59e0b'
            e.currentTarget.style.border = '1px solid rgba(245,158,11,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = '#a3a3a3'
            e.currentTarget.style.border = '1px solid #2a2a2a'
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* ── Body ── */}
      {showDiff ? (
        <>
          <div className="grid grid-cols-2 gap-0">
            {/* Left — failed */}
            <div style={{ borderRight: '1px solid #2a2a2a' }}>
              <div className="px-4 py-2 text-xs font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
                ✗ Attempt 1 — Failed
              </div>
              <SyntaxHighlighter language="sql" style={atomOneDark}
                customStyle={{ ...BASE_CODE_STYLE, background: '#2d1515', borderRadius: 0 }}
                showLineNumbers>
                {originalSql}
              </SyntaxHighlighter>
            </div>
            {/* Right — corrected */}
            <div>
              <div className="px-4 py-2 text-xs font-medium" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', borderBottom: '1px solid rgba(16,185,129,0.2)' }}>
                ✓ Corrected SQL — Succeeded
              </div>
              <SyntaxHighlighter language="sql" style={atomOneDark}
                customStyle={{ ...BASE_CODE_STYLE, background: '#152d15', borderRadius: 0 }}
                showLineNumbers>
                {sql}
              </SyntaxHighlighter>
            </div>
          </div>
          <div className="px-4 py-2 text-xs" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', borderTop: '1px solid rgba(245,158,11,0.2)' }}>
            The self-correction loop detected a database error on attempt 1 and automatically fixed the SQL. This is what makes the app production-grade.
          </div>
        </>
      ) : (
        <SyntaxHighlighter language="sql" style={atomOneDark}
          customStyle={{ ...BASE_CODE_STYLE, borderRadius: '0 0 12px 12px' }}
          showLineNumbers>
          {sql}
        </SyntaxHighlighter>
      )}

      {/* ── Footer ── */}
      <div className="px-4 py-2 flex items-center justify-between rounded-b-xl" style={{ background: '#0a0a0a', borderTop: '1px solid #2a2a2a' }}>
        <span className="text-xs" style={{ color: '#525252' }}>SQL</span>
        <span className="text-xs" style={{ color: '#525252' }}>{sql.length} chars</span>
      </div>
    </div>
  )
}
