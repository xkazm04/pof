// @ts-nocheck — Voice module requires @anthropic-ai/voice SDK (not yet available)
'use client';

/**
 * useAdvisorVoice — Voice mode hook for the PoF advisor.
 *
 * Bridges GeminiLiveClient (ephemeral token, AUDIO mode) with
 * AudioIOManager and the IntentBus/ChatStore from useIntentDispatch.
 *
 * Features:
 * - Auto-connect on first voice interaction (no separate activation step)
 * - Push-to-talk via Space key (when no text input is focused)
 * - Idle disconnect after 2 min silence
 * - onTranscription callback for wiring to useMultimodalInput
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { GeminiLiveClient } from '@dzin/voice';
import { AudioIOManager } from '@dzin/voice';
import { UI_TIMEOUTS } from '@/lib/constants';
import { logger } from '@/lib/logger';
import { apiFetch } from '@/lib/api-utils';
import type { IntentBus } from '@dzin/core';
import type { ChatStore } from '@dzin/core';
import type { WorkspaceState } from '@dzin/core';
import type { PanelDirective, LayoutTemplateId } from '@dzin/core';
import type { GeminiFunctionCall } from '@dzin/voice';

type VoiceName = 'Aoede' | 'Charon' | 'Fenrir' | 'Kore' | 'Puck';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

/**
 * Check if the user is currently typing in an input element.
 * Returns true if Space should be treated as normal text input.
 */
function isTypingInInput(e: KeyboardEvent): boolean {
  const target = e.target;
  if (!target || !(target instanceof HTMLElement)) return false;

  if (target instanceof HTMLInputElement) return true;
  if (target instanceof HTMLTextAreaElement) return true;
  if (target.getAttribute('contenteditable') === 'true') return true;
  if (target.getAttribute('contenteditable') === '') return true;
  if (target.getAttribute('role') === 'textbox') return true;

  return false;
}

export interface UseAdvisorVoiceOptions {
  bus: IntentBus;
  chatStore: ChatStore;
  /** Get current workspace state for tool call context */
  getState: () => WorkspaceState;
  /** Apply workspace changes from tool calls */
  onWorkspaceChange: (directives: PanelDirective[], templateId: LayoutTemplateId) => void;
  /** Callback when voice input is transcribed */
  onTranscription?: (text: string) => void;
}

