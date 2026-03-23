/**
 * useIntentDispatch — Creates and connects all Dzin subsystems for the
 * PoF prototype workspace.
 *
 * Initializes: StateEngine, Director, IntentBus, ChatStore.
 * Lazy-creates LLMTransport on first 'needs-llm' intent.
 */

'use client';

import { useMemo, useEffect, useRef } from 'react';
import {
  createStateEngine,
  createDirector,
  createIntentBus,
  createChatStore,
  createComposeHandler,
  createManipulateHandler,
  createNavigateHandler,
  createSystemHandler,
} from '@/lib/dzin/core';
import type { WorkspaceState } from '@/lib/dzin/core/state/types';
import type { IntentBus, IntentResult } from '@/lib/dzin/core/intent';
import type { ChatStore } from '@/lib/dzin/core/chat';
import type { PanelDirective, LayoutTemplateId } from '@/lib/dzin/core/layout/types';
import { pofRegistry } from '@/lib/dzin/panel-definitions';
import { AdvisorClient } from '@/lib/dzin/advisor/AdvisorClient';
import type { AdvisorToolCall } from '@/lib/dzin/advisor/AdvisorClient';
import { logger } from '@/lib/logger';

/* ── Types ────────────────────────────────────────────────────────────── */

export interface IntentDispatchResult {
  bus: IntentBus;
  chatStore: ChatStore;
  advisorClient: AdvisorClient;
  /** Current directives derived from state engine */
  getDirectives: () => PanelDirective[];
  getTemplateId: () => LayoutTemplateId;
}

/* ── Hook ─────────────────────────────────────────────────────────────── */

