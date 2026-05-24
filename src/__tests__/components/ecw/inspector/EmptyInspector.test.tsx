import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EmptyInspector } from '@/components/ecw/inspector/EmptyInspector';

describe('EmptyInspector', () => {
  afterEach(cleanup);
  it('renders the empty-state prompt', () => {
    render(<EmptyInspector />);
    expect(screen.getByText(/Select an entity from a catalog/i)).toBeTruthy();
  });
});
