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
}) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!loading && question.trim()) onSubmit()
    }
  }

  // Pill click sets question AND immediately submits with that text
  // (pass directly to avoid async state closure capturing old value)
  function handlePillClick(ex) {
    setQuestion(ex)
    onSubmit(ex)
  }

  const textareaRows = Math.min(Math.max(question.split('\n').length, 3), 6)

  return (
    <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">

      {/* ── Input row ── */}
      <div className="flex gap-3 items-start">
        <textarea
          className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
          placeholder={"Ask anything about NYC taxi data...\ne.g. What is the average fare by hour of day?"}
          value={question}
          rows={textareaRows}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          onClick={() => onSubmit()}
          disabled={loading || !question.trim()}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 py-3 font-medium transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0"
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Thinking...
            </>
          ) : (
            'Run Query'
          )}
        </button>
      </div>

      {/* ── Example pills ── */}
      {examples.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-500 flex-shrink-0">Try an example:</span>
          {examples.map((ex) => (
            <button
              key={ex}
              onClick={() => handlePillClick(ex)}
              disabled={loading}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs hover:bg-purple-50 hover:border-purple-300 cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* ── Animated status bar (loading only) ── */}
      {loading && statusMessage && (
        <div className="flex items-center gap-2 mt-3 text-sm text-purple-600">
          <div className="animate-pulse bg-purple-500 rounded-full w-2 h-2 flex-shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* ── Streaming SQL preview (dark terminal style) ── */}
      {loading && streamingSQL && (
        <pre className="mt-2 bg-gray-900 text-green-400 font-mono text-xs p-3 rounded-lg max-h-24 overflow-auto whitespace-pre-wrap break-all">
          {streamingSQL}
        </pre>
      )}

      {/* ── Correction badge (shown after success, if correction loop fired) ── */}
      {corrected && !loading && (
        <div className="mt-3 bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-lg px-4 py-2 text-sm flex items-center gap-2">
          <span>⚡</span>
          <span>
            Corrected {attempts - 1} time{attempts - 1 !== 1 ? 's' : ''} — query fixed by self-correction loop
          </span>
        </div>
      )}

      {/* ── Error display ── */}
      {error && !loading && (
        <div className="mt-3 bg-red-50 border border-red-300 text-red-700 rounded-lg px-4 py-2 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
