#!/usr/bin/env node
import { validateProxyBase, classifyLiveProxyFailure } from '../src/lib/proxyConfig.js'

const cases = [
  {
    name: 'rejects placeholder token in URL',
    result: validateProxyBase('https://<new-tunnel>/api/github-models'),
    expectOk: false,
    expectCode: 'placeholder',
  },
  {
    name: 'rejects public http proxy base',
    result: validateProxyBase('http://demo.avatarlink.dev/api/github-models'),
    expectOk: false,
    expectCode: 'public-http',
  },
  {
    name: 'allows localhost http proxy base',
    result: validateProxyBase('http://127.0.0.1:8787/api/github-models'),
    expectOk: true,
    expectNormalized: 'http://127.0.0.1:8787/api/github-models',
  },
  {
    name: 'rejects endpoint path instead of base path',
    result: validateProxyBase('https://api.avatarlink.dev/api/github-models/generate'),
    expectOk: false,
    expectCode: 'endpoint-path',
  },
  {
    name: 'sanitizes query/hash/userinfo when otherwise valid',
    result: validateProxyBase('https://api.avatarlink.dev/api/github-models?token=abc#frag'),
    expectOk: true,
    expectNormalized: 'https://api.avatarlink.dev/api/github-models',
    expectSensitive: true,
  },
]

const failureCases = [
  {
    name: 'classifies 404 separately',
    result: classifyLiveProxyFailure('Not found', 404),
    expectCode: '404',
  },
  {
    name: 'classifies 503 separately',
    result: classifyLiveProxyFailure('Service unavailable', 503),
    expectCode: '5xx',
  },
]

const failures = []
for (const testCase of cases) {
  const { name, result, expectOk, expectCode, expectNormalized, expectSensitive } = testCase
  if (Boolean(result?.ok) !== expectOk) failures.push(`${name}: expected ok=${expectOk}, got ${JSON.stringify(result)}`)
  if (expectCode && result?.code !== expectCode) failures.push(`${name}: expected code=${expectCode}, got ${JSON.stringify(result)}`)
  if (expectNormalized && result?.normalized !== expectNormalized) failures.push(`${name}: expected normalized=${expectNormalized}, got ${JSON.stringify(result)}`)
  if (typeof expectSensitive === 'boolean' && Boolean(result?.hadSensitiveParts) !== expectSensitive) failures.push(`${name}: expected hadSensitiveParts=${expectSensitive}, got ${JSON.stringify(result)}`)
}
for (const testCase of failureCases) {
  const { name, result, expectCode } = testCase
  if (result?.code !== expectCode) failures.push(`${name}: expected code=${expectCode}, got ${JSON.stringify(result)}`)
}

const output = {
  passed: failures.length === 0,
  failures,
  cases: cases.map(({ name, result }) => ({ name, result })),
  failureCases: failureCases.map(({ name, result }) => ({ name, result })),
}
console.log(JSON.stringify(output, null, 2))
if (failures.length) process.exit(1)
