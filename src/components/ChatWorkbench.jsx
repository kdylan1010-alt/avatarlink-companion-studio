export function ChatWorkbench({
  persona,
  modelProvider,
  onModelProvider,
  providerMeta,
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
        <h2>Chat UI + safe model proxy</h2>
      </div>
      <div className="preview-card">
        <p className="mono">Model provider</p>
        <label>
          Model provider
          <select value={modelProvider} onChange={(e) => onModelProvider(e.target.value)}>
            <option value="mock">Mock / test mode (no paid key required)</option>
            <option value="openrouter">OpenRouter (OpenAI-compatible, supports :free models)</option>
            <option value="githubModels">GitHub Models (safe local proxy, recommended)</option>
            <option value="gemini">Gemini API key (free-tier friendly scaffold)</option>
            <option value="ollama">Local Ollama (dev/local)</option>
            <option value="openai">Official OpenAI API key / project</option>
            <option value="oauthReady">OAuth-ready provider connector</option>
          </select>
        </label>
        <p className="muted">{providerMeta.authNote}</p>
        <p className="muted">ChatGPT Free/Plus/Pro login is not the same as OpenAI API access. Use official API key/provider key only.</p>
        <p className="muted">OAuth-ready provider connector is a generic placeholder only. Mocked until an official provider OAuth path is confirmed.</p>
        <p className="muted">No secrets in frontend builds. See docs/MODEL_PROVIDERS.md for safe provider notes and .env.example callback placeholders.</p>
      </div>
      <div className="stack">
        <label>Provider/proxy base URL (OpenAI-compatible base URL for BYOK providers)<input value={apiBase} onChange={(e) => onApiBase(e.target.value)} spellCheck="false" /></label>
        <label>API key (OpenAI-compatible browser BYOK only; hidden for safe proxy providers)<input value={apiKey} onChange={(e) => onApiKey(e.target.value)} placeholder="leave blank for GitHub Models/Gemini proxy" type="password" spellCheck="false" /></label>
        <label>Model<input value={model} onChange={(e) => onModel(e.target.value)} spellCheck="false" /></label>
      </div>
      <div className="preview-card">
        <p className="mono">Provider connector status</p>
        <pre>{`{
  provider: '${providerMeta.id}',
  label: '${providerMeta.label}',
  transport: '${providerMeta.transport}',
  baseUrl: '${apiBase}',
  model: '${model}',
  secretPath: '${modelProvider === 'githubModels' || modelProvider === 'gemini' ? '.env.local server-side only' : 'browser BYOK only if entered'}'
}`}</pre>
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
        GitHub Models and Gemini use the safe local proxy with server-side env secrets. Demo mode + browser speech fallback runs end-to-end without paid TTS keys; OAuth is scaffold-only for now.
      </p>
    </section>
  )
}
