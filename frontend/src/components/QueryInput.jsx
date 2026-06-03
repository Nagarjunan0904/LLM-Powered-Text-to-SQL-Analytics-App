export default function QueryInput({
  question,
  setQuestion,
  examples,
  loading,
  corrected,
  attempts,
  onSubmit,
  statusMessage,
  streamingSQL,
  error,
  showHero,
}) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!loading && question.trim()) onSubmit()
    }
  }

  function handlePillClick(ex) {
    setQuestion(ex)
    onSubmit(ex)
  }

  const textareaRows = Math.min(Math.max(question.split('\n').length, 3), 6)

  return (
    <div
      className="p-4 flex-shrink-0 animate-fadeIn"
      style={{ borderBottom: '1px solid #2a2a2a', background: '#111111' }}
    >
      {/* ── Input row ── */}
      <div className="flex gap-3 items-start">
        <textarea
          className="flex-1 rounded-xl px-4 py-3 text-sm resize-none outline-none transition-all duration-200"
          style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            color: '#f5f5f5',
            caretColor: '#f59e0b',
          }}
          placeholder={"Ask anything about NYC taxi data...\ne.g. What is the average fare by hour of day?"}
          value={question}
          rows={textareaRows}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          onFocus={e => {
            e.target.style.border = '1px solid rgba(245,158,11,0.5)'
            e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.1)'
          }}
          onBlur={e => {
            e.target.style.border = '1px solid #2a2a2a'
            e.target.style.boxShadow = 'none'
          }}
        />
        <button
          onClick={() => onSubmit()}
          disabled={loading || !question.trim()}
          className="flex items-center gap-2 rounded-xl px-6 py-3 font-bold transition-all duration-200 whitespace-nowrap flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: '#0a0a0a',
            boxShadow: '0 4px 15px rgba(245,158,11,0.3)',
            opacity: loading || !question.trim() ? 0.4 : 1,
          }}
          onMouseEnter={e => {
            if (!loading && question.trim()) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #d97706, #b45309)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(245,158,11,0.5)'
              e.currentTarget.style.transform = 'scale(1.05)'
            }
          }}
          onMouseLeave={e => {
            if (!loading && question.trim()) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(245,158,11,0.3)'
              e.currentTarget.style.transform = 'scale(1)'
            }
          }}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"
                style={{ color: '#f59e0b' }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span style={{ color: '#a3a3a3' }}>Thinking...</span>
            </>
          ) : 'Run Query'}
        </button>
      </div>

      {/* ── Hero subtitle (shown before first query) ── */}
      {showHero && (
        <p className="text-center text-sm mb-3 mt-2 animate-fadeIn" style={{ color: '#525252' }}>
          Ask any question about NYC taxi data — get an answer in seconds.
        </p>
      )}

      {/* ── Example pills ── */}
      {examples.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs flex-shrink-0" style={{ color: '#525252' }}>Try an example:</span>
          {examples.map((ex, i) => (
            <button
              key={ex}
              onClick={() => handlePillClick(ex)}
              disabled={loading}
              className="rounded-full px-3 py-1 text-xs cursor-pointer transition-all duration-150 disabled:opacity-30 disabled:pointer-events-none animate-fadeIn"
              style={{
                border: '1px solid #2a2a2a',
                background: '#1a1a1a',
                color: '#a3a3a3',
                animationDelay: `${i * 40}ms`,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(245,158,11,0.1)'
                e.currentTarget.style.border = '1px solid rgba(245,158,11,0.4)'
                e.currentTarget.style.color = '#f59e0b'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#1a1a1a'
                e.currentTarget.style.border = '1px solid #2a2a2a'
                e.currentTarget.style.color = '#a3a3a3'
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* ── Animated status bar ── */}
      {loading && statusMessage && (
        <div className="flex items-center gap-2 mt-3 text-sm" style={{ color: '#f59e0b' }}>
          <div className="animate-pulse rounded-full w-2 h-2 flex-shrink-0" style={{ background: '#f59e0b' }} />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ── Streaming SQL preview ── */}
      {loading && streamingSQL && (
        <pre
          className="mt-2 font-mono text-xs p-3 rounded-lg max-h-24 overflow-auto whitespace-pre-wrap break-all"
          style={{
            background: '#0a0a0a',
            color: '#f59e0b',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          {streamingSQL}<span className="animate-blink">▌</span>
        </pre>
      )}

      {/* ── Correction badge ── */}
      {corrected && !loading && (
        <div
          className="mt-3 rounded-lg px-4 py-2 text-sm flex items-center gap-2"
          style={{
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
          }}
        >
          <span>⚡</span>
          <span>
            Corrected {attempts - 1} time{attempts - 1 !== 1 ? 's' : ''} — query fixed by self-correction loop
          </span>
        </div>
      )}

      {/* ── Error display ── */}
      {error && !loading && (
        <div
          className="mt-3 rounded-lg px-4 py-2 text-sm"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
          }}
        >
          {error}
        </div>
      )}
    </div>
  )
}
