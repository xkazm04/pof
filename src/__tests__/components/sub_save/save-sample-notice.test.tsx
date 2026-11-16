import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('@/hooks/useTabFeatures', () => ({
  useTabFeatures: () => ({ featureMap: new Map(), stats: { implemented: 0, total: 0 }, defs: [], isLoading: false }),
}));
vi.mock('@/components/modules/core-engine/unique-tabs/VisibleSection', () => ({
  VisibleSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/modules/core-engine/unique-tabs/FeatureMapTab', () => ({ default: () => null }));
vi.mock('@/components/modules/core-engine/sub_save/schema/SaveHeaderAudit', () => ({ SaveHeaderAudit: () => null }));

import { SaveDataSchema } from '@/components/modules/core-engine/sub_save';

afterEach(cleanup);

const notice = (c: HTMLElement) => c.querySelector('[data-sample-notice]');

function open(label: string) {
  const view = render(<SaveDataSchema moduleId="arpg-save" />);
  const tab = Array.from(view.container.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  fireEvent.click(tab as HTMLElement);
  return view.container;
}

describe('Save module labels its hand-typed panels', () => {
  it('flags the sample panels on the Schema tab', () => {
    expect(notice(render(<SaveDataSchema moduleId="arpg-save" />).container)).toBeTruthy();
  });

  it('flags the Slots tab', () => {
    expect(notice(open('Slots'))).toBeTruthy();
  });

  it('flags the Advanced tab', () => {
    expect(notice(open('Advanced'))).toBeTruthy();
  });

  it('does not flag the Versions tab, which derives from the field authority', () => {
    expect(notice(open('Versions'))).toBeNull();
  });
});