export function useIntentDispatch(
  initialDirectives: PanelDirective[],
  initialTemplate: LayoutTemplateId,
  onWorkspaceChange?: (directives: PanelDirective[], templateId: LayoutTemplateId) => void,
): IntentDispatchResult {
  const onWorkspaceChangeRef = useRef(onWorkspaceChange);
  onWorkspaceChangeRef.current = onWorkspaceChange;

  const system = useMemo(() => {
    // 1. State engine
    const initialState: WorkspaceState = {
      layout: {
        template: initialTemplate,
        gridTemplateRows: '1fr',
        gridTemplateColumns: '1fr',
      },
      panels: initialDirectives.map((d, i) => ({
        id: `panel-${d.type}-${i}`,
        type: d.type,
        slotIndex: i,
        density: d.density ?? 'full',
        role: d.role ?? 'secondary',
        dataSlice: d.dataSlice,
        uiState: {},
      })),
      streaming: null,
    };

    const stateEngine = createStateEngine(initialState);

    // 2. Director with handlers
    const director = createDirector({
      compose: createComposeHandler(
        (type: string) => pofRegistry.has(type),
        {},
        () => stateEngine.getState(),
      ),
      manipulate: createManipulateHandler(() => stateEngine.getState()),
      navigate: createNavigateHandler(),
      system: createSystemHandler(),
    });

    // 3. Intent bus
    const bus = createIntentBus(director, stateEngine);

    // 4. Chat store
    const chatStore = createChatStore();

    // 5. Advisor client
    const advisorClient = new AdvisorClient();

    return { stateEngine, bus, chatStore, advisorClient };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Single initialization

  // Subscribe to state changes → update parent
  useEffect(() => {
    const unsub = system.stateEngine.subscribe((state: unknown) => {
      const ws = state as WorkspaceState;
      const directives: PanelDirective[] = ws.panels.map(p => ({
        type: p.type,
        role: p.role,
        density: p.density,
        dataSlice: p.dataSlice,
      }));
      const templateId = ws.layout.template;
      onWorkspaceChangeRef.current?.(directives, templateId);
    });
    return unsub;
  }, [system.stateEngine]);

  // Subscribe to bus events → forward 'needs-llm' to advisor
  useEffect(() => {
    const unsub = system.bus.subscribe((event: { result: IntentResult; intent: { id: string } }) => {
      if (event.result.status === 'needs-llm') {
        // Get current workspace snapshot for advisor context
        const state = system.stateEngine.getState();
        const workspace = {
          panels: state.panels.map(p => ({ type: p.type, role: p.role })),
          layout: state.layout.template,
        };
        // The user's text is already in the chat store — pull the last user message
        const lastUserMsg = [...system.chatStore.messages]
          .reverse()
          .find(m => m.role === 'user');

        system.advisorClient.sendContext(workspace, lastUserMsg?.content);
      }
    });
    return unsub;
  }, [system]);

  // Wire advisor tool calls → workspace changes
  useEffect(() => {
    const unsubToolCall = system.advisorClient.onToolCall((calls: AdvisorToolCall[]) => {
      for (const call of calls) {
        if (call.name === 'compose_workspace') {
          handleComposeToolCall(call.args, system);
        } else if (call.name === 'suggest_action') {
          const content = call.args.content as string;
          if (content) system.chatStore.addMessage('system', content);
        }
      }
    });

    const unsubMessage = system.advisorClient.onMessage((text: string) => {
      system.chatStore.addMessage('assistant', text);
    });

    const unsubStreaming = system.advisorClient.onStreamingText((chunk: string) => {
      // Find the last assistant message that's streaming, or create one
      const messages = system.chatStore.messages;
      const lastAssistant = messages[messages.length - 1];
      if (lastAssistant?.role === 'assistant' && lastAssistant.isStreaming) {
        system.chatStore.appendContent(lastAssistant.id, chunk);
      } else {
        const id = system.chatStore.addMessage('assistant', chunk);
        system.chatStore.updateMessage(id, { isStreaming: true });
      }
    });

    const unsubProcessing = system.advisorClient.onProcessingChange((isProcessing: boolean) => {
      if (!isProcessing) {
        // Mark last streaming message as complete
        const messages = system.chatStore.messages;
        const lastAssistant = messages[messages.length - 1];
        if (lastAssistant?.role === 'assistant' && lastAssistant.isStreaming) {
          system.chatStore.updateMessage(lastAssistant.id, { isStreaming: false });
        }
      }
    });

    const unsubError = system.advisorClient.onError((errorMessage: string) => {
      system.chatStore.addMessage('system', `Advisor error: ${errorMessage}`);
    });

    // Auto-connect on mount
    system.advisorClient.connect().catch(() => {
      logger.warn('[useIntentDispatch] Advisor connection failed');
    });

    return () => {
      unsubToolCall();
      unsubMessage();
      unsubStreaming();
      unsubProcessing();
      unsubError();
      system.advisorClient.disconnect();
    };
  }, [system]);

  const getDirectives = () => {
    const state = system.stateEngine.getState();
    return state.panels.map(p => ({
      type: p.type,
      role: p.role,
      density: p.density,
      dataSlice: p.dataSlice,
    }));
  };

  const getTemplateId = () => system.stateEngine.getState().layout.template;

  return {
    bus: system.bus,
    chatStore: system.chatStore,
    advisorClient: system.advisorClient,
    getDirectives,
    getTemplateId,
  };
}

/* ── Tool call handler ────────────────────────────────────────────────── */

function handleComposeToolCall(
  args: Record<string, unknown>,
  system: { stateEngine: import('@/lib/dzin/core/state/types').StateEngine<WorkspaceState>; bus: IntentBus },
) {
  const action = args.action as string;
  const layout = args.layout as LayoutTemplateId | undefined;
  let panels: Array<{ type: string; role?: string; density?: string }> = [];

  if (args.panels && typeof args.panels === 'string') {
    try {
      panels = JSON.parse(args.panels);
    } catch {
      logger.warn('[advisor] Failed to parse panels JSON:', args.panels);
      return;
    }
  }

  const state = system.stateEngine.getState();

  // Build new panel list based on action
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

  // Apply via state engine (creates undo group)
  const newState: WorkspaceState = {
    layout: {
      template: layout ?? state.layout.template,
      gridTemplateRows: state.layout.gridTemplateRows,
      gridTemplateColumns: state.layout.gridTemplateColumns,
    },
    panels: newPanels,
    streaming: null,
  };

  system.stateEngine._applyWithoutUndo(newState);
}
