const PLACEHOLDER_FRAGMENTS = [
  '<',
  '>',
  'your-proxy',
  'new-tunnel',
  'example',
  'changeme',
  'placeholder',
]

function hasPlaceholderFragment(value = '') {
  const lower = String(value || '').toLowerCase()
  return PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))
}

function normalizeUrlPath(pathname = '/') {
  const trimmed = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname
  return trimmed || '/'
}

function isLoopbackHostname(hostname = '') {
  const lower = String(hostname || '').toLowerCase()
  return lower === 'localhost' || lower === '127.0.0.1' || lower === '::1'
}

function looksLikeEndpointPath(pathname = '') {
  const normalized = normalizeUrlPath(pathname).toLowerCase()
  return /\/(generate|chat\/completions|responses|health|readyz)$/.test(normalized)
}

export function validateProxyBase(rawValue, { windowObject = typeof window !== 'undefined' ? window : undefined } = {}) {
  const value = String(rawValue || '').trim()
  if (!value) return { ok: false, code: 'empty', reason: 'Proxy URL is empty' }
  if (hasPlaceholderFragment(value)) {
    return { ok: false, code: 'placeholder', reason: 'Proxy URL still contains a placeholder token' }
  }

  const baseOrigin = windowObject?.location?.origin || 'http://localhost'
  let parsed
  try {
    parsed = new URL(value, baseOrigin)
  } catch {
    return { ok: false, code: 'parse', reason: 'Proxy URL could not be parsed' }
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, code: 'protocol', reason: 'Proxy URL must use http or https' }
  }

  if (parsed.protocol === 'http:' && !isLoopbackHostname(parsed.hostname)) {
    return { ok: false, code: 'public-http', reason: 'Public proxy URLs must use https unless they are loopback localhost' }
  }

  if (hasPlaceholderFragment(parsed.hostname) || hasPlaceholderFragment(parsed.pathname)) {
    return { ok: false, code: 'placeholder', reason: 'Proxy URL host/path still contains placeholder text' }
  }

  if (looksLikeEndpointPath(parsed.pathname)) {
    return { ok: false, code: 'endpoint-path', reason: 'Proxy override must point at the proxy base, not a specific endpoint path' }
  }

  const normalized = `${parsed.origin}${normalizeUrlPath(parsed.pathname)}`
  return {
    ok: true,
    normalized,
    hadSensitiveParts: Boolean(parsed.search || parsed.hash || parsed.username || parsed.password),
  }
}

export function consumeStoredProxyBase(storageKey, { windowObject = typeof window !== 'undefined' ? window : undefined } = {}) {
  if (!windowObject) return { value: '', error: null }
  try {
    const params = new URLSearchParams(windowObject.location.search)
    const queryValue = params.get(storageKey)
    if (queryValue) {
      const validatedQuery = validateProxyBase(queryValue, { windowObject })
      if (validatedQuery.ok) {
        windowObject.localStorage.setItem(storageKey, validatedQuery.normalized)
        return {
          value: validatedQuery.normalized,
          error: validatedQuery.hadSensitiveParts
            ? `Ignored sensitive query/hash/auth fragments in ${storageKey}; stored sanitized proxy base only.`
            : null,
        }
      }
      windowObject.localStorage.removeItem(storageKey)
      return {
        value: '',
        error: `Blocked invalid ${storageKey} override from URL (${validatedQuery.code}). Using safe default instead.`,
      }
    }

    const storedValue = windowObject.localStorage.getItem(storageKey) || ''
    if (!storedValue) return { value: '', error: null }
    const validatedStored = validateProxyBase(storedValue, { windowObject })
    if (validatedStored.ok) {
      if (validatedStored.normalized !== storedValue) {
        windowObject.localStorage.setItem(storageKey, validatedStored.normalized)
      }
      return {
        value: validatedStored.normalized,
        error: validatedStored.hadSensitiveParts
          ? `Sanitized stored ${storageKey} to remove query/hash/auth fragments.`
          : null,
      }
    }
    windowObject.localStorage.removeItem(storageKey)
    return {
      value: '',
      error: `Cleared invalid stored ${storageKey} (${validatedStored.code}). Using safe default instead.`,
    }
  } catch {
    return { value: '', error: `Unable to read ${storageKey}; using safe default instead.` }
  }
}

export function classifyLiveProxyFailure(errorLike, statusCode) {
  const message = String(errorLike?.message || errorLike || '').trim()
  if (statusCode === 401) return { code: '401', label: 'BLOCKED', reason: '401 Unauthorized from live proxy/provider' }
  if (statusCode === 403) return { code: '403', label: 'BLOCKED', reason: '403 Forbidden from live proxy/provider' }
  if (statusCode === 404) return { code: '404', label: 'BLOCKED', reason: '404 Not Found from live proxy/provider' }
  if (statusCode === 429) return { code: '429', label: 'BLOCKED', reason: '429 rate limit/quota reached on live proxy/provider' }
  if (statusCode >= 500 && statusCode <= 599) return { code: '5xx', label: 'BLOCKED', reason: `Live proxy HTTP ${statusCode}` }
  if (/failed to parse url|invalid url/i.test(message)) return { code: 'URL_PARSE', label: 'BLOCKED', reason: 'Invalid proxy URL configuration' }
  if (/abort|timed out|timeout/i.test(message)) return { code: 'timeout', label: 'BLOCKED', reason: 'Live proxy timed out' }
  if (/network|fetch|load failed|failed to fetch|err_connection|econnrefused|enotfound/i.test(message)) return { code: 'network', label: 'BLOCKED', reason: 'Live proxy network failure' }
  if (statusCode) return { code: String(statusCode), label: 'BLOCKED', reason: `Live proxy HTTP ${statusCode}` }
  return { code: 'unknown', label: 'BLOCKED', reason: message || 'Live proxy failure' }
}
