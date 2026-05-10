import { useMemo, useState } from 'react'

const starterLeads = [
  {
    name: 'Mina Studio',
    useCase: 'VTuber merch drops + fan Q&A',
    value: '$1,200 pilot',
    status: 'follow_up_today',
  },
  {
    name: 'Coach Aria',
    useCase: 'Paid AI accountability companion',
    value: '$900 setup + monthly retainer',
    status: 'needs_demo',
  },
]

export function LeadCapturePanel() {
  const [form, setForm] = useState({
    creator: '',
    email: '',
    useCase: '',
  })
  const [leads, setLeads] = useState(starterLeads)
  const [message, setMessage] = useState('')

  const offerSummary = useMemo(() => {
    return 'Founding pilot offer: custom VRM companion demo, lead capture setup, and launch support.'
  }, [])

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (!form.creator || !form.email || !form.useCase) {
      setMessage('Missing creator, email, or use case.')
      return
    }
    setLeads((current) => [
      {
        name: form.creator,
        useCase: form.useCase,
        value: '$750 qualified pilot target',
        status: 'new_inbox',
      },
      ...current,
    ])
    setMessage(`Saved lead for ${form.creator} — ready for outreach follow-up.`)
    setForm({ creator: '', email: '', useCase: '' })
  }

  return (
    <section className="panel human-card" data-testid="lead-capture-panel">
      <div className="section-head">
        <p className="eyebrow">Revenue path</p>
        <h2>Creator pilot waitlist</h2>
      </div>
      <p className="lede-tight">{offerSummary}</p>
      <div className="offer-grid">
        <div className="preview-card">
          <p className="mono">Offer</p>
          <ul>
            <li>Launch a paid avatar companion pilot in 7 days</li>
            <li>Bring your own model key and VRM</li>
            <li>Includes lead capture + demo rehearsal flow</li>
          </ul>
          <p className="strong-line">Reserve founder slot — $750 setup target</p>
        </div>
        <form className="preview-card" onSubmit={handleSubmit}>
          <p className="mono">Lead capture form</p>
          <label>
            Creator / brand
            <input value={form.creator} onChange={(event) => handleChange('creator', event.target.value)} placeholder="Mina Studio" />
          </label>
          <label>
            Contact email
            <input value={form.email} onChange={(event) => handleChange('email', event.target.value)} placeholder="team@example.com" />
          </label>
          <label>
            Monetization use case
            <textarea value={form.useCase} onChange={(event) => handleChange('useCase', event.target.value)} placeholder="Paid fan concierge, merch drops, coaching upsell..." />
          </label>
          <button className="primary-button" type="submit">Save pilot lead</button>
          <p className="muted">{message || 'This runnable demo stores leads in-browser so the sales flow is visible right now.'}</p>
        </form>
      </div>
      <div className="preview-card">
        <p className="mono">Recent pilot leads</p>
        <ul>
          {leads.map((lead) => (
            <li key={`${lead.name}-${lead.status}`}>
              <strong>{lead.name}</strong> — {lead.useCase} — {lead.value} — {lead.status}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
