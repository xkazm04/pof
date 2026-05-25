// Chat module barrel export

// Types
export type {
  MessageRole,
  ToolCallStatus,
  ToolCall,
  ChatMessage,
  CompositionSummary,
  SlashCommand,
  ChatStore,
  SuggestedComposeAction,
  SuggestedPanel,
  SuggestedCompose,
  SuggestedActionStatus,
  SuggestedAction,
} from './types';

// Store
export { createChatStore } from './store';

// Commands
export { matchCommands } from './commands';

// Hooks
export { useChatMessages } from './hooks';
