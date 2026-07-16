'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { COMMIT_DEBOUNCE_MS } from './constants';

// ── Debounced text fields ──
//
// Every keystroke in the scenario editor used to fire onUpdate → a PUT that
// auto-refetched the whole suite (twice, per ai-testing-db.getTestingSummary),
// and the refetched value then replaced the controlled `value` mid-edit,
// dropping characters / jumping the cursor.
//
// These wrappers keep the input bound to LOCAL state while the user is typing,
// debounce the upstream commit (~400ms), and flush immediately on blur. The
// server value only re-syncs into the field when it changes externally AND the
// field is not focused — so an in-flight refetch can never clobber an active
// edit. The final committed value is identical to what was typed.

function useDebouncedField(value: string, onCommit: (v: string) => void) {
  const [local, setLocal] = useState(value);
  // `focused` is state (not a ref) so the render-time sync below can read it
  // without violating the refs-during-render rule.
  const [focused, setFocused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCommitRef = useRef(onCommit);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);
  // Holds the latest pending (typed-but-not-yet-committed) value so the unmount
  // cleanup — which runs after this render's `local` closure may be stale — can
  // flush the correct value.
  const pendingRef = useRef<string | null>(null);

  // Re-sync from server only when not actively editing (avoids mid-edit clobber).
  // Adjust state during render (React's recommended pattern) rather than in an effect:
  // when the server `value` changes, mirror it into local state only if the field
  // isn't focused, so an in-flight refetch can't replace what the user is typing.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (!focused) setLocal(value);
  }

  // Flush any pending debounced commit on unmount. If the debounce timer is still
  // armed when the field unmounts (e.g. the scenario card is collapsed via
  // AnimatePresence before the ~400ms window elapses and no blur fires), commit
  // the pending value instead of silently discarding it. `pendingRef` is nulled
  // both here and when the timer fires normally, so a commit happens at most once.
  useEffect(() => () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      if (pendingRef.current !== null) {
        onCommitRef.current(pendingRef.current);
        pendingRef.current = null;
      }
    }
  }, []);

  const onChange = useCallback((next: string) => {
    setLocal(next);
    pendingRef.current = next;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = null;
      onCommitRef.current(next);
    }, COMMIT_DEBOUNCE_MS);
  }, []);

  const onFocus = useCallback(() => { setFocused(true); }, []);

  const onBlur = useCallback((next: string) => {
    setFocused(false);
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    pendingRef.current = null;
    // Commit only if the value actually diverged from the last server value.
    if (next !== value) onCommitRef.current(next);
  }, [value]);

  return { local, onChange, onFocus, onBlur };
}

export function DebouncedInput({
  value, onCommit, className, placeholder, type = 'text',
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  type?: string;
}) {
  const { local, onChange, onFocus, onBlur } = useDebouncedField(value, onCommit);
  return (
    <input
      type={type}
      value={local}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={(e) => onBlur(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function DebouncedTextarea({
  value, onCommit, className, placeholder, rows,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  placeholder?: string;
  rows?: number;
}) {
  const { local, onChange, onFocus, onBlur } = useDebouncedField(value, onCommit);
  return (
    <textarea
      value={local}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={(e) => onBlur(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  );
}
