# Delivery And Inbox

## Shared delivery target (fallback used now)
- Primary shared surface: GitHub repo `https://github.com/kdylan1010-alt/avatarlink-companion-studio`
- Status updates: `docs/STATUS.md`
- QA/debug evidence: `docs/QA_PLAN.md`, `docs/QA_NOTES_VRM.md`, `docs/VRM_DEBUG_STATUS.md`, `docs/DEMO_ASSETS.md`
- Team inbox fallback: Discord `#bot-communication` plus GitHub Issues on this repo

## How blockers are filed
1. Open/update a GitHub Issue with the blocker title, proof, and next action.
2. Mirror the short blocker summary into Discord `#bot-communication`.
3. Record any reproducible UI/runtime evidence in repo docs before asking for review.

## How QA results are published
- Smoke/build commands are run locally from `/Users/a1111/Desktop/avatarlink-companion-studio`.
- Results are summarized in `docs/STATUS.md` and detailed in the QA notes files.
- Browser-visible proof is verified at `http://127.0.0.1:4173/` until Pages is live.

## Review path for Eihei/Hermes
- Review the latest commit SHA in the repo.
- Read `docs/STATUS.md` for current artifact + blocker state.
- Read `docs/DELIVERY_AND_INBOX.md` for delivery routing.
- Check GitHub Issues for open blockers / next implementation step.

## External CRM later (not required now)
Possible later upgrades, not blockers for current delivery:
- webhook relay endpoint
- Supabase table + edge function
- GitHub Actions ingest to issue/project
- CRM connector (HubSpot / Airtable / Notion / Linear)
