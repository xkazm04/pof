import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { ForgeErrorCard } from '@/components/modules/core-engine/sub_ability/forge/ForgeErrorCard';

afterEach(cleanup);

describe('ForgeErrorCard', () => {
  it('renders the classified title + cause for a JSON parse failure', () => {
    const { getByText, container } = render(
      <ForgeErrorCard error={new Error('Failed to parse Gemini response as JSON')} />,
    );
    expect(getByText(/unreadable answer/i)).toBeTruthy();
    expect(container.querySelector('[data-error-kind="json-parse"]')).toBeTruthy();
  });

  it('invokes onRetry when the retry action is clicked', () => {
    const onRetry = vi.fn();
    const { container } = render(
      <ForgeErrorCard error={new Error('NetworkError when attempting to fetch')} onRetry={onRetry} />,
    );
    const retry = container.querySelector('[data-action="retry"]') as HTMLButtonElement;
    expect(retry).toBeTruthy();
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('invokes onEditDescription when the edit action is clicked', () => {
    const onEdit = vi.fn();
    const { container } = render(
      <ForgeErrorCard error={new Error('Incomplete ability generated — missing className')} onEditDescription={onEdit} />,
    );
    const edit = container.querySelector('[data-action="edit-description"]') as HTMLButtonElement;
    expect(edit).toBeTruthy();
    fireEvent.click(edit);
    expect(onEdit).toHaveBeenCalledOnce();
  });

  it('hides the raw message until "Technical details" is expanded', () => {
    const { container, getByRole } = render(
      <ForgeErrorCard error={new Error('something weird happened')} />,
    );
    expect(container.textContent).not.toContain('something weird happened');
    fireEvent.click(getByRole('button', { name: /technical details/i }));
    expect(container.textContent).toContain('something weird happened');
  });

  it('sends a missing API key to the AI Studio key page', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <ForgeErrorCard error={new Error('Gemini API key not configured. Set GEMINI_API_KEY in .env.local.')} />,
    );
    fireEvent.click(container.querySelector('[data-action="configure"]') as HTMLButtonElement);
    expect(openSpy).toHaveBeenCalledWith('https://aistudio.google.com/app/apikey', '_blank', 'noopener,noreferrer');
    openSpy.mockRestore();
  });

  it('does NOT send a misconfigured-model error to the API-key page — there is no key to fix', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { container } = render(
      <ForgeErrorCard error={new Error('[404 Not Found] models/gemini-2.0-flash is not found for API version v1beta')} />,
    );
    fireEvent.click(container.querySelector('[data-action="configure"]') as HTMLButtonElement);
    expect(openSpy).not.toHaveBeenCalled();
    // The real fix (GEMINI_FORGE_MODEL) is server-side — surface the technical details instead.
    expect(container.textContent).toContain('is not found for API version');
    openSpy.mockRestore();
  });
});
