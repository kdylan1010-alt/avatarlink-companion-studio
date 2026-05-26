import { useEffect, useMemo, useState } from 'react'
const starterLeads = [
  {
    name: 'Mina Studio',
    email: 'team@example.com',
    useCase: 'VTuber merch drops + fan Q&A',
    value: '$1,200 pilot',
    status: 'follow_up_today',
    createdAt: '2026-05-10T09:00:00Z',
  },
  {
    name: 'Coach Aria',
    email: 'aria@example.com',
    useCase: 'Paid AI accountability companion',
    value: '$900 setup + monthly retainer',
    status: 'needs_demo',
    createdAt: '2026-05-10T09:30:00Z',
  },
]
const STORAGE_KEY = 'avatarlink-pilot-leads'
function loadStoredLeads() {
  if (typeof window === 'undefined') return starterLeads
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return starterLeads
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length ? parsed : starterLeads
  } catch {
    return starterLeads
  }
}
function exportLeadCsv(leads) {
  const headers = ['name', 'email', 'useCase', 'value', 'status', 'createdAt']
  const lines = [headers.join(',')]
  for (const lead of leads) {
    const row = headers.map((key) => {
      const value = String(lead[key] ?? '').replaceAll('"', '""')
      return `"${value}"`
    })
    lines.push(row.join(','))
  }
  return lines.join('\n')
}
export function LeadCapturePanel() {
  const [form, setForm] = useState({
    creator: '',
    email: '',
    useCase: '',
  })
  const [leads, setLeads] = useState(() => loadStoredLeads())
  const [message, setMessage] = useState('')
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leads))
  }, [leads])
  const offerSummary = useMemo(() => {
    return 'Founding pilot offer: custom VRM companion demo, lead capture setup, and launch support.'
  }, [])

  const latestLead = leads[0] ?? null

  const latestLeadPayload = useMemo(() => {
    return latestLead ? JSON.stringify(latestLead, null, 2) : 'No leads captured yet.'
  }, [latestLead])

  const outreachMailto = useMemo(() => {
    if (!latestLead?.email) return '#'
    const subject = encodeURIComponent(`AvatarLink pilot follow-up for ${latestLead.name}`)
    const body = encodeURIComponent([
      `Hi ${latestLead.name},`,
      '',
      'Thanks for the interest in the AvatarLink pilot.',
      `Use case noted: ${latestLead.useCase}`,
      'Next step: send a VRM + schedule a 15-minute demo review.',
      '',
      '— AvatarLink Companion Studio',
    ].join('\n'))
    return `mailto:${latestLead.email}?subject=${subject}&body=${body}`
  }, [latestLead])

  const leadQueue = useMemo(() => {
    return leads.map((lead, index) => ({
      rank: index + 1,
      owner: 'sales',
      priority: index === 0 ? 'hot' : lead.status === 'needs_demo' ? 'warm' : 'follow_up',
      nextAction: index === 0 ? 'send_followup_now' : lead.status === 'needs_demo' ? 'book_demo' : 'review_pipeline',
      ...lead,
    }))
  }, [leads])

  const queueSummary = useMemo(() => JSON.stringify(leadQueue, null, 2), [leadQueue])

  const deliveryPayload = useMemo(() => JSON.stringify({
    exportedAt: new Date().toISOString(),
    queueSize: leadQueue.length,
    leads: leadQueue,
  }, null, 2), [leadQueue])
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
        email: form.email,
        useCase: form.useCase,
        value: '$750 qualified pilot target',
        status: 'new_inbox',
        createdAt: new Date().toISOString(),
      },
      ...current,
    ])
    setMessage(`Saved lead for ${form.creator} — persisted in-browser and ready for CSV export.`)
    setForm({ creator: '', email: '', useCase: '' })
  }
  const handleExportCsv = () => {
    if (typeof window === 'undefined') return
    const csv = exportLeadCsv(leads)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'avatarlink-pilot-leads.csv'
    link.click()
    window.URL.revokeObjectURL(url)
    setMessage(`Exported ${leads.length} leads to avatarlink-pilot-leads.csv`)
  }

  const handleExportDeliveryJson = () => {
    if (typeof window === 'undefined') return
    const blob = new Blob([deliveryPayload], { type: 'application/json;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'avatarlink-lead-queue.json'
    link.click()
    window.URL.revokeObjectURL(url)
    setMessage(`Exported ${leadQueue.length} queued leads to avatarlink-lead-queue.json`)
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
          <button className="secondary-button" type="button" onClick={handleExportCsv}>Export leads CSV</button>
          <button className="secondary-button" type="button" onClick={handleExportDeliveryJson}>Export delivery JSON</button>
          <p className="muted">{message || 'This runnable demo now persists leads in browser localStorage and exports CSV for outreach.'}</p>
        </form>
      </div>
      <div className="preview-card">
        <p className="mono">Recent pilot leads</p>
        <ul>
          {leads.map((lead) => (
            <li key={`${lead.name}-${lead.status}-${lead.createdAt}`}>
              <strong>{lead.name}</strong> — {lead.useCase} — {lead.value} — {lead.status}
            </li>
          ))}
        </ul>
      </div>
      <div className="preview-card">
        <p className="mono">Latest lead handoff</p>
        <p>{latestLead ? `${latestLead.name} • ${latestLead.email}` : 'No lead captured yet'}</p>
        <pre>{latestLeadPayload}</pre>
        <a className="primary-button" href={outreachMailto}>Open follow-up draft</a>
      </div>
      <div className="preview-card">
        <p className="mono">Lead queue snapshot</p>
        <pre>{queueSummary}</pre>
      </div>
      <div className="preview-card">
        <p className="mono">Delivery bridge payload</p>
        <pre>{deliveryPayload}</pre>
      </div>
    </section>
  )
}
