import { describe, it, expect, vi } from 'vitest';
import { createChatStore } from '../store';
import type { ChatStore } from '../types';

describe('createChatStore', () => {
  function makeStore(): ChatStore {
    return createChatStore();
  }

  // -------------------------------------------------------------------------
  // Message CRUD
  // -------------------------------------------------------------------------

  it('addMessage returns a UUID id and stores message with role, content, timestamp', () => {
    const store = makeStore();
    const before = Date.now();
    const id = store.addMessage('user', 'Hello');
    const after = Date.now();

    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const msgs = store.messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].id).toBe(id);
    expect(msgs[0].role).toBe('user');
    expect(msgs[0].content).toBe('Hello');
    expect(msgs[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(msgs[0].timestamp).toBeLessThanOrEqual(after);
  });

  it('updateMessage modifies specified message fields', () => {
    const store = makeStore();
    const id = store.addMessage('user', 'Draft');
    store.updateMessage(id, { content: 'Final' });

    expect(store.messages[0].content).toBe('Final');
    expect(store.messages[0].role).toBe('user'); // unchanged
  });

  it('appendContent concatenates chunk to existing message content', () => {
    const store = makeStore();
    const id = store.addMessage('assistant', 'Hello');
    store.appendContent(id, ' world');

    expect(store.messages[0].content).toBe('Hello world');
  });

  it('removeMessage deletes message by id', () => {
    const store = makeStore();
    const id1 = store.addMessage('user', 'First');
    const id2 = store.addMessage('user', 'Second');
    store.removeMessage(id1);

    expect(store.messages).toHaveLength(1);
    expect(store.messages[0].id).toBe(id2);
  });

  it('clear empties all messages', () => {
    const store = makeStore();
    store.addMessage('user', 'A');
    store.addMessage('assistant', 'B');
    store.clear();

    expect(store.messages).toHaveLength(0);
  });

  it('messages array caps at 200 entries (oldest trimmed)', () => {
    const store = makeStore();
    for (let i = 0; i < 210; i++) {
      store.addMessage('user', `msg-${i}`);
    }

    expect(store.messages).toHaveLength(200);
    // Oldest messages (0-9) should be trimmed, first remaining is msg-10
    expect(store.messages[0].content).toBe('msg-10');
    expect(store.messages[199].content).toBe('msg-209');
  });

  // -------------------------------------------------------------------------
  // Subscription
  // -------------------------------------------------------------------------

  it('subscribe notifies listeners on every mutation', () => {
    const store = makeStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.addMessage('user', 'A');
    expect(listener).toHaveBeenCalledTimes(1);

    const id = store.messages[0].id;
    store.updateMessage(id, { content: 'B' });
    expect(listener).toHaveBeenCalledTimes(2);

    store.appendContent(id, '!');
    expect(listener).toHaveBeenCalledTimes(3);

    store.removeMessage(id);
    expect(listener).toHaveBeenCalledTimes(4);

    store.clear();
    expect(listener).toHaveBeenCalledTimes(5);
  });

  it('unsubscribe stops notifications', () => {
    const store = makeStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);

    store.addMessage('user', 'A');
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    store.addMessage('user', 'B');
    expect(listener).toHaveBeenCalledTimes(1); // no additional call
  });

  // -------------------------------------------------------------------------
  // Snapshot
  // -------------------------------------------------------------------------

  it('getSnapshot returns the messages array directly', () => {
    const store = makeStore();
    store.addMessage('user', 'Hello');

    const snapshot = store.getSnapshot();
    expect(Array.isArray(snapshot)).toBe(true);
    expect(snapshot).toHaveLength(1);
    expect(snapshot[0].content).toBe('Hello');
  });

  it('getVersion increments on each mutation', () => {
    const store = makeStore();
    const v0 = store.getVersion();

    store.addMessage('user', 'A');
    const v1 = store.getVersion();
    expect(v1).toBeGreaterThan(v0);

    const id = store.messages[0].id;
    store.appendContent(id, '!');
    const v2 = store.getVersion();
    expect(v2).toBeGreaterThan(v1);
  });

  // -------------------------------------------------------------------------
  // Tool Call Lifecycle
  // -------------------------------------------------------------------------

  it('startToolCall adds a ToolCall with status running and startedAt timestamp', () => {
    const store = makeStore();
    const msgId = store.addMessage('assistant', 'Let me check...');
    const before = Date.now();
    store.startToolCall(msgId, 'tc-1', 'compose_workspace', { panels: ['scene'] });
    const after = Date.now();

    const msg = store.messages[0];
    expect(msg.toolCalls).toHaveLength(1);
    expect(msg.toolCalls![0].id).toBe('tc-1');
    expect(msg.toolCalls![0].name).toBe('compose_workspace');
    expect(msg.toolCalls![0].args).toEqual({ panels: ['scene'] });
    expect(msg.toolCalls![0].status).toBe('running');
    expect(msg.toolCalls![0].startedAt).toBeGreaterThanOrEqual(before);
    expect(msg.toolCalls![0].startedAt).toBeLessThanOrEqual(after);
    expect(msg.toolCalls![0].completedAt).toBeUndefined();
  });

  it('updateToolCall modifies specific tool call fields', () => {
    const store = makeStore();
    const msgId = store.addMessage('assistant', 'Working...');
    store.startToolCall(msgId, 'tc-1', 'query_data', {});
    store.updateToolCall(msgId, 'tc-1', { status: 'success' });

    expect(store.messages[0].toolCalls![0].status).toBe('success');
  });

  it('completeToolCall sets status to success, stores result, sets completedAt', () => {
    const store = makeStore();
    const msgId = store.addMessage('assistant', 'Querying...');
    store.startToolCall(msgId, 'tc-1', 'query_data', { table: 'scenes' });
    const before = Date.now();
    store.completeToolCall(msgId, 'tc-1', { rows: 5 });
    const after = Date.now();

    const tc = store.messages[0].toolCalls![0];
    expect(tc.status).toBe('success');
    expect(tc.result).toEqual({ rows: 5 });
    expect(tc.completedAt).toBeGreaterThanOrEqual(before);
    expect(tc.completedAt).toBeLessThanOrEqual(after);
  });

  it('failToolCall sets status to error, stores error string, sets completedAt', () => {
    const store = makeStore();
    const msgId = store.addMessage('assistant', 'Trying...');
    store.startToolCall(msgId, 'tc-1', 'generate_image', {});
    const before = Date.now();
    store.failToolCall(msgId, 'tc-1', 'API rate limited');
    const after = Date.now();

    const tc = store.messages[0].toolCalls![0];
    expect(tc.status).toBe('error');
    expect(tc.error).toBe('API rate limited');
    expect(tc.completedAt).toBeGreaterThanOrEqual(before);
    expect(tc.completedAt).toBeLessThanOrEqual(after);
  });
});