export function useAdvisorVoice({
  chatStore,
  getState,
  onWorkspaceChange,
  onTranscription,
}: UseAdvisorVoiceOptions) {
  const clientRef = useRef<GeminiLiveClient | null>(null);
  const audioRef = useRef<AudioIOManager | null>(null);
  const audioUnsubRef = useRef<(() => void) | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tokenExpiresAtRef = useRef<number | null>(null);

  // Auto-connect state
  const pendingRecordAfterConnectRef = useRef(false);

  // Idle disconnect timer
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pushToTalkEnabled, setPushToTalkEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceConnectionState, setVoiceConnectionState] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [selectedVoice, setSelectedVoice] = useState<VoiceName>('Puck');

  const isRecordingRef = useRef(false);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  const voiceConnectionStateRef = useRef(voiceConnectionState);
  useEffect(() => { voiceConnectionStateRef.current = voiceConnectionState; }, [voiceConnectionState]);

  const onTranscriptionRef = useRef(onTranscription);
  useEffect(() => { onTranscriptionRef.current = onTranscription; }, [onTranscription]);

  const getStateRef = useRef(getState);
  getStateRef.current = getState;

  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  onWorkspaceChangeRef.current = onWorkspaceChange;

  // ─── Tool Call Handler ──────────────────────────

  const handleToolCalls = useCallback((calls: GeminiFunctionCall[]) => {
    const liveClient = clientRef.current;

    for (const call of calls) {
      switch (call.name) {
        case 'compose_workspace': {
          const { action, layout, panels: panelsJson, reasoning } = call.args as {
            action: string;
            layout?: string;
            panels?: string | Array<{ type: string; role?: string; density?: string }>;
            reasoning?: string;
          };

          let panels: Array<{ type: string; role?: string; density?: string }> = [];
          if (panelsJson) {
            try {
              panels = typeof panelsJson === 'string' ? JSON.parse(panelsJson) : panelsJson;
            } catch {
              panels = [];
            }
          }

          const state = getStateRef.current();
          let newPanels = [...state.panels];

          switch (action) {
            case 'replace':
              newPanels = panels.map((p, i) => ({
                id: `panel-${p.type}-${i}`,
                type: p.type,
                slotIndex: i,
                density: (p.density ?? 'full') as 'micro' | 'compact' | 'full',
                role: (p.role ?? 'secondary') as 'primary' | 'secondary' | 'tertiary' | 'sidebar',
                uiState: {},
              }));
              break;
            case 'show':
              for (const p of panels) {
                if (!newPanels.some(existing => existing.type === p.type)) {
                  newPanels.push({
                    id: `panel-${p.type}-${newPanels.length}`,
                    type: p.type,
                    slotIndex: newPanels.length,
                    density: (p.density ?? 'full') as 'micro' | 'compact' | 'full',
                    role: (p.role ?? 'secondary') as 'primary' | 'secondary' | 'tertiary' | 'sidebar',
                    uiState: {},
                  });
                }
              }
              break;
            case 'hide':
              for (const p of panels) {
                newPanels = newPanels.filter(existing => existing.type !== p.type);
              }
              break;
            case 'clear':
              newPanels = [];
              break;
          }

          const directives: PanelDirective[] = newPanels.map(p => ({
            type: p.type,
            role: p.role,
            density: p.density,
            dataSlice: p.dataSlice,
          }));
          const templateId = (layout ?? state.layout.template) as LayoutTemplateId;
          onWorkspaceChangeRef.current(directives, templateId);

          liveClient?.respondToToolCall(call.id, call.name, { success: true });

          if (reasoning) {
            chatStore.addMessage('system', reasoning);
          }
          break;
        }

        case 'suggest_action': {
          const { content } = call.args as { content: string };
          if (content) {
            chatStore.addMessage('system', content);
          }
          liveClient?.respondToToolCall(call.id, call.name, { success: true });
          break;
        }

        default:
          liveClient?.respondToToolCall(call.id, call.name, { error: `Unknown tool: ${call.name}` });
          break;
      }
    }
  }, [chatStore]);

  // ─── Connect Voice ─────────────────────────────

  const connectVoice = useCallback(async (voice?: VoiceName) => {
    if (voiceConnectionState !== 'disconnected') return;
    setVoiceConnectionState('connecting');

    const voiceToUse = voice ?? selectedVoice;
    if (voice) setSelectedVoice(voice);

    try {
      const data = await apiFetch<{ token: string; voice: string; expiresIn?: number; expiresAt?: string }>('/api/agents/live-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: voiceToUse }),
      });
      tokenExpiresAtRef.current = data.expiresAt
        ? new Date(data.expiresAt).getTime()
        : Date.now() + (data.expiresIn ?? 1800) * 1000;

      const liveClient = new GeminiLiveClient();
      clientRef.current = liveClient;

      liveClient.onStateChange((state) => {
        if (state === 'connected') setVoiceConnectionState('connected');
        else if (state === 'disconnected') {
          setVoiceConnectionState('disconnected');
        } else if (state === 'connecting' || state === 'reconnecting') {
          setVoiceConnectionState('connecting');
        }
      });

      liveClient.onMessage((text) => {
        chatStore.addMessage('assistant', text);
      });

      liveClient.onToolCall(handleToolCalls);

      liveClient.onInputTranscription((text) => {
        onTranscriptionRef.current?.(text);
      });

      // Wire audio output
      const audio = new AudioIOManager();
      audioRef.current = audio;

      liveClient.onAudio((base64Pcm) => {
        audio.playAudioChunk(base64Pcm);
        setIsSpeaking(true);
        setTimeout(() => setIsSpeaking(false), 500);
      });

      // On setup complete, check if we should auto-start recording
      liveClient.onSetupComplete(() => {
        if (pendingRecordAfterConnectRef.current) {
          pendingRecordAfterConnectRef.current = false;
          const audioMgr = audioRef.current;
          if (audioMgr && liveClient.isConnected) {
            audioMgr.startCapture().then(() => {
              audioUnsubRef.current = audioMgr.onAudioChunk((base64Pcm) => {
                liveClient.sendAudio(base64Pcm);
              });
              setIsRecording(true);
            }).catch(() => {
              // Mic access failed after auto-connect
            });
          }
        }
      });

      liveClient.connect({ ephemeralToken: data.token, audioMode: true, voice: voiceToUse });

      // Schedule token refresh
      if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
      const expiresAt = tokenExpiresAtRef.current;
      if (expiresAt) {
        const refreshIn = Math.max(5000, expiresAt - Date.now() - 5 * 60 * 1000);
        tokenRefreshTimerRef.current = setTimeout(() => {
          apiFetch<{ token: string; expiresIn?: number; expiresAt?: string }>('/api/agents/live-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voice: voiceToUse }),
          })
            .then((fresh) => {
              tokenExpiresAtRef.current = fresh.expiresAt
                ? new Date(fresh.expiresAt).getTime()
                : Date.now() + (fresh.expiresIn ?? 1800) * 1000;
            })
            .catch(() => {
              // ignore refresh failures
            });
        }, refreshIn);
      }

      chatStore.addMessage('system', `Voice mode connected (${voiceToUse}). Tap the mic or hold Space to talk.`);
    } catch (error) {
      logger.warn('[voice] Connection failed:', error);
      pendingRecordAfterConnectRef.current = false;
      setVoiceConnectionState('disconnected');
      chatStore.addMessage('system', `Voice connection failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }, [voiceConnectionState, selectedVoice, chatStore, handleToolCalls]);

  // ─── Recording Toggle ─────────────────────────

  const startRecording = useCallback(async () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }

    if (voiceConnectionStateRef.current === 'disconnected') {
      pendingRecordAfterConnectRef.current = true;
      connectVoice();
      return;
    }

    const audio = audioRef.current;
    const liveClient = clientRef.current;
    if (!audio || !liveClient?.isConnected || isRecording) return;

    try {
      await audio.startCapture();
      audioUnsubRef.current = audio.onAudioChunk((base64Pcm) => {
        liveClient.sendAudio(base64Pcm);
      });
      setIsRecording(true);
    } catch (error) {
      logger.warn('[voice] Mic access failed:', error);
      chatStore.addMessage('system', 'Microphone access denied. Please allow microphone access.');
    }
  }, [isRecording, chatStore, connectVoice]);

  const stopRecording = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !isRecording) return;

    audio.stopCapture();
    audioUnsubRef.current?.();
    audioUnsubRef.current = null;
    setIsRecording(false);

    // Start idle disconnect timer
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      clientRef.current?.disconnect();
      clientRef.current = null;
      audioRef.current?.destroy();
      audioRef.current = null;
      setVoiceConnectionState('disconnected');
      setIsSpeaking(false);
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
        tokenRefreshTimerRef.current = null;
      }
    }, UI_TIMEOUTS.voiceIdleDisconnect);
  }, [isRecording]);

  // ─── Disconnect Voice ─────────────────────────

  const disconnectVoice = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    stopRecording();
    clientRef.current?.disconnect();
    clientRef.current = null;
    audioRef.current?.destroy();
    audioRef.current = null;
    setVoiceConnectionState('disconnected');
    setIsSpeaking(false);
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
      tokenRefreshTimerRef.current = null;
    }
  }, [stopRecording]);

  // ─── Send Text (fallback while in voice mode) ─

  const sendText = useCallback((text: string) => {
    const liveClient = clientRef.current;
    if (!liveClient?.isConnected) return;
    chatStore.addMessage('user', text);
    liveClient.send(text);
  }, [chatStore]);

  // ─── Push-to-talk Keyboard Handler ────────────

  useEffect(() => {
    if (!pushToTalkEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (e.repeat) return;
      if (isTypingInInput(e)) return;

      e.preventDefault();
      startRecording();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isRecordingRef.current) {
        stopRecording();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [pushToTalkEnabled, startRecording, stopRecording]);

  // ─── Cleanup on unmount ───────────────────────

  useEffect(() => {
    return () => {
      if (tokenRefreshTimerRef.current) clearTimeout(tokenRefreshTimerRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      audioRef.current?.destroy();
      clientRef.current?.disconnect();
    };
  }, []);

  return {
    voiceConnectionState,
    isRecording,
    isSpeaking,
    selectedVoice,
    pushToTalkEnabled,

    connectVoice,
    disconnectVoice,
    startRecording,
    stopRecording,
    sendText,
    setSelectedVoice,
    setPushToTalkEnabled,

    liveClientRef: clientRef,
  };
}
