/**
 * UE5 C++ Source Parser
 *
 * Parses UE5 Gameplay Ability System source files to extract:
 * - Gameplay tag declarations (names, string values, comments)
 * - Ability class properties (UPROPERTY defaults: BaseDamage, AoERadius, etc.)
 * - Constructor-set values (ManaCost, CooldownTag, blocking tags)
 *
 * Runs server-side only (requires fs access).
 */

import fs from 'fs/promises';
import path from 'path';

/* ── Types ──────────────────────────────────────────────────────────────── */

export interface ParsedTag {
  /** C++ identifier, e.g. "Ability_Melee_LightAttack" */
  cppName: string;
  /** Tag string, e.g. "Ability.Melee.LightAttack" */
  tagString: string;
  /** Comment from UE_DEFINE_GAMEPLAY_TAG_COMMENT */
  comment: string;
  /** Top-level category, e.g. "Ability" */
  category: string;
}

export interface ParsedAbility {
  className: string;
  displayName: string;
  description: string;
  sourceFile: string;

  /* From UPROPERTY defaults in .h */
  baseDamage: number | null;
  aoERadius: number | null;
  explosionRadius: number | null;
  dashDistance: number | null;
  sweepRadius: number | null;
  staminaCost: number | null;
  hitRadius: number | null;

  /* From constructor in .cpp */
  manaCost: number;
  cooldownTag: string | null;
  abilityTag: string | null;
  activationOwnedTags: string[];
  activationBlockedTags: string[];

  isPlayerAbility: boolean;
}

export interface ParsedUE5Data {
  tags: ParsedTag[];
  abilities: ParsedAbility[];
  sourceDir: string;
  parsedAt: string;
}

/* ── Tag Parsing ────────────────────────────────────────────────────────── */

function parseTags(cppContent: string): ParsedTag[] {
  const TAG_DEFINE_RE =
    /UE_DEFINE_GAMEPLAY_TAG_COMMENT\(\s*(\w+)\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"\s*\)/g;
  const tags: ParsedTag[] = [];
  let match: RegExpExecArray | null;

  while ((match = TAG_DEFINE_RE.exec(cppContent)) !== null) {
    const tagString = match[2];
    const category = tagString.split('.')[0];
    tags.push({
      cppName: match[1],
      tagString,
      comment: match[3],
      category,
    });
  }

  return tags;
}

/* ── Ability Header Parsing ─────────────────────────────────────────────── */

/** Extract float UPROPERTY default values from a .h file */
function parseHeaderDefaults(headerContent: string): Record<string, number> {
  const defaults: Record<string, number> = {};

  // Match patterns like: float BaseDamage = 35.f;
  const propRe = /(?:float|int32)\s+(\w+)\s*=\s*([\d.]+)f?\s*;/g;
  let m: RegExpExecArray | null;
  while ((m = propRe.exec(headerContent)) !== null) {
    defaults[m[1]] = parseFloat(m[2]);
  }

  return defaults;
}

/** Extract the class doc comment (/** ... *​/) before the UCLASS() */
function parseClassDescription(headerContent: string): string {
  const docRe = /\/\*\*\s*\n([\s\S]*?)\*\/\s*\nUCLASS/;
  const m = docRe.exec(headerContent);
  if (!m) return '';

  return m[1]
    .split('\n')
    .map((line) => line.replace(/^\s*\*\s?/, '').trim())
    .filter(Boolean)
    .slice(0, 2) // First 2 lines of doc comment
    .join(' ');
}

/** Extract class name from header */
function parseClassName(headerContent: string): string | null {
  const m = headerContent.match(/class\s+\w+\s+(U\w+)\s*:/);
  return m ? m[1] : null;
}

/* ── Constructor Parsing ────────────────────────────────────────────────── */

interface ConstructorData {
  manaCost: number;
  cooldownTag: string | null;
  abilityTag: string | null;
  activationOwnedTags: string[];
  activationBlockedTags: string[];
}

/** Map C++ tag references to their string forms (lookup from parsed tags) */
function resolveTagRef(ref: string, tagMap: Map<string, string>): string | null {
  // ref is like "ARPGGameplayTags::Cooldown_Fireball"
  const parts = ref.split('::');
  const cppName = parts[parts.length - 1];
  return tagMap.get(cppName) ?? null;
}

function parseConstructor(cppContent: string, tagMap: Map<string, string>): ConstructorData {
  const data: ConstructorData = {
    manaCost: 0,
    cooldownTag: null,
    abilityTag: null,
    activationOwnedTags: [],
    activationBlockedTags: [],
  };

  // AbilityManaCost = 20.f;
  const manaCostMatch = cppContent.match(/AbilityManaCost\s*=\s*([\d.]+)f?\s*;/);
  if (manaCostMatch) {
    data.manaCost = parseFloat(manaCostMatch[1]);
  }

  // AbilityCooldownTag = ARPGGameplayTags::Cooldown_Fireball;
  const cdTagMatch = cppContent.match(/AbilityCooldownTag\s*=\s*([\w:]+)\s*;/);
  if (cdTagMatch) {
    data.cooldownTag = resolveTagRef(cdTagMatch[1], tagMap);
  }

  // SetAssetTags(FGameplayTagContainer(ARPGGameplayTags::Ability_Fireball));
  const assetTagMatch = cppContent.match(/SetAssetTags\(\s*FGameplayTagContainer\(\s*([\w:]+)\s*\)\s*\)/);
  if (assetTagMatch) {
    data.abilityTag = resolveTagRef(assetTagMatch[1], tagMap);
  }

  // ActivationOwnedTags.AddTag(ARPGGameplayTags::State_Attacking);
  const ownedRe = /ActivationOwnedTags\.AddTag\(\s*([\w:]+)\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = ownedRe.exec(cppContent)) !== null) {
    const tag = resolveTagRef(m[1], tagMap);
    if (tag) data.activationOwnedTags.push(tag);
  }

  // ActivationBlockedTags.AddTag(ARPGGameplayTags::State_Attacking);
  const blockedRe = /ActivationBlockedTags\.AddTag\(\s*([\w:]+)\s*\)/g;
  while ((m = blockedRe.exec(cppContent)) !== null) {
    const tag = resolveTagRef(m[1], tagMap);
    if (tag) data.activationBlockedTags.push(tag);
  }

  // Event trigger (for death ability)
  const triggerMatch = cppContent.match(/TriggerData\.TriggerTag\s*=\s*([\w:]+)\s*;/);
  if (triggerMatch && !data.abilityTag) {
    data.abilityTag = resolveTagRef(triggerMatch[1], tagMap);
  }

  return data;
}

