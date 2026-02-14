'use client';

import { useState, useCallback } from 'react';
import {
  Download, FolderInput, Workflow, Clapperboard, Bell,
  ExternalLink, Check, Zap, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Types ──

export type StepType = 'manual' | 'code';

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
    id: 'step-mixamo-download',
    number: 1,
    title: 'Download Character from Mixamo',
    type: 'manual',
    icon: Download,
    description: 'Get a rigged character with basic animations from Adobe Mixamo.',
    details: [
      'Go to mixamo.com and sign in with your Adobe account.',
      'Choose a character or upload your own FBX mesh.',
      'Select these essential animations: Idle, Walk, Run, Jump Start, Falling, Landing.',
      'For each animation: set Format to "FBX Binary", Skin to "With Skin" (first only), then "Without Skin" for additional anims.',
      'Use 30 FPS and check "In Place" for locomotion animations to enable root motion control in UE5.',
      'Download each animation as a separate FBX file.',
    ],
    links: [
      { label: 'Open Mixamo', url: 'https://www.mixamo.com/' },
      { label: 'Mixamo → UE5 Guide', url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/skeletal-mesh-import' },
    ],
  },
  {
    id: 'step-ue5-import',
    number: 2,
    title: 'Import into UE5',
    type: 'manual',
    icon: FolderInput,
    description: 'Import the Mixamo FBX files into your UE5 project with correct settings.',
    details: [
      'In UE5 Content Browser, create folders: Content/Characters/Mixamo/Mesh and Content/Characters/Mixamo/Animations.',
      'Import the character FBX (with skin) first → this creates the Skeleton asset.',
      'Import settings: Skeletal Mesh = true, Import Animations = true, Skeleton = None (auto-create).',
      'For each animation FBX: Import → select the same Skeleton asset → Import Animations = true, Import Mesh = false.',
      'Verify: open each animation asset and check it plays correctly on the skeleton.',
      'Optional: right-click Skeleton → "Retarget" to use with the UE5 Mannequin if you want IK retargeting.',
    ],
    links: [
      { label: 'FBX Import Docs', url: 'https://dev.epicgames.com/documentation/en-us/unreal-engine/fbx-import-options-reference' },
    ],
  },
  {
    id: 'step-animbp',
    number: 3,
    title: 'Create AnimBP with Locomotion',
    type: 'code',
    icon: Workflow,
    description: 'Generate a C++ AnimInstance with locomotion blend space and state machine.',
    details: [
      'Creates UAnimInstance subclass with Speed, Direction, IsInAir, IsFalling variables.',
      'Locomotion blend space: Idle → Walk → Run driven by movement speed.',
      'State machine with states: Locomotion, Jump, Fall, Land.',
      'NativeUpdateAnimation() pulls values from the owning character\'s movement component.',
      'Fully C++-driven — no Blueprint graph needed.',
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
    number: 4,
    title: 'Set Up Action Montages',
    type: 'code',
    icon: Clapperboard,
    description: 'Generate montage system for attacks, dodge, hit reactions, and death.',
    details: [
      'Montage manager component for playing/stopping montages with priorities.',
      'Attack combo: 3-section montage with section advancement on input.',
      'Dodge roll montage with root motion and invulnerability window.',
      'Hit reaction montage with directional variants (front, back, left, right).',
      'Death montage with ragdoll blend-out.',
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
    number: 5,
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

const ACCENT = '#a78bfa';

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

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4" style={{ color: ACCENT }} />
          <div>
            <h3 className="text-xs font-semibold text-text">Animation Setup Checklist</h3>
            <p className="text-2xs text-text-muted">
              {completedCount}/{ANIMATION_STEPS.length} steps — Mixamo → AnimBP → Montages → Notifies
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / ANIMATION_STEPS.length) * 100}%`,
              backgroundColor: ACCENT,
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2">
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
  const typeColor = isCode ? '#a78bfa' : '#f59e0b';
  const typeLabel = isCode ? 'Code' : 'Manual';

  return (
    <div
      className="rounded-xl border transition-all duration-200"
      style={{
        borderColor: isCompleted ? '#22c55e30' : isExpanded ? `${typeColor}40` : 'var(--border)',
        backgroundColor: isCompleted ? '#22c55e06' : isExpanded ? `${typeColor}06` : 'var(--surface-deep)',
      }}
    >
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left group"
      >
        {/* Step number / check */}
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
          style={{
            backgroundColor: isCompleted ? '#22c55e20' : `${typeColor}15`,
            border: `1.5px solid ${isCompleted ? '#22c55e50' : `${typeColor}35`}`,
            color: isCompleted ? '#22c55e' : typeColor,
          }}
        >
          {isCompleted ? <Check className="w-3.5 h-3.5" /> : step.number}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-3 h-3" style={{ color: isCompleted ? '#22c55e' : typeColor }} />
            <span
              className="text-xs font-semibold"
              style={{ color: isCompleted ? '#22c55e' : 'var(--text)' }}
            >
              {step.title}
            </span>
            <span
              className="text-2xs font-bold uppercase tracking-widest px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: isCompleted ? '#22c55e12' : `${typeColor}12`,
                color: isCompleted ? '#22c55e80' : `${typeColor}cc`,
              }}
            >
              {isCompleted ? 'Done' : typeLabel}
            </span>
          </div>
          <p className="text-2xs text-text-muted mt-0.5">{step.description}</p>
        </div>

        {/* Expand indicator */}
        <div className="flex-shrink-0">
          {isExpanded
            ? <ChevronDown className="w-3.5 h-3.5 text-[#4a4e6a]" />
            : <ChevronRight className="w-3.5 h-3.5 text-[#4a4e6a]" />
          }
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Instruction list */}
          <ol className="space-y-1.5 ml-10">
            {step.details.map((detail, i) => (
              <li key={i} className="text-2xs text-[#9b9ec0] leading-relaxed flex gap-2">
                <span className="flex-shrink-0 text-[#4a4e6a] font-mono w-3 text-right">{i + 1}.</span>
                <span>{detail}</span>
              </li>
            ))}
          </ol>

          {/* Links (manual steps) */}
          {step.links && step.links.length > 0 && (
            <div className="ml-10 flex flex-wrap gap-2">
              {step.links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-1 rounded-md transition-colors"
                  style={{
                    backgroundColor: '#f59e0b10',
                    color: '#f59e0b',
                    border: '1px solid #f59e0b25',
                  }}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="ml-10 flex gap-2">
            {isCode && step.prompt && (
              <button
                onClick={(e) => { e.stopPropagation(); onGenerate(); }}
                disabled={isGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
                style={{
                  backgroundColor: `${ACCENT}15`,
                  color: ACCENT,
                  border: `1px solid ${ACCENT}30`,
                }}
              >
                <Zap className="w-3 h-3" />
                Generate Code
              </button>
            )}

            {!isCompleted && (
              <button
                onClick={(e) => { e.stopPropagation(); onMarkComplete(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-text-muted bg-surface border border-border hover:border-[#22c55e40] hover:text-[#22c55e]"
              >
                <Check className="w-3 h-3" />
                Mark Complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
