# Lumen Web App

Lumen is a UK-focused ATS CV optimizer and application workspace built from the supplied PRD. This implementation includes a warm UK-market landing page, guided onboarding, scan reveal, editable optimized CV, cover letter, match report, application tracker, LinkedIn kit, interview prep and TXT/DOCX/PDF exports.

## Run Locally

```bash
npm install
npm run dev
```

The dev server is configured for `127.0.0.1`. If port `5173` is occupied, Vite will pick the next available port.

## Test Account

Use this account from the top-right Login button or after the reveal:

- Email: `founder@lumen.test`
- Password: `Lumen2026!`

If no scan exists yet, the login opens a ready-made workspace so the platform can be reviewed directly. In production, checkout should create or find the user account from the buyer email and return them through a secure magic link.

## Build

```bash
npm run build
```

## What Works Now

- Longer onboarding flow from target role to scan reveal.
- CV can be pasted or skipped; skipped-CV users get a starter plan and can add the CV later.
- Job description is optional; users can optimise around a target role first.
- Deterministic ATS analysis with a score only when enough CV text exists; skipped-CV users see a starter plan and next steps.
- Editable optimized CV and cover letter.
- Client-side TXT, DOCX and PDF export.
- One-click full application pack export.
- Cover letter studio with company, role, tone and evidence controls.
- Account login with a saved workspace.
- Application tracker with local CRUD, status updates and response/interview stats.
- Tracker follow-up message generation.
- LinkedIn headline/about/keyword generation.
- Interview question, answer frame and STAR worksheet generation.
- Browser-only persistence via `localStorage`.
- UK-market landing proof points based on ONS Labour Market Overview June 2026 and Indeed Hiring Lab June 2026.

## Current Architecture

- Frontend: React + Vite + TypeScript.
- Persistence: `localStorage`.
- Analysis/generation: local deterministic TypeScript functions in `src/engine.ts`.
- Exports: browser-side `docx` and `jspdf`, lazy-loaded only when export buttons are clicked.

## Production Backend Needed

See `outputs/lumen-backend-launch-plan.md` for the backend, database, auth, AI, one-time payment and fair-use steps needed to turn this into a hosted production platform.