/* ── Ability Name Derivation ────────────────────────────────────────────── */

function deriveDisplayName(className: string): string {
  // UGA_Fireball -> Fireball, UGA_EnemyMeleeAttack -> Enemy Melee Attack
  let name = className.replace(/^UGA_/, '');
  // Insert spaces before capital letters (but not at start)
  name = name.replace(/([a-z])([A-Z])/g, '$1 $2');
  return name;
}

/* ── Main Parser ────────────────────────────────────────────────────────── */

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

export async function parseUE5AbilitySystem(projectPath: string): Promise<ParsedUE5Data> {
  // Derive the module name from the .uproject file
  let moduleName = 'PoF';
  try {
    const entries = await fs.readdir(projectPath);
    const uproject = entries.find((e) => e.endsWith('.uproject'));
    if (uproject) {
      moduleName = uproject.replace('.uproject', '');
    }
  } catch {
    // Use default
  }

  const sourceDir = path.join(projectPath, 'Source', moduleName, 'AbilitySystem');

  // 1. Parse tags from the .cpp file
  const tagsCppPath = path.join(sourceDir, 'ARPGGameplayTags.cpp');
  const tagsCppContent = await readFileIfExists(tagsCppPath);
  const tags = tagsCppContent ? parseTags(tagsCppContent) : [];

  // Build a lookup map: C++ name -> tag string
  const tagMap = new Map<string, string>();
  for (const tag of tags) {
    tagMap.set(tag.cppName, tag.tagString);
  }

  // 2. Find all GA_*.h files
  const abilities: ParsedAbility[] = [];

  let dirEntries: string[] = [];
  try {
    dirEntries = await fs.readdir(sourceDir);
  } catch {
    // AbilitySystem directory doesn't exist
  }

  const gaHeaders = dirEntries.filter(
    (f) => f.startsWith('GA_') && f.endsWith('.h')
  );

  for (const headerFile of gaHeaders) {
    const headerPath = path.join(sourceDir, headerFile);
    const cppFile = headerFile.replace('.h', '.cpp');
    const cppPath = path.join(sourceDir, cppFile);

    const headerContent = await readFileIfExists(headerPath);
    if (!headerContent) continue;

    const cppContent = await readFileIfExists(cppPath);

    const className = parseClassName(headerContent);
    if (!className) continue;

    const headerDefaults = parseHeaderDefaults(headerContent);
    const description = parseClassDescription(headerContent);
    const constructorData = cppContent
      ? parseConstructor(cppContent, tagMap)
      : { manaCost: 0, cooldownTag: null, abilityTag: null, activationOwnedTags: [], activationBlockedTags: [] };

    const isEnemy = headerFile.startsWith('GA_Enemy');

    abilities.push({
      className,
      displayName: deriveDisplayName(className),
      description,
      sourceFile: headerFile,
      baseDamage: headerDefaults.BaseDamage ?? null,
      aoERadius: headerDefaults.AoERadius ?? null,
      explosionRadius: headerDefaults.ExplosionRadius ?? null,
      dashDistance: headerDefaults.DashDistance ?? null,
      sweepRadius: headerDefaults.SweepRadius ?? null,
      staminaCost: headerDefaults.StaminaCost ?? null,
      hitRadius: headerDefaults.HitRadius ?? null,
      manaCost: constructorData.manaCost,
      cooldownTag: constructorData.cooldownTag,
      abilityTag: constructorData.abilityTag,
      activationOwnedTags: constructorData.activationOwnedTags,
      activationBlockedTags: constructorData.activationBlockedTags,
      isPlayerAbility: !isEnemy,
    });
  }

  return {
    tags,
    abilities,
    sourceDir,
    parsedAt: new Date().toISOString(),
  };
}
