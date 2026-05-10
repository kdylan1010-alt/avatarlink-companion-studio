export function ChatWorkbench({
  persona,
  apiBase,
  apiKey,
  model,
  onApiBase,
  onApiKey,
  onModel,
  systemPromptPreview,
  userPrompt,
  onUserPrompt,
  onRunCompanion,
  runtimeStatus,
  assistantResponse,
  runtimeProviderLabel,
  isRunning,
}) {
  return (
    <section className="panel human-card" data-testid="chat-workbench">
      <div className="section-head">
        <p className="eyebrow">Conversation</p>
        <h2>Chat UI + BYOK config</h2>
      </div>
      <div className="stack">
        <label>OpenAI-compatible base URL<input value={apiBase} onChange={(e) => onApiBase(e.target.value)} spellCheck="false" /></label>
        <label>API key (local only)<input value={apiKey} onChange={(e) => onApiKey(e.target.value)} placeholder="sk-..." type="password" spellCheck="false" /></label>
        <label>Model<input value={model} onChange={(e) => onModel(e.target.value)} spellCheck="false" /></label>
      </div>
      <div className="preview-card">
        <p className="mono">System prompt preview</p>
        <pre>{systemPromptPreview}</pre>
      </div>
      <div className="chat-card">
        <div className="bubble bubble-avatar">{persona.opener}</div>
        <label>
          User test message
          <textarea value={userPrompt} onChange={(e) => onUserPrompt(e.target.value)} rows={4} />
        </label>
        <div className="bubble bubble-user">{userPrompt}</div>
        <div className="bubble bubble-avatar">{assistantResponse || 'Assistant response will appear here after you run the companion.'}</div>
      </div>
      <div className="preview-card">
        <p className="mono">Companion runtime status</p>
        <p>{runtimeStatus}</p>
        <p className="mono">Last provider path</p>
        <p>{runtimeProviderLabel}</p>
        <p className="mono">Last assistant response</p>
        <pre>{assistantResponse || 'No assistant response yet'}</pre>
      </div>
      <button className="primary-button" type="button" onClick={onRunCompanion} disabled={isRunning}>
        {isRunning ? 'Running companion…' : 'Run companion reply'}
      </button>
      <p className="muted">
        Demo mode + browser speech fallback runs end-to-end without paid TTS keys. If a real API base/key/model is entered,
        the app attempts a live OpenAI-compatible chat completion first.
      </p>
    </section>
  )
}
