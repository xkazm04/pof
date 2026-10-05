/**
 * UE5 class-name extraction — pulls class identifiers out of CLI response
 * text. Used by `pattern-extractor.ts` to tag mined patterns with the
 * classes they touch.
 */

// ── Class name extraction ────────────────────────────────────────────────────

const UE_CLASS_REGEX = /\b([AUF][A-Z][A-Za-z0-9]+(?:Component|Controller|Character|Base|Instance|System|Subsystem|Widget|Effect|Ability|Set|Asset|Manager|Volume)?)\b/g;

export function extractClasses(text: string): string[] {
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  UE_CLASS_REGEX.lastIndex = 0;
  while ((match = UE_CLASS_REGEX.exec(text)) !== null) {
    // Filter out common false positives
    const name = match[1];
    if (name.length >= 4 && !['ANSI', 'ASCII', 'ATTR', 'AUTO', 'UPROPERTY', 'UFUNCTION', 'UCLASS', 'USTRUCT', 'UENUM', 'UMETA', 'FORCEINLINE'].includes(name)) {
      matches.add(name);
    }
  }
  return [...matches].slice(0, 15);
}
