'use client';

import { CopyButton } from '@/components/ui/CopyButton';

export function CopyItemButton({ text, tooltip = 'Copy' }: { text: string; tooltip?: string }) {
  return <CopyButton text={text} size="sm" tooltip={tooltip} />;
}
