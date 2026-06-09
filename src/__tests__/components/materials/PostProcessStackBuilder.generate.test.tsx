import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { PostProcessStackBuilder } from '@/components/modules/content/materials/PostProcessStackBuilder';

afterEach(cleanup);

describe('PostProcessStackBuilder — generate path feedback', () => {
  it('dispatches without an inline error when generation succeeds', () => {
    const onGenerate = vi.fn();
    const { getByRole, queryByTestId } = render(
      <PostProcessStackBuilder onGenerate={onGenerate} isGenerating={false} />,
    );
    fireEvent.click(getByRole('button', { name: /compile volume/i }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(queryByTestId('pp-generate-error')).toBeNull();
  });

  it('surfaces a consistent inline error when the generate dispatch throws', () => {
    const onGenerate = vi.fn(() => {
      throw new Error('CLI session busy');
    });
    const { getByRole, getByTestId } = render(
      <PostProcessStackBuilder onGenerate={onGenerate} isGenerating={false} />,
    );
    fireEvent.click(getByRole('button', { name: /compile volume/i }));
    const errBox = getByTestId('pp-generate-error');
    expect(errBox.textContent).toContain('CLI session busy');
    expect(errBox.getAttribute('role')).toBe('alert');
  });

  it('does not show the empty-state hint while effects are enabled by default', () => {
    const { queryByTestId } = render(
      <PostProcessStackBuilder onGenerate={vi.fn()} isGenerating={false} />,
    );
    expect(queryByTestId('pp-generate-empty')).toBeNull();
  });
});
