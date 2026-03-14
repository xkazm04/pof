// @dzin/core public API

// Types
export type {
  PanelDensity,
  PanelRole,
  PanelSizeClass,
  PanelComplexity,
  DensityConfig,
  PanelPropSchema,
  PanelOutput,
  PanelDataSlice,
  PanelFrameProps,
} from './types';

// Density
export { DensityProvider, useDensity } from './density';
export type { DensityProviderProps } from './density';

// Panel
export { PanelFrame } from './panel';

// Theme
export { DZIN_TOKENS } from './theme';

// Registry
export { createRegistry, serializeRegistry } from './registry';
export type {
  PanelDefinition,
  PanelRegistry,
  SerializedPanel,
  SerializedRegistry,
} from './registry';

// Demo panels
export { DataListPanel, DetailPanel, MediaGridPanel } from './demo';
export { dataListDefinition, detailDefinition, mediaGridDefinition } from './demo';
export { MOCK_LIST_ITEMS, MOCK_DETAIL, MOCK_MEDIA_ITEMS } from './demo';
export type { DataListPanelProps, DetailPanelProps, MediaGridPanelProps } from './demo';
export type { ListItem, DetailEntity, DetailSection, MediaItem } from './demo';

// Layout engine
export {
  // Templates
  LAYOUT_TEMPLATES,
  LAYOUT_ORDER,
  getTemplate,
  // Hungarian
  hungarianSolve,
  // Scoring
  scorePanelForSlot,
  scoreTemplateForDirectives,
  // Assignment
  assignPanelsToSlots,
  // Spatial
  parseGridFractions,
  estimateSlotDimensions,
  computeSpatialBudget,
  // Density
  assignSlotDensity,
  // Viewport
  VIEWPORT_BREAKPOINTS,
  getAllowedLayouts,
  clampLayoutToViewport,
  // Resolver
  resolveLayout,
  // React integration
  useLayout,
  DzinLayout,
} from './layout';
export type {
  LayoutTemplateId,
  SlotSpec,
  LayoutTemplate,
  PanelDirective,
  SlotAssignment,
  ResolvedLayout,
  SlotDimensions,
  SpatialOption,
  SpatialBudget,
  ResolveLayoutOptions,
  UseLayoutOptions,
  UseLayoutResult,
  ContainerProps,
  SlotProps,
  DzinLayoutProps,
} from './layout';

// State engine
export {
  createStateEngine,
  createUndoStack,
  createStreamController,
  createTaggedPatch,
  captureUserChange,
  serializeSnapshot,
  useWorkspaceState,
  useUndoRedoKeyboard,
  applyLLMPatchWithConflictCheck,
  acquireUserLock,
  releaseUserLock,
  getUserLockedPaths,
} from './state';
export type {
  PatchOrigin,
  TaggedOperation,
  PatchGroup,
  PanelInstance,
  StreamingState,
  WorkspaceState,
  UndoStack,
  StateEngine,
  StateSubscriber,
  StreamController,
} from './state';

// Chat
export { createChatStore, matchCommands, useChatMessages } from './chat';
export type {
  MessageRole,
  ToolCallStatus,
  ToolCall,
  ChatMessage,
  CompositionSummary,
  SlashCommand,
  ChatStore,
} from './chat';

// Intent
export {
  createDirector,
  NEEDS_LLM,
  createIntentBus,
  createComposeHandler,
  createManipulateHandler,
  createNavigateHandler,
  createSystemHandler,
  computeResize,
  initResizeState,
  createIntentQueue,
  IntentProvider,
  useIntent,
} from './intent';
export type {
  IntentType,
  IntentSource,
  ComposePayload,
  ManipulatePayload,
  NavigatePayload,
  QueryPayload,
  SystemPayload,
  IntentPayloadMap,
  Intent,
  IntentResult,
  IntentHandler,
  IntentEvent,
  IntentBus,
  Director,
  ResizeState,
  IntentQueue,
} from './intent';

// LLM Transport
export { serializeForClaude, createLLMTransport } from './llm';
export type {
  LLMTransportStatus,
  WorkspaceSnapshot,
  SerializedContext,
  LLMResponse,
  LLMTransportConfig,
  LLMTransport,
} from './llm';
