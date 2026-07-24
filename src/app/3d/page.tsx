import type { Metadata } from 'next';
import { Studio3D } from '@/components/studio-3d/Studio3D';

export const metadata: Metadata = {
  title: '3D Studio · PoF',
  description: 'Preview, rotate and inspect generated 3D assets before they go into Unreal.',
};

/** /3d — studio viewer for the generated 3D assets (preview + rotate before Unreal). */
export default function Studio3DPage() {
  return <Studio3D />;
}
