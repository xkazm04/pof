/* eslint-disable no-console -- CLI harness; stdout is its interface. */
// Capped Feature Matrix review: one module through the running app's own review door.
//
//   npm run review:module -- combat --project-path "C:\Users\kazda\Documents\Unreal Projects\PoF" --ue-version 5.7.3
//   npm run review:module -- combat --project-path "..." --ue-version 5.7.3 --write
//
// DRY-RUN BY DEFAULT: without --write it prints the plan and starts nothing. --write is
// the only thing that spends a CLI run.
// CAPPED: at most DAILY_REVIEW_CAP (3) reviews per local calendar day, counted in a ledger
// (~/.pof/review-runner-ledger.json, or --ledger / env POF_REVIEW_LEDGER) the moment the app
// accepts a review, so a crash mid-review still counts. A refused request is not counted.
// APP MUST BE UP: this is an HTTP client of POST /api/feature-matrix/batch-review on the
// running PoF app (--origin, default http://localhost:3000); it starts no server and writes
// the DB only through the app. It refuses when the app is down or a batch is already running.
//
// Exit 0 = reviewed, or a dry-run. Non-zero = refusal, failure, timeout, or bad arguments.
// Logic lives in the pure src/lib/evaluator/review-runner.ts (types stripped by Node).
import { parseArgs, runReview, USAGE } from '../src/lib/evaluator/review-runner.ts';

const parsed = parseArgs(process.argv.slice(2), process.env);
if (!parsed.ok) {
  if (parsed.error) console.error(`error: ${parsed.error}\n`);
  console.error(USAGE);
  process.exit(2);
}

const outcome = await runReview(parsed.options, {
  fetch: (url, init) => fetch(url, init),
  now: () => new Date(),
  env: process.env,
  log: (line) => console.log(line),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
});
process.exit(outcome.ok ? 0 : 1);
