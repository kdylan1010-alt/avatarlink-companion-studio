export function buildProviderResponseMap(contract = {}) {
  const provider = contract?.provider ?? 'stub'
  const frameBridgeKey = provider === 'stub' ? 'frames' : 'audio.frames'
  const transcriptKey = provider === 'stub' ? 'text' : 'output.text'
  const voiceKey = provider === 'stub' ? 'voiceId' : 'voice.id'

  return {
    provider,
    frameBridgeKey,
    transcriptKey,
    voiceKey,
    status: provider === 'stub' ? 'stub_provider_response_map_ready' : 'custom_provider_response_map_ready',
  }
}
