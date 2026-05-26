const SAFE_PROXY_PROVIDERS = new Set(['githubModels', 'gemini'])

const MODEL_SUGGESTIONS = {
  githubModels: ['openai/gpt-4.1-mini', 'openai/gpt-4o-mini', 'openai/o4-mini'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-flash'],
  openrouter: ['openrouter/auto', 'meta-llama/llama-3.1-8b-instruct:free'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini'],
  ollama: ['llama3.2', 'mistral'],
  mock: ['avatarlink-mock'],
  oauthReady: ['provider-oauth-placeholder-model'],
}

export function ChatWorkbench({
  debugMode = false,
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
  onRunFullDemo,
  runtimeStatus,
  assistantResponse,
  runtimeProviderLabel,
  isRunning,
}) {
  const isSafeProxy = SAFE_PROXY_PROVIDERS.has(modelProvider)
  const modelSuggestions = MODEL_SUGGESTIONS[modelProvider] || []
  const proxyHealthPath = isSafeProxy ? `${apiBase.replace(/\/$/, '')}/health` : 'not required for browser BYOK/mock providers'

  return (
    <section id="message-step" className="panel human-card" data-testid="chat-workbench message-and-run-step">
      <div className="section-head">
        <p className="eyebrow">Step 3 + 4 — Message and run</p>
        <h2>Type one message, then run the demo</h2>
      </div>
      <div className="preview-card">
        <p className="mono">AI engine</p>
        {!debugMode && (
          <div className="creator-provider-choice" data-testid="creator-provider-choice">
            <label>
              Simple mode
              <select value={modelProvider === 'githubModels' ? 'githubModels' : 'mock'} onChange={(e) => onModelProvider(e.target.value)}>
                <option value="githubModels">Recommended: GitHub Models safe proxy</option>
                <option value="mock">Demo mode: local mock reply</option>
              </select>
            </label>
            <p className="muted">Most creators should leave this on the recommended safe proxy, type a message below, then click Run full demo. Turn on Developer Debugging Mode for provider URLs, model IDs, and advanced connectors.</p>
          </div>
        )}
        {debugMode && (
          <>
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
            <p className="muted">OpenAI-compatible base URL providers are supported, but no secrets go into frontend builds. See docs/MODEL_PROVIDERS.md for safe provider notes and .env.example callback placeholders.</p>
          </>
        )}
        {isSafeProxy && !debugMode && (
          <div className="status-chip" role="status">
            AI engine ready: the recommended safe proxy is selected. Type a message below, then click Run full demo.
          </div>
        )}
        {isSafeProxy && debugMode && (
          <div className="status-chip" role="status">
            Safe proxy selected: browser → local /generate endpoint → official provider chat/completions. Secrets stay in ignored .env.local; use /health to confirm key presence.
          </div>
        )}
      </div>
      {debugMode && (
        <>
          <div className="stack">
            <label>Provider/proxy base URL (OpenAI-compatible base URL for BYOK providers)<input value={apiBase} onChange={(e) => onApiBase(e.target.value)} spellCheck="false" /></label>
            {!isSafeProxy && (
              <label>API key (OpenAI-compatible browser BYOK only)<input value={apiKey} onChange={(e) => onApiKey(e.target.value)} placeholder="paste only official provider API keys for BYOK providers" type="password" spellCheck="false" /></label>
            )}
            {isSafeProxy && <p className="muted">API key field hidden for safe proxy providers; use server-side .env.local only.</p>}
            <label>Model<input value={model} onChange={(e) => onModel(e.target.value)} list="avatarlink-model-suggestions" spellCheck="false" /></label>
            <datalist id="avatarlink-model-suggestions">
              {modelSuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
            </datalist>
          </div>
          <div className="preview-card">
            <p className="mono">Provider connector status</p>
            <pre>{`{
  provider: '${providerMeta.id}',
  label: '${providerMeta.label}',
  transport: '${providerMeta.transport}',
  baseUrl: '${apiBase}',
  model: '${model}',
  secretPath: '${isSafeProxy ? '.env.local server-side only' : 'browser BYOK only if entered'}',
  healthCheck: '${proxyHealthPath}'
}`}</pre>
          </div>
          <div className="preview-card">
            <p className="mono">System prompt preview</p>
            <pre>{systemPromptPreview}</pre>
          </div>
        </>
      )}
      <div className="chat-card">
        <div className="bubble bubble-avatar">{persona.opener}</div>
        <label>
          User test message
          <textarea value={userPrompt} onChange={(e) => onUserPrompt(e.target.value)} rows={4} />
        </label>
        <p className="click-hint">Next click: <strong>Run full demo</strong> to generate the reply, animate the face, and play the selected voice path.</p>
        <div className="bubble bubble-user">{userPrompt}</div>
        <div className="bubble bubble-avatar">{assistantResponse || 'Assistant response will appear here after you run the companion.'}</div>
      </div>
      {debugMode && (
        <div className="preview-card">
          <p className="mono">Companion runtime status</p>
          <p>{runtimeStatus}</p>
          <p className="mono">Last provider path</p>
          <p>{runtimeProviderLabel}</p>
          <p className="mono">Last assistant response</p>
          <pre>{assistantResponse || 'No assistant response yet'}</pre>
        </div>
      )}
      <div className="button-row">
        <button className="primary-button" type="button" onClick={onRunFullDemo || onRunCompanion} disabled={isRunning}>
          {isRunning ? 'Running full demo…' : 'Run full demo'}
        </button>
        {debugMode && (
          <button className="secondary-button" type="button" onClick={onRunCompanion} disabled={isRunning}>
            {isRunning ? 'Running companion…' : 'Run companion reply'}
          </button>
        )}
      </div>
      <p className="muted">
        GitHub Models and Gemini use the safe local proxy with server-side env secrets. Demo mode + browser speech fallback runs end-to-end without paid TTS keys; OAuth is scaffold-only for now.
      </p>
    </section>
  )
}
