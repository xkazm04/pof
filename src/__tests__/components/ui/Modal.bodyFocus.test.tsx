/**
 * Modal keeps trapping Tab and handling Escape when focus has fallen to the body
 * (focused control removed/disabled, or backdrop clicked with closeOnBackdrop=false),
 * and with nested modals only the TOPMOST reacts.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

afterEach(cleanup);

function focusBody() {
  (document.activeElement as HTMLElement | null)?.blur();
  expect(document.activeElement).toBe(document.body);
}

describe('Modal with focus on the body', () => {
  it('Escape still closes', () => {
    const onClose = vi.fn();
    render(
      <Modal open title="T" onClose={onClose} closeOnBackdrop={false}>
        <button>A</button>
      </Modal>,
    );
    focusBody();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Tab is pulled back inside the dialog', () => {
    render(
      <Modal open title="T" onClose={() => {}} closeOnBackdrop={false}>
        <button>First</button>
        <button>Last</button>
      </Modal>,
    );
    focusBody();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    const dialog = screen.getByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('Escape in nested modals closes only the topmost', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Modal open title="Outer" onClose={outer}>
        <button>Outer action</button>
        <Modal open title="Inner" onClose={inner}>
          <button>Inner action</button>
        </Modal>
      </Modal>,
    );
    focusBody();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(0);
  });

  it('Escape from a focused control inside the inner modal closes it once, not the outer', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Modal open title="Outer" onClose={outer}>
        <Modal open title="Inner" onClose={inner}>
          <button>Inner action</button>
        </Modal>
      </Modal>,
    );
    fireEvent.keyDown(screen.getByText('Inner action'), { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(0);
  });
});
