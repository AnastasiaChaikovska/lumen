# Lumen Web App

Lumen is a UK-focused ATS CV optimizer and application workspace built from the supplied PRD. This implementation is a working web app: a longer UK-market landing page, guided onboarding, scan reveal, editable optimized CV, cover letter, match report, application tracker, LinkedIn kit, interview prep and TXT/DOCX/PDF exports.

The amended monetisation model is reflected in the app copy: one-time payment at launch, no subscription or trial, with a planned £19 launch price and £24 test.

## Run Locally

```bash
npm install
npm run dev
```

The dev server is configured for `127.0.0.1`. If port `5173` is occupied, Vite will pick the next available port.

## Build

```bash
npm run build
```

## What Works Now

- Longer onboarding flow from target role to scan reveal.
- CV can be pasted or skipped; skipped-CV users get a starter plan and can add the CV later.
- Job description is optional; users can optimise around a target role first.
- Deterministic ATS analysis with score, keyword gaps, formatting checks and improvement steps.
- Editable optimized CV and cover letter.
- Client-side TXT, DOCX and PDF export.
- Application tracker with local CRUD, status updates and response/interview stats.
- LinkedIn headline/about/keyword generation.
- Interview question and STAR worksheet generation.
- Browser-only persistence via `localStorage`.
- UK-market landing proof points based on ONS Labour Market Overview June 2026 and Indeed Hiring Lab June 2026.

## Current Architecture

- Frontend: React + Vite + TypeScript.
- Persistence: `localStorage`.
- Analysis/generation: local deterministic TypeScript functions in `src/engine.ts`.
- Exports: browser-side `docx` and `jspdf`, lazy-loaded only when export buttons are clicked.

## Production Backend Needed

See `outputs/lumen-backend-launch-plan.md` for the backend, database, auth, AI, one-time payment and fair-use steps needed to turn this into a hosted production platform.
