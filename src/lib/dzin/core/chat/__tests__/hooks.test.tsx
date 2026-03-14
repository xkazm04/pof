import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createChatStore } from '../store';
import { useChatMessages } from '../hooks';

describe('useChatMessages', () => {
  it('returns empty array initially', () => {
    const store = createChatStore();
    const { result } = renderHook(() => useChatMessages(store));

    expect(result.current).toEqual([]);
  });

  it('re-renders when message added', () => {
    const store = createChatStore();
    const { result } = renderHook(() => useChatMessages(store));

    act(() => {
      store.addMessage('user', 'Hello Jinn');
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].content).toBe('Hello Jinn');
    expect(result.current[0].role).toBe('user');
  });

  it('re-renders when message content appended', () => {
    const store = createChatStore();
    const { result } = renderHook(() => useChatMessages(store));

    act(() => {
      store.addMessage('assistant', 'Hello');
    });

    const id = result.current[0].id;

    act(() => {
      store.appendContent(id, ' there');
    });

    expect(result.current[0].content).toBe('Hello there');
  });
});
