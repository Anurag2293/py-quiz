# PyQuiz

One 30-question quiz a day for Data Analyst interview prep: core Python, NumPy, pandas,
matplotlib/seaborn, data cleaning and EDA, statistics, and scikit-learn basics.

Stack: TanStack Start (React, Vite, Nitro), Clerk for auth, Convex for data, Vercel for hosting.

## How it works

- **Daily quiz.** The first visit each day (midnight in the user's time zone, default
  Asia/Kolkata) assigns 30 questions: Python 5, NumPy 4, pandas 6, viz 4, cleaning 4, stats 4,
  scikit-learn 3, with about 9 easy, 14 medium and 7 hard. Questions she has already seen are
  skipped until a track runs out; after that the ones she got wrong, then the oldest, come back
  first.
- **Timer.** 50 minutes by default, 45 to 60 in Settings. The deadline is stored on the server
  when the quiz starts, and a Convex scheduled function submits the quiz at the deadline even
  if the tab is closed. Answers save as she picks them.
- **Review and progress.** Score, time taken, per-track breakdown, and every question with its
  correct answer and explanation. The Progress page shows streaks, scores over time, a 12-week
  calendar, weakest tracks, and how much of each track's bank she has seen.

## Question bank

`questions/<track>.json` holds 505 hand-written questions; `questions/AUTHORING.md` has the format
and rules. Every predict-the-output answer is checked by running the snippet:

```bash
uv venv .venv -p 3.12 && uv pip install -p .venv numpy pandas matplotlib seaborn scikit-learn scipy
uv venv .venv-pandas2 -p 3.12 && uv pip install -p .venv-pandas2 "numpy<2.1" "pandas>=2.2,<2.3" "matplotlib<3.11" seaborn "scikit-learn<1.7" scipy
.venv/bin/python questions/verify.py          # all tracks
.venv/bin/python questions/verify.py pandas   # one track
```

The verifier runs each snippet under both environments (pandas 3 and pandas 2.2), so an answer
that depends on the library version fails.

After editing the bank, push it to Convex. The seed is an upsert keyed by question id, and
questions removed from the files are deactivated:

```bash
npx convex run seed:questions          # dev
npx convex run --prod seed:questions   # production
```

## Running locally

```bash
npm install
npx convex dev      # terminal 1: syncs convex/ to the dev deployment
npm run dev         # terminal 2: http://localhost:3000
```

`.env.local` (gitignored) holds the Clerk keys and the Convex URL. Convex needs
`CLERK_JWT_ISSUER_DOMAIN` set on each deployment, and the Clerk instance needs a JWT template
named `convex` (audience `convex`).

## Deploying

```bash
npx convex deploy        # push functions to the production deployment
vercel deploy --prod     # build and deploy the site
```

Vercel production env: `VITE_CONVEX_URL` (production deployment URL), `VITE_CLERK_PUBLISHABLE_KEY`,
`CLERK_SECRET_KEY`, and the `VITE_CLERK_SIGN_*` URLs.
