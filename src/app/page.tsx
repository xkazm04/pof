import { NewAppShell } from '@/components/ecw/NewAppShell';

/**
 * Root page. Renders the Entity-Centric Workspace shell — the sole shell as of
 * the Phase 12 cutover (the legacy AppShell + `?ecw=1` gate were removed). See
 * `docs/superpowers/plans/2026-05-25-pof-ecw-phase-12-readiness.md`.
 */
export default function Home() {
  return <NewAppShell />;
}
