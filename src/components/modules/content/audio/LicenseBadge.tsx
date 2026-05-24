'use client';

import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import { STATUS_SUCCESS, STATUS_ERROR } from '@/lib/chart-colors';
import type { AudioKind, CommercialLicense } from '@/lib/audio-gen/types';

const AMBER = '#f59e0b';

export function LicenseBadge({ license, kind }: { license: CommercialLicense; kind: AudioKind }) {
  if (license === 'yes') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium"
            style={{ backgroundColor: `${STATUS_SUCCESS}20`, color: STATUS_SUCCESS, border: `1px solid ${STATUS_SUCCESS}40` }}
            title={`${kind} from this provider is commercially licensed.`}>
        <ShieldCheck className="w-3 h-3" /> Commercial OK
      </span>
    );
  }
  if (license === 'extra-license') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium"
            style={{ backgroundColor: `${AMBER}20`, color: AMBER, border: `1px solid ${AMBER}40` }}
            title={`${kind} from this provider needs an extra license for games/film/TV.`}>
        <AlertTriangle className="w-3 h-3" /> Extra license required
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-medium"
          style={{ backgroundColor: `${STATUS_ERROR}20`, color: STATUS_ERROR, border: `1px solid ${STATUS_ERROR}40` }}
          title={`${kind} from this provider is NOT commercially licensed.`}>
      <ShieldAlert className="w-3 h-3" /> Non-commercial
    </span>
  );
}
