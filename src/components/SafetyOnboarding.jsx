const items = [
  'I have the rights to this avatar, rig, voice, and any reference assets I upload.',
  'I understand this MVP is for creator-owned companions, guides, greeters, and character experiences.',
  'I will not use this MVP to impersonate real people or enable abusive, deceptive, or exploitative roleplay.',
  'I understand API keys should stay local and must never be committed to git.',
]

export function SafetyOnboarding() {
  return (
    <section className="panel human-card" data-testid="safety-onboarding">
      <div className="section-head">
        <p className="eyebrow">Onboarding</p>
        <h2>Safety + asset-rights checklist</h2>
      </div>
      <ul className="checklist">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}
