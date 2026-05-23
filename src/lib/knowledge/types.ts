/**
 * The kind of prompt being assembled. Drives which UE gotchas + tripwires
 * are injected into the shared context header.
 */
export type PromptKind = 'ue-cpp' | 'ue-python' | 'packaging' | 'web';
