import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ErrorBanner } from '@/components/modules/project-setup/ErrorBanner';

afterEach(cleanup);

describe('ErrorBanner', () => {
  it('wraps a long reason instead of clipping it to one line', () => {
    const message = 'Could not read the project folder: Cannot read directory C:/a/very/long/path (EPERM)';
    render(<ErrorBanner message={message} />);
    const text = screen.getByText(message);
    expect(text.className).not.toContain('truncate');
    expect(text.className).toContain('break-words');
  });
});
