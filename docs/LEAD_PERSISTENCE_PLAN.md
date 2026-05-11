# Lead Persistence Plan

## Current state
- Demo lead capture persists in browser `localStorage`.
- Operators can export CSV or JSON handoff artifacts for outreach/delivery.

## Practical next persistence path
1. **Keep localStorage as offline-first draft cache** for the browser demo.
2. **POST exported leads to a tiny server endpoint** (`/api/leads`) backed by Supabase or Airtable once deployment is available.
3. **Mirror every submission to CSV/JSON download** so sales has a zero-blocker fallback if hosting breaks.
4. **Add webhook fan-out later** for Discord/CRM after the server endpoint is stable.

## Recommended first production step
- Use a server-side endpoint (Cloudflare Worker / Netlify Function / tiny Express route) to validate `name`, `email`, `useCase`, then upsert into Supabase or Airtable.
- Keep provider keys and CRM credentials server-side only.

## Why this path
- Preserves the working browser demo today.
- Avoids freezing on Pages/hosting.
- Gives a minimal durable inbox beyond local-only storage without forcing a full CRM integration first.
