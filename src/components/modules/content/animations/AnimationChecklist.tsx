'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download, FolderInput, Workflow, Clapperboard, Bell, Terminal,
  ExternalLink, Check, Zap, ChevronDown, ChevronRight, ArrowRight
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Types ──

export type StepType = 'manual' | 'code' | 'auto';

export interface ChecklistStep {
  id: string;
  number: number;
  title: string;
  type: StepType;
  icon: LucideIcon;
  description: string;
  /** Detailed instructions shown when expanded */
  details: string[];
  /** External links for manual steps */
  links?: { label: string; url: string }[];
  /** CLI prompt for code-generation steps */
  prompt?: string;
}

export const ANIMATION_STEPS: ChecklistStep[] = [
  {
    id: 'step-commandlet-assets',
    number: 1,
    title: 'Run Asset Automation Commandlet',
    type: 'auto',
    icon: Terminal,
    description: 'Headless creation of blend spaces + montage shells via UAnimAssetCommandlet (verified UE 5.7.3, ~0.06s for 8 assets).',
    details: [
      'Run: UnrealEditor-Cmd.exe PoF.uproject -run=AnimAsset -nopause -unattended -nosplash',
      'Creates BS1D_Locomotion (1D Blend Space, Speed axis 0-600, GridNum=2) at /Game/Characters/Player/Animations/.',
      'Creates AM_MeleeCombo (3 sections: Attack1→Attack2→Attack3 linked via NextSectionName) in Montages/ subfolder.',
      'Creates AM_Dodge_Forward, AM_Dodge_Backward, AM_Dodge_Left, AM_Dodge_Right (each with single Dodge section).',
      'Creates AM_HitReact and AM_Death montage shells.',
      'All 8 .uasset files are valid and openable in the editor. Skeleton + AnimSequences must be assigned in-editor afterward.',
      'Technical: BlendSpace uses FProperty reflection on protected BlendParameters. Montages use NewObject<UAnimMontage> + CompositeSections. SavePackage returns bool in UE 5.7 (not FSavePackageResultStruct).',
    ],
    prompt: `Create a UAnimAssetCommandlet in a PoFEditor module for headless animation asset creation.

## VERIFIED APPROACH (UE 5.7.3)

### Module Setup
- Separate PoFEditor module (Type: Editor in .uproject, added to EditorTarget.cs)
- Build.cs depends on: Core, CoreUObject, Engine, UnrealEd, PoF (runtime module), AssetTools, ContentBrowser, Niagara

### BlendSpace Creation (KEY FINDING)
- UBlendSpace1D::GetBlendParameter() returns CONST — cannot set axis via getter
- BlendParameters[3] is a protected UPROPERTY(EditAnywhere)
- SOLUTION: Use FProperty reflection:
  \`\`\`cpp
  FProperty* Prop = UBlendSpace::StaticClass()->FindPropertyByName("BlendParameters");
  FBlendParameter* Params = Prop->ContainerPtrToValuePtr<FBlendParameter>(BlendSpace);
  Params[0].DisplayName = TEXT("Speed");
  Params[0].Min = 0.f; Params[0].Max = 600.f; Params[0].GridNum = 2;
  \`\`\`

### Montage Creation
- NewObject<UAnimMontage>(Package, ..., RF_Public | RF_Standalone)
- SlotAnimTracks[0].SlotName = FName("DefaultSlot")
- CompositeSections: first section renamed from default, subsequent added via FCompositeSection with SetTime()
- Link combo: CompositeSections[i].NextSectionName = Sections[i+1]

### Saving (KEY FINDING)
- UPackage::SavePackage(Package, Asset, *FilePath, SaveArgs) returns BOOL in UE 5.7
- Do NOT use FSavePackageResultStruct — that's the Save() method, not SavePackage()
- Must create directory tree first via IPlatformFile::CreateDirectoryTree

### Assets Created
1. BS1D_Locomotion — /Game/Characters/Player/Animations/
2. AM_MeleeCombo (Attack1/2/3) — /Game/Characters/Player/Animations/Montages/
3. AM_Dodge_Forward, _Backward, _Left, _Right — same folder
4. AM_HitReact, AM_Death — same folder`,
  },
  {
    id: 'step-mixamo-download',
    number: 2,
    title: 'Download Character from Mixamo',
    type: 'manual',
    icon: Download,
    description: 'Get a rigged character with basic animations from Adobe Mixamo.',
    details: [
      'Go to mixamo.com and sign in with your Adobe account.',
      'Choose a character or upload your own FBX mesh.',
      'Select these essential animations: Idle, Walk, Run, Jump Start, Falling, Landing.',
      'For combat: 3-hit sword combo, dodge roll, hit reaction, death animation.',
      'First download (character mesh): Format "FBX Binary", Skin "With Skin" — this creates the Skeleton asset in UE5.',
      'All subsequent animation downloads: Skin "Without Skin" to reuse the same skeleton and reduce file size.',
      'Check "In Place" for ALL locomotion animations (Idle, Walk, Run) — root motion is controlled in UE5 via CharacterMovementComponent.',
      'For attack/dodge anims: leave "In Place" unchecked if they have meaningful root translation you want to preserve.',
      'Use 30 FPS. Download each animation as a separate FBX file.',
      'Note: Mixamo uses "mixamorig:" bone prefix (e.g., mixamorig:Hips) — this is handled during UE5 import.',
      'Advanced: For bulk downloads, tools like MixamoHarvester (Python, multithreaded) can batch-download all animations. These are unofficial and may hit rate limits (HTTP 429).',
    ],
    links: [
      { label: 'Open Mixamo', url: 'https://www.mixamo.com/' },
      { label: 'Mixamo → UE5 Guide', url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/skeletal-mesh-import' },
    ],
  },
  {
    id: 'step-ue5-import',
    number: 3,
    title: 'Import into UE5 & Assign to Generated Assets',
    type: 'manual',
    icon: FolderInput,
    description: 'Import Mixamo FBX with bone prefix handling, optionally retarget, then assign to commandlet-generated assets.',
    details: [
      'Import the character FBX (with skin) first → this creates the Skeleton asset.',
      'IMPORTANT: Strip the "mixamorig:" bone prefix on import. In FBX Import Options, the prefix is auto-stripped by UE5 when importing Mixamo FBX — verify bone names show as "Hips", "Spine", etc. (not "mixamorig:Hips").',
      'Import each animation FBX using the same Skeleton asset (Import Animations = true, Import Mesh = false).',
      'If retargeting to a different skeleton: use IK Retargeter with Python API — auto_map_chains(FUZZY) handles Mixamo naming. Batch retarget via IKRetargetBatchOperation.duplicate_and_retarget().',
      'For in-place Mixamo locomotion: root motion is driven by CharacterMovementComponent. For attacks/dodges with root translation: use RootMotionGeneratorOp to extract root motion from hip bone.',
      'Open BS1D_Locomotion (generated by commandlet): assign Idle at 0, Walk at 200, Run at 600.',
      'Open AM_MeleeCombo: set the Skeleton, add attack AnimSequences to each of the 3 sections.',
      'Open AM_Dodge_* montages: set Skeleton, add dodge AnimSequences. Enable root motion if animations have it.',
      'Open AM_HitReact and AM_Death: set Skeleton, add corresponding AnimSequences.',
      'Add Anim Notifies to montage timelines (ComboWindow, HitDetection, SpawnVFX, PlaySound) — this requires the editor.',
    ],
    links: [
      { label: 'FBX Import Docs', url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/fbx-import-options-reference' },
      { label: 'IK Retargeter Python API', url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/using-python-to-create-and-edit-ik-retargeter-assets-in-unreal-engine' },
    ],
  },
  {
    id: 'step-animbp',
    number: 4,
    title: 'Create AnimBP with Locomotion (Editor Only)',
    type: 'code',
    icon: Workflow,
    description: 'C++ AnimInstance is automatable, but the AnimBP state machine graph requires the editor.',
    details: [
      'C++ UARPGAnimInstance already exists with Speed, Direction, IsInAir, bIsDodging, bIsAttacking, etc.',
      'Blend space asset (BS1D_Locomotion) already created by commandlet — just needs sample anims assigned.',
      'AnimBP state machine CANNOT be created programmatically in UE 5.7 — it requires the editor AnimGraph.',
      'Create AnimBP in editor: right-click Skeleton > Create > Anim Blueprint, parent to UARPGAnimInstance.',
      'Wire states: Locomotion (BS1D), Attacking, Dodging, HitReact, Death. Transitions use C++ variables.',
      'This is the ONE step that truly requires manual editor work for animation setup.',
    ],
    prompt: `Create a complete C++ Animation Blueprint system:

1. **UMyAnimInstance** (UAnimInstance subclass)
   - UPROPERTY variables: Speed (float), Direction (float), IsInAir (bool), IsFalling (bool), IsAccelerating (bool)
   - Override NativeInitializeAnimation() to cache the owning ACharacter and UCharacterMovementComponent
   - Override NativeUpdateAnimation(float DeltaSeconds) to update all variables from the movement component
   - Speed = lateral velocity magnitude, Direction = CalculateDirection(), IsInAir = IsFalling()

2. **Blend Space 1D setup instructions**
   - Create a 1D Blend Space asset for Idle/Walk/Run blend driven by Speed
   - Axis: Speed (0 = Idle, 150 = Walk, 375 = Run)
   - Document how to assign the Mixamo animations to each point

3. **State Machine configuration**
   - States: Locomotion (uses blend space), JumpStart, Falling, Landing
   - Transition rules:
     - Locomotion → JumpStart: IsInAir && !IsFalling
     - JumpStart → Falling: GetRelevantAnimTimeRemaining < 0.1
     - Falling → Landing: !IsInAir
     - Landing → Locomotion: GetRelevantAnimTimeRemaining < 0.2
   - Document how to wire this in the AnimGraph

4. **Character setup helper**
   - Static function to configure a character to use this AnimBP
   - Set SkeletalMeshComponent animation mode and AnimBP class`,
  },
  {
    id: 'step-montages',
    number: 5,
    title: 'Set Up Action Montages',
    type: 'code',
    icon: Clapperboard,
    description: 'Montage shells created by commandlet. This step adds the C++ montage manager and combo logic.',
    details: [
      'Montage .uasset shells already created by Step 1 commandlet (AM_MeleeCombo, AM_Dodge_*, AM_HitReact, AM_Death).',
      'This step generates the C++ montage manager component for playing/stopping with priorities.',
      'Attack combo: section advancement via Montage_JumpToSection during combo window.',
      'Dodge: directional montage selection already in AARPGCharacterBase::GetDodgeMontage().',
      'Hit reaction + death: montage references assigned via UPROPERTY in character class.',
    ],
    prompt: `Create a complete UE5 C++ montage system for combat animations:

1. **UMontageManagerComponent** (UActorComponent)
   - PlayMontage(UAnimMontage*, float Rate, FName Section) with priority system
   - StopMontage(float BlendOut)
   - IsPlayingMontage() / GetCurrentMontage()
   - OnMontageEnded and OnMontageBlendingOut delegates
   - UPROPERTY for all montage asset references (TSoftObjectPtr for async load)

2. **Attack Combo System**
   - UAnimMontage with 3 named sections: "Attack1", "Attack2", "Attack3"
   - AdvanceCombo() — jumps to next section if in combo window
   - ResetCombo() — resets on timeout or montage end
   - Combo count tracking with ComboWindowOpen/ComboWindowClose notify integration
   - UPROPERTY float ComboWindowDuration = 0.4

3. **Dodge Montage**
   - PlayDodge(FVector Direction) — picks forward/back/left/right variant
   - Root motion enabled for the dodge distance
   - InvulnerabilityStart/End via anim notifies (sets gameplay tag State.Invulnerable)

4. **Hit Reaction System**
   - PlayHitReact(FVector HitDirection) — calculates front/back/left/right
   - Uses DotProduct with character forward to determine direction
   - Short montages that blend back to locomotion

5. **Death Montage**
   - PlayDeath() — plays death anim then triggers ragdoll blend
   - DisableInput on play, enable ragdoll physics after montage
   - OnDeathComplete delegate for cleanup logic`,
  },
  {
    id: 'step-notifies',
    number: 6,
    title: 'Add Animation Notifies',
    type: 'code',
    icon: Bell,
    description: 'Generate custom anim notify classes for gameplay events during animations.',
    details: [
      'ComboWindow notify state: opens/closes the combo input window.',
      'HitDetection notify state: enables weapon trace during attack frames.',
      'FootStep notify: plays footstep sound + VFX at socket location.',
      'SpawnVFX notify: spawns a Niagara particle at a bone socket.',
      'PlaySound notify: plays a sound cue at the character location.',
    ],
    prompt: `Create complete UE5 C++ Anim Notify classes:

1. **UAnimNotifyState_ComboWindow** (UAnimNotifyState)
   - NotifyBegin: Set "State.ComboWindow" gameplay tag on owning actor
   - NotifyEnd: Remove "State.ComboWindow" tag
   - Used in attack montage sections to define input windows
   - UPROPERTY bool bResetComboOnEnd = true

2. **UAnimNotifyState_HitDetection** (UAnimNotifyState)
   - NotifyBegin: Start weapon trace (call StartTrace on weapon component)
   - NotifyTick: Perform sphere/line trace each frame, collect hits in TSet to avoid duplicates
   - NotifyEnd: Stop trace, clear hit set
   - UPROPERTY FName TraceSocketStart = "weapon_start", TraceSocketEnd = "weapon_end"
   - UPROPERTY float TraceRadius = 20.0

3. **UAnimNotify_FootStep** (UAnimNotify)
   - Notify: Get socket location ("foot_l" or "foot_r" based on UPROPERTY)
   - Line trace downward to detect surface physical material
   - Play appropriate sound from surface-to-sound map
   - Spawn dust/splash Niagara VFX based on surface type
   - UPROPERTY EFootSide (Left, Right)
   - UPROPERTY TMap<TEnumAsByte<EPhysicalSurface>, USoundBase*> SurfaceSounds

4. **UAnimNotify_SpawnVFX** (UAnimNotify)
   - Notify: Spawn UNiagaraSystem at specified bone socket
   - UPROPERTY TSoftObjectPtr<UNiagaraSystem> VFXAsset
   - UPROPERTY FName SocketName
   - UPROPERTY FVector LocationOffset, FRotator RotationOffset
   - UPROPERTY bool bAttachToSocket = true

5. **UAnimNotify_PlaySound** (UAnimNotify)
   - Notify: Play sound at character location using UGameplayStatics::SpawnSoundAtLocation
   - UPROPERTY TSoftObjectPtr<USoundBase> Sound
   - UPROPERTY float VolumeMultiplier = 1.0, PitchMultiplier = 1.0
   - UPROPERTY bool bAttachToActor = false`,
  },
];

// ── Component ──

import {
  ACCENT_VIOLET, ACCENT_CYAN, STATUS_SUCCESS, MODULE_COLORS,
  OPACITY_10, OPACITY_12, OPACITY_15, OPACITY_20, OPACITY_30,
} from '@/lib/chart-colors';

const ACCENT = ACCENT_VIOLET;

interface AnimationChecklistProps {
  onGenerate: (step: ChecklistStep) => void;
  isGenerating: boolean;
  completedSteps: Set<string>;
  onMarkComplete: (stepId: string) => void;
}

export function AnimationChecklist({ onGenerate, isGenerating, completedSteps, onMarkComplete }: AnimationChecklistProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const completedCount = ANIMATION_STEPS.filter((s) => completedSteps.has(s.id)).length;
  const progressPercent = (completedCount / ANIMATION_STEPS.length) * 100;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-[#03030a] rounded-2xl border border-violet-900/30 relative overflow-hidden shadow-[inset_0_0_80px_rgba(167,139,250,0.05)]">
      {/* Background Effects */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: `linear-gradient(${ACCENT} 1px, transparent 1px), linear-gradient(90deg, ${ACCENT} 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10 mb-8 pb-4 border-b border-violet-900/40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl grid place-items-center bg-violet-950/50 border border-violet-800/50 shadow-[0_0_15px_rgba(167,139,250,0.15)] overflow-hidden relative">
            <Workflow className="w-5 h-5 text-violet-400 relative z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-violet-500/20 to-transparent" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-violet-100 font-mono tracking-widest uppercase flex items-center gap-2" style={{ textShadow: '0 0 8px rgba(167,139,250,0.4)' }}>
              INTEGRATION_CHECKLIST.sys
            </h3>
            <p className="text-[10px] text-violet-400/80 font-mono uppercase tracking-widest mt-0.5">
              Commandlet → Mixamo → AnimBP → Montages → Notifies
            </p>
          </div>
        </div>

        {/* Progress Display */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-[10px] font-mono font-bold text-violet-300 tracking-widest uppercase">
            Progress <span className="text-violet-100">{completedCount}/{ANIMATION_STEPS.length}</span>
          </div>
          <div className="w-32 h-2 rounded-full bg-[#0a0a1e] border border-violet-900/40 overflow-hidden relative shadow-inner">
            <motion.div
              className="absolute top-0 left-0 bottom-0 rounded-full"
              style={{
                backgroundColor: ACCENT,
                boxShadow: `0 0 10px ${ACCENT}, inset 0 0 5px rgba(255,255,255,0.5)`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 relative z-10">
        {ANIMATION_STEPS.map((step) => {
          const isCompleted = completedSteps.has(step.id);
          const isExpanded = expandedId === step.id;

          return (
            <StepCard
              key={step.id}
              step={step}
              isCompleted={isCompleted}
              isExpanded={isExpanded}
              isGenerating={isGenerating}
              onToggle={() => toggleExpand(step.id)}
              onGenerate={() => onGenerate(step)}
              onMarkComplete={() => onMarkComplete(step.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Step Card ──

interface StepCardProps {
  step: ChecklistStep;
  isCompleted: boolean;
  isExpanded: boolean;
  isGenerating: boolean;
  onToggle: () => void;
  onGenerate: () => void;
  onMarkComplete: () => void;
}

function StepCard({ step, isCompleted, isExpanded, isGenerating, onToggle, onGenerate, onMarkComplete }: StepCardProps) {
  const Icon = step.icon;
  const isCode = step.type === 'code';
  const isAuto = step.type === 'auto';
  const typeColor = isAuto ? ACCENT_CYAN : isCode ? ACCENT_VIOLET : MODULE_COLORS.content;
  const typeLabel = isAuto ? 'Auto' : isCode ? 'Code' : 'Manual';

  return (
    <motion.div
      layout
      initial={{ borderRadius: 16 }}
      animate={{
        borderColor: isCompleted ? `${STATUS_SUCCESS}50` : isExpanded ? `${typeColor}80` : `${typeColor}20`,
        backgroundColor: isCompleted ? `${STATUS_SUCCESS}0A` : isExpanded ? `${typeColor}0A` : 'var(--surface-deep)',
        boxShadow: isExpanded ? `0 0 20px ${typeColor}20, inset 0 0 10px ${typeColor}10` : 'none',
      }}
      className="border relative overflow-hidden group/card"
    >
      {/* Background glow for expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 right-0 w-64 h-full pointer-events-none"
            style={{ background: `linear-gradient(to left, ${typeColor}10, transparent)` }}
          />
        )}
      </AnimatePresence>

      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left relative z-10"
      >
        {/* Step Indicator */}
        <div
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold font-mono transition-all duration-300 relative group-hover/card:scale-105"
          style={{
            backgroundColor: isCompleted ? `${STATUS_SUCCESS}20` : `${typeColor}20`,
            border: `1px solid ${isCompleted ? STATUS_SUCCESS : typeColor}`,
            boxShadow: `0 0 15px ${isCompleted ? STATUS_SUCCESS : typeColor}40, inset 0 0 10px ${isCompleted ? STATUS_SUCCESS : typeColor}20`,
            color: isCompleted ? STATUS_SUCCESS : typeColor,
          }}
        >
          {isCompleted ? <Check className="w-5 h-5 drop-shadow-[0_0_8px_currentColor]" /> : step.number}

          {/* Glow Pulse */}
          {!isCompleted && isExpanded && (
            <div className="absolute inset-0 rounded-xl animate-ping opacity-30" style={{ border: `2px solid ${typeColor}` }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <span
              className="text-sm font-bold tracking-wide font-mono"
              style={{
                color: isCompleted ? STATUS_SUCCESS : isExpanded ? typeColor : '#e2e8f0',
                textShadow: isCompleted || isExpanded ? `0 0 10px ${isCompleted ? STATUS_SUCCESS : typeColor}80` : 'none'
              }}
            >
              {step.title}
            </span>
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border"
              style={{
                backgroundColor: isCompleted ? `${STATUS_SUCCESS}15` : `${typeColor}15`,
                color: isCompleted ? STATUS_SUCCESS : typeColor,
                borderColor: isCompleted ? `${STATUS_SUCCESS}40` : `${typeColor}40`,
              }}
            >
              {isCompleted ? 'OK' : typeLabel}
            </span>
          </div>
          <p className="text-[11px] text-text-muted font-mono leading-relaxed opacity-80 max-w-2xl truncate">{step.description}</p>
        </div>

        {/* Expand indicator */}
        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="flex-shrink-0 ml-4 p-2 rounded-lg bg-surface/50 border border-border group-hover/card:border-violet-500/50 transition-colors">
          <ChevronDown className="w-4 h-4 text-text-muted group-hover/card:text-violet-400" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="overflow-hidden relative z-10"
          >
            <div className="px-5 pb-5 pl-[72px] space-y-4">
              {/* Instructions */}
              <div className="p-4 bg-black/40 border border-violet-900/40 rounded-xl shadow-inner backdrop-blur-sm">
                <ol className="space-y-2">
                  {step.details.map((detail, i) => (
                    <li key={i} className="text-[11px] text-violet-200/80 leading-relaxed flex gap-3 font-mono">
                      <span className="flex-shrink-0 text-violet-500/70 font-bold">{String(i + 1).padStart(2, '0')}.</span>
                      <span>{detail}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Links */}
              {step.links && step.links.length > 0 && (
                <div className="flex flex-wrap gap-3 mt-4">
                  {step.links.map((link) => (
                    <a
                      key={link.url}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5"
                      style={{
                        backgroundColor: `${MODULE_COLORS.content}15`,
                        color: MODULE_COLORS.content,
                        border: `1px solid ${MODULE_COLORS.content}40`,
                        boxShadow: `0 4px 10px ${MODULE_COLORS.content}15`,
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {link.label}
                    </a>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 mt-5 pt-3 border-t border-violet-900/30">
                {(isCode || isAuto) && step.prompt && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                    style={{
                      backgroundColor: `${ACCENT}20`,
                      color: ACCENT_CYAN,
                      border: `1px solid ${ACCENT}`,
                      boxShadow: `0 0 20px ${ACCENT}40, inset 0 0 10px ${ACCENT}20`,
                    }}
                  >
                    <Zap className="w-4 h-4 text-cyan-400" />
                    Execute Process <ArrowRight className="w-3.5 h-3.5 opacity-70" />
                  </button>
                )}

                {!isCompleted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onMarkComplete(); }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all text-text-muted bg-surface/80 border border-border hover:border-green-500/50 hover:text-green-400 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                  >
                    <Check className="w-4 h-4" />
                    Verify Complete
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

