import {
  Download, FolderInput, Workflow, Clapperboard, Bell, Terminal,
} from 'lucide-react';
import { ACCENT_VIOLET } from '@/lib/chart-colors';
import type { ChecklistStep } from './types';

export const ACCENT = ACCENT_VIOLET;

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
