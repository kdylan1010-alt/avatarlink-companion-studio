export function buildProviderTtsContract({
  provider = 'stub',
  voiceId = 'demo-voice',
  format = 'wav',
  sampleRate = 24000,
} = {}) {
  return {
    provider,
    voiceId,
    format,
    sampleRate,
    acceptsText: true,
    returnsFrameBridge: true,
    mode: provider === 'stub' ? 'stub_provider_contract_ready' : 'custom_provider_contract_ready',
  }
}
