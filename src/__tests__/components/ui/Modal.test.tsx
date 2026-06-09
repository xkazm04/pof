/**
 * Accessibility + behavior guard for the reusable <Modal> shell
 * (src/components/ui/Modal.tsx).
 *
 * The shell is the extracted home for every cross-cutting dialog concern:
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - initial focus into the dialog (initialFocusRef or first focusable)
 *   - Tab / Shift+Tab focus trap that cycles within the dialog
 *   - Escape-to-close + backdrop-click-to-close
 *   - focus restored to the trigger on close
 *
 * Close behavior is asserted via the onClose callback rather than DOM removal,
 * since AnimatePresence defers unmount to its exit animation (timing-sensitive
 * under jsdom). Focus restore is driven by a useEffect on `open`, which is
 * independent of the exit animation, so it is asserted on a state-driven close.
 *
 * setup.ts has no afterEach(cleanup) — see reference_test_no_autocleanup.
 */
import { useRef, useState } from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

afterEach(cleanup);

/** A Modal whose open state is fixed, with a spy onClose — for event wiring. */
function ControlledModal(props: Partial<React.ComponentProps<typeof Modal>> & { onClose: () => void }) {
  return (
    <Modal open title="Author a Pattern" {...props} onClose={props.onClose}>
      <input aria-label="Title field" />
      <button>Middle action</button>
      <button>Save Pattern</button>
    </Modal>
  );
}

/** State-driven harness: an external trigger + Modal — for focus behaviors. */
function Harness({ withInitialRef = false }: { withInitialRef?: boolean }) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Author a Pattern"
        initialFocusRef={withInitialRef ? inputRef : undefined}
      >
        <input ref={inputRef} aria-label="Title field" />
        <button>Middle action</button>
        <button>Save Pattern</button>
      </Modal>
    </div>
  );
}

function openHarness(): HTMLElement {
  const trigger = screen.getByRole('button', { name: /open dialog/i });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe('<Modal> accessible shell', () => {
  it('renders nothing when closed', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders role=dialog with aria-modal and an aria-labelledby that resolves to the title', () => {
    render(<Harness />);
    openHarness();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const labelledBy = dialog.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toBe('Author a Pattern');
  });

  it('uses aria-label (not aria-labelledby) when no title is given', () => {
    render(
      <Modal open onClose={() => {}} label="Quick confirm">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: /quick confirm/i });
    expect(dialog.getAttribute('aria-labelledby')).toBeNull();
    expect(dialog.getAttribute('aria-label')).toBe('Quick confirm');
  });

  it('moves focus to initialFocusRef on open', async () => {
    render(<Harness withInitialRef />);
    openHarness();

    const input = screen.getByLabelText('Title field');
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it('falls back to focusing the first focusable (close button) when no initialFocusRef', async () => {
    render(<Harness />);
    openHarness();

    const close = screen.getByRole('button', { name: /close dialog/i });
    await waitFor(() => expect(document.activeElement).toBe(close));
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<ControlledModal onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is clicked but not when the panel is clicked', () => {
    const onClose = vi.fn();
    render(<ControlledModal onClose={onClose} />);

    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.parentElement as HTMLElement;

    fireEvent.click(dialog); // inside the panel — must NOT close
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(backdrop); // the backdrop — closes
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on backdrop click when closeOnBackdrop is false', () => {
    const onClose = vi.fn();
    render(<ControlledModal onClose={onClose} closeOnBackdrop={false} />);

    const backdrop = screen.getByRole('dialog').parentElement as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose from the header close button', () => {
    const onClose = vi.fn();
    render(<ControlledModal onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus: the last element wraps to the first, and Shift+Tab on the first wraps to the last', () => {
    render(<Harness />);
    openHarness();

    const close = screen.getByRole('button', { name: /close dialog/i });
    const last = screen.getByRole('button', { name: /save pattern/i });

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the trigger on close', async () => {
    render(<Harness withInitialRef />);
    const trigger = openHarness();

    const input = screen.getByLabelText('Title field');
    await waitFor(() => expect(document.activeElement).toBe(input));

    // Escape flips `open` to false in the harness; the restore effect runs.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
