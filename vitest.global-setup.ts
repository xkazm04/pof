import { execSync } from 'node:child_process';

/** Ensure the (gitignored) pipeline registry barrel exists before any test imports it. */
export default function setup() {
  execSync('node scripts/gen-pipeline-registry.mjs', { stdio: 'ignore' });
}
