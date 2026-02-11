/**
 * Claude Terminal Session Manager
 * Simplified from vibeman - no SDK service dependency.
 */

import type { TerminalSession, SessionStatus } from './types';

const sessions = new Map<string, TerminalSession>();

let sessionCounter = 0;

export function createSession(projectPath: string): TerminalSession {
  sessionCounter++;
  const id = `session-${Date.now()}-${sessionCounter}`;
  const now = Date.now();

  const session: TerminalSession = {
    id,
    projectPath,
    status: 'idle',
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    totalCostUsd: 0,
  };

  sessions.set(id, session);
  return session;
}

export function getSession(sessionId: string): TerminalSession | null {
  return sessions.get(sessionId) || null;
}

export function updateSession(
  sessionId: string,
  updates: Partial<Omit<TerminalSession, 'id' | 'createdAt'>>
): TerminalSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const updated = { ...session, ...updates, updatedAt: Date.now() };
  sessions.set(sessionId, updated);
  return updated;
}

export function deleteSession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function getSessionStatus(sessionId: string): SessionStatus | null {
  const session = sessions.get(sessionId);
  return session?.status || null;
}

export function listSessions(): TerminalSession[] {
  return Array.from(sessions.values()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function cleanupOldSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
  const cutoff = Date.now() - maxAgeMs;
  let deleted = 0;
  for (const [id, session] of sessions) {
    if (session.updatedAt < cutoff && session.status !== 'running') {
      sessions.delete(id);
      deleted++;
    }
  }
  return deleted;
}
