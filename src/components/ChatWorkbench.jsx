export function ChatWorkbench({ persona, apiBase, apiKey, model, onApiBase, onApiKey, onModel, systemPromptPreview }) {
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
        <div className="bubble bubble-user">Draft a welcome scene for a first-time fan.</div>
      </div>
      <button className="primary-button" type="button">Connect runtime later</button>
    </section>
  )
}
