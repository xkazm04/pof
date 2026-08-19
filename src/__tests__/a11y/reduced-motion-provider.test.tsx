import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useContext } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { MotionConfigContext } from 'framer-motion';
import { AppMotionProvider } from '@/components/providers/AppMotionProvider';
import { TabBar } from '@/components/ui/TabBar';
import { TEXT_SCALE } from '@/lib/typography-scale';
import { STATUS_ERROR } from '@/lib/chart-colors';

/** Any token colour works for these structural assertions; nothing here tests hue. */
const PROBE_ACCENT = STATUS_ERROR;

/**
 * Guard: the app supplies framer-motion with a reduced-motion policy at the root.
 *
 * framer-motion's own `MotionConfigContext` defaults to `reducedMotion: "never"`,
 * i.e. the library ships explicitly ignoring `prefers-reduced-motion`. The CSS
 * block in `globals.css` cannot help — framer animates from JavaScript. So the
 * only thing standing between a motion-sensitive user and 400+ animating
 * components is this one provider, and it is worth pinning.
 */

afterEach(cleanup);

function ReadPolicy() {
  const { reducedMotion } = useContext(MotionConfigContext);
  return <span data-testid="policy">{String(reducedMotion)}</span>;
}

describe('AppMotionProvider', () => {
  it('publishes reducedMotion="user" to the motion context', () => {
    const { getByTestId } = render(
      <AppMotionProvider>
        <ReadPolicy />
      </AppMotionProvider>,
    );
    expect(getByTestId('policy').textContent).toBe('user');
  });

  it('is not the framer default — without it the policy is "never"', () => {
    // The contrast is the whole point: this asserts the bug the provider fixes.
    const { getByTestId } = render(<ReadPolicy />);
    expect(getByTestId('policy').textContent).toBe('never');
  });

  it('renders its children untouched', () => {
    const { getByText } = render(
      <AppMotionProvider>
        <p>child content</p>
      </AppMotionProvider>,
    );
    expect(getByText('child content')).toBeTruthy();
  });
});

describe('TabBar under the reduced-motion policy', () => {
  // `reducedMotion="user"` also neutralises `layoutId` transitions, because framer
  // executes layout animations as transforms and transforms are positional keys.
  // The risk that buys is a sliding underline that never *lands*; TabBar already
  // branches on `useReducedMotion()` at its transition prop, and this pins that the
  // active indicator is still rendered — and still on the active tab — under the
  // provider, in both the default and the explicitly-reduced case.
  const tabs = [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ] as const;

  it('still renders the active-tab indicator inside the provider', () => {
    const { getAllByRole } = render(
      <AppMotionProvider>
        <TabBar
          tabs={tabs}
          activeId="b"
          onChange={() => {}}
          layoutId="reduced-motion-probe"
          accent={PROBE_ACCENT}
        />
      </AppMotionProvider>,
    );
    const selected = getAllByRole('tab').filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain('Beta');
    // The underline is the only absolutely-positioned child of the active tab.
    expect(selected[0].querySelector('span.absolute')).not.toBeNull();
  });

  it('keeps the badge pill at the sanctioned metadata tier, not a raw sub-floor size', () => {
    const { getByTitle } = render(
      <AppMotionProvider>
        <TabBar
          tabs={[{ id: 'a', label: 'Alpha', badge: { count: 3, color: PROBE_ACCENT, label: '3 open' } }]}
          activeId="a"
          onChange={() => {}}
          layoutId="reduced-motion-badge-probe"
          accent={PROBE_ACCENT}
        />
      </AppMotionProvider>,
    );
    const pill = getByTitle('3 open');
    expect(pill.className).toContain(TEXT_SCALE.meta);
    expect(pill.className).not.toMatch(/text-\[\d+px\]/);
  });
});

describe('root layout', () => {
  // `src/app/layout.tsx` is a server component that pulls in `next/font`, so it is
  // read as source rather than rendered. The assertion is still specific: the
  // provider must wrap `children`, not merely be imported.
  const layout = fs.readFileSync(
    path.join(process.cwd(), 'src', 'app', 'layout.tsx'),
    'utf8',
  );

  it('wraps children in AppMotionProvider', () => {
    expect(layout).toContain('<AppMotionProvider>{children}</AppMotionProvider>');
  });

  it('imports the provider', () => {
    expect(layout).toMatch(/import \{ AppMotionProvider \} from ["']@\/components\/providers\/AppMotionProvider["']/);
  });

  it('paints the body floor from tokens, not a hardcoded hex', () => {
    // `bg-[#0a0a1a]` had drifted one digit from the real --background (#0a0a16).
    expect(layout).toContain('bg-background');
    expect(layout).not.toMatch(/bg-\[#[0-9a-fA-F]{6}\]/);
  });
});
