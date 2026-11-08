/**
 * The Custom UAT Flags field must let a person type a second flag.
 *
 * Its value was derived from the parsed array (`customFlags.join(' ')`) and each
 * keystroke re-parsed with `.split(' ').filter(trim)`, so the space after a flag was
 * filtered away on the same render: typing "-nocompile " showed "-nocompile", and the
 * next "-" glued onto it ("-nocompile-").
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { createDefaultProfile } from '@/lib/packaging/build-profiles';
import { ProfileEditor } from '@/components/modules/game-systems/BuildConfigSelector/ProfileEditor';

afterEach(cleanup);

function flagsInput(): HTMLInputElement {
  return screen.getByPlaceholderText('-nocompile -nop4') as HTMLInputElement;
}

describe('ProfileEditor custom flags', () => {
  it('keeps the trailing space while typing so a second flag can follow', () => {
    render(<ProfileEditor profile={createDefaultProfile('Win64')} onSave={() => {}} onClose={() => {}} />);
    fireEvent.change(flagsInput(), { target: { value: '-nocompile ' } });
    expect(flagsInput().value).toBe('-nocompile ');
    fireEvent.change(flagsInput(), { target: { value: '-nocompile -nop4' } });
    expect(flagsInput().value).toBe('-nocompile -nop4');
  });

  it('saves the parsed flag list', () => {
    const onSave = vi.fn();
    render(<ProfileEditor profile={createDefaultProfile('Win64')} onSave={onSave} onClose={() => {}} />);
    fireEvent.change(flagsInput(), { target: { value: '  -nocompile   -nop4 ' } });
    fireEvent.click(screen.getByText('Save Profile'));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].platformSettings.customFlags).toEqual(['-nocompile', '-nop4']);
  });
});
