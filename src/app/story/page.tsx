import { StoryMap } from '@/components/story/StoryMap';
import { LAB_RETURN } from '@/lib/shell/surfaces';

/**
 * /story — the story map: imported `pof.storygraph/1` graphs drawn in the Orrery.
 * Declared in `src/lib/shell/surfaces.ts` so the lab header and search offer it.
 */
export default function StoryPage() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex justify-end px-6 pt-4">
        <a
          href={LAB_RETURN.href}
          aria-label={LAB_RETURN.ariaLabel}
          className="focus-ring text-xs text-text-muted underline underline-offset-4 hover:text-text"
        >
          {LAB_RETURN.label}
        </a>
      </div>
      <div className="min-h-0 flex-1">
        <StoryMap />
      </div>
    </div>
  );
}
