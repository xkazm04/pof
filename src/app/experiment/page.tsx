import { ExperimentLab } from '@/components/experiment-lab/ExperimentLab';
import { LAB_RETURN } from '@/lib/shell/surfaces';

/**
 * /experiment — the UE Experiment Lab (run a concept on UE 5.8, see the output).
 *
 * Now reachable from the lab shell (header route cluster + ⌘K search); before that its
 * only link in `src/` lived in the legacy shell scheduled for deletion. The return
 * affordance uses the same accessible name as `/status` and `/3d` so leaving any
 * secondary surface is one recognisable act.
 */
export default function ExperimentPage() {
  return (
    <>
      <div className="mx-auto flex max-w-4xl justify-end px-6 pt-4">
        <a
          href={LAB_RETURN.href}
          aria-label={LAB_RETURN.ariaLabel}
          className="focus-ring text-xs text-text-muted underline underline-offset-4 hover:text-text"
        >
          {LAB_RETURN.label}
        </a>
      </div>
      <ExperimentLab />
    </>
  );
}
