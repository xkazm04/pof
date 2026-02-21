# PillarsOfFortuneBridge -- UE5 Editor Plugin Design Document

**Status:** Design (not yet implemented)
**Target Engine:** Unreal Engine 5.4+
**Authors:** PoF Team
**Last Updated:** 2026-02-21

---

## Table of Contents

1. [Overview](#1-overview)
2. [Plugin Architecture](#2-plugin-architecture)
3. [Asset Manifest System](#3-asset-manifest-system)
4. [Blueprint-C++ Mapping](#4-blueprint-c-mapping)
5. [Automated Test Runner](#5-automated-test-runner)
6. [Visual Snapshot System](#6-visual-snapshot-system)
7. [Live Coding Integration](#7-live-coding-integration)
8. [Communication Protocol](#8-communication-protocol)
9. [Implementation Phases](#9-implementation-phases)
10. [Technical Considerations](#10-technical-considerations)

---

## 1. Overview

### Purpose

PillarsOfFortuneBridge is a custom UE5 C++ Editor plugin that provides deep bidirectional integration between the Pillars of Fortune (PoF) web application and the Unreal Editor. It enables the web app to inspect, query, test, and capture visual state from a live UE5 Editor session without manual export steps.

### What This Enables Beyond the Remote Control API (Direction 1)

The existing UE5 Remote Control API plugin (Direction 1) provides basic property read/write and function invocation on spawned actors at runtime. PillarsOfFortuneBridge (Direction 2) goes substantially further:

| Capability | Direction 1 (Remote Control API) | Direction 2 (PillarsOfFortuneBridge) |
|---|---|---|
| Read/write actor properties at runtime | Yes | Yes |
| Invoke Blueprint functions on live actors | Yes | Yes |
| Full asset inventory of Content/ | No | **Yes** -- asset manifest with cross-references |
| Blueprint class introspection (parent class, variables, components, overridden functions) | No | **Yes** -- deep Blueprint-to-C++ mapping |
| Automated functional test execution in PIE | No | **Yes** -- JSON-defined test specs |
| Viewport screenshot capture + baseline diff | No | **Yes** -- visual snapshot system |
| Live Coding hot reload trigger + structured error capture | No | **Yes** -- compile integration |
| Feature Matrix verification against actual Editor state | Limited (runtime only) | **Yes** -- asset manifest cross-referenced with PoF checklists |
| File-based exchange for offline consumption | No | **Yes** -- `.pof/` shared directory |

### Migration Path from Direction 1 to Direction 2

Direction 1 and Direction 2 are complementary, not mutually exclusive. The migration path:

1. **Phase 0 (current):** PoF web app communicates with UE5 via Remote Control API (port 30010) for runtime actor manipulation. This continues to work for PIE-time interactions.

2. **Phase 1 (plugin install):** Install PillarsOfFortuneBridge plugin. The plugin runs its own HTTP server on port 30040, separate from Remote Control. PoF detects the bridge via `GET /pof/status` and unlocks deeper features in the UI.

3. **Phase 2 (dual operation):** PoF uses Remote Control for runtime actor queries during PIE sessions and PillarsOfFortuneBridge for Editor-time asset inspection, Blueprint mapping, snapshot capture, and test orchestration. Both coexist.

4. **Phase 3 (optional consolidation):** For advanced test execution, PillarsOfFortuneBridge subsumes the Remote Control interactions by starting PIE sessions itself and routing actor queries through its own test runner. Remote Control becomes optional.

No breaking changes are required at any phase. Direction 2 is a strict superset.

---

## 2. Plugin Architecture

### Module Structure

The plugin consists of two UE5 modules:

```
PillarsOfFortuneBridge/
  PillarsOfFortuneBridge.uplugin
  Source/
    PillarsOfFortuneBridge/          <-- Runtime module
      Public/
        PillarsOfFortuneBridge.h
        PofBridgeSettings.h
        PofAssetManifest.h
        PofTestRunner.h
        PofSnapshotCapture.h
      Private/
        PillarsOfFortuneBridge.cpp
        PofBridgeSettings.cpp
        PofAssetManifest.cpp
        PofTestRunner.cpp
        PofSnapshotCapture.cpp
      PillarsOfFortuneBridge.Build.cs
    PillarsOfFortuneBridgeEditor/    <-- Editor module
      Public/
        PillarsOfFortuneBridgeEditor.h
        PofHttpServer.h
        PofHttpRouter.h
        PofBlueprintIntrospector.h
        PofLiveCodingBridge.h
      Private/
        PillarsOfFortuneBridgeEditor.cpp
        PofHttpServer.cpp
        PofHttpRouter.cpp
        PofBlueprintIntrospector.cpp
        PofLiveCodingBridge.cpp
        PofEditorCommands.cpp
      PillarsOfFortuneBridgeEditor.Build.cs
```

**Why two modules?**

- **Runtime module** (`PillarsOfFortuneBridge`): Contains data structures, asset manifest types, test spec types, and snapshot result types. These are potentially useful at runtime for debug tools. Loads in `PostEngineInit`.
- **Editor module** (`PillarsOfFortuneBridgeEditor`): Contains the HTTP server, Blueprint introspection, Editor viewport capture, and Live Coding integration. Loads only in `PostEngineInit` with `Type: EditorNoCommandlet`. This ensures zero footprint in packaged builds.

### Plugin Descriptor

```json
{
  "FileVersion": 3,
  "Version": 1,
  "VersionName": "0.1.0",
  "FriendlyName": "Pillars of Fortune Bridge",
  "Description": "Deep bidirectional integration between PoF web app and UE5 Editor",
  "Category": "Editor",
  "CreatedBy": "PoF Team",
  "EnabledByDefault": true,
  "CanContainContent": false,
  "IsBetaVersion": true,
  "Modules": [
    {
      "Name": "PillarsOfFortuneBridge",
      "Type": "Runtime",
      "LoadingPhase": "PostEngineInit"
    },
    {
      "Name": "PillarsOfFortuneBridgeEditor",
      "Type": "EditorNoCommandlet",
      "LoadingPhase": "PostEngineInit"
    }
  ],
  "Plugins": [
    { "Name": "EditorScriptingUtilities", "Enabled": true }
  ]
}
```

### Build Dependencies

**PillarsOfFortuneBridge.Build.cs (Runtime):**

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "Core",
    "CoreUObject",
    "Engine",
    "Json",
    "JsonUtilities"
});
```

**PillarsOfFortuneBridgeEditor.Build.cs (Editor):**

```csharp
PublicDependencyModuleNames.AddRange(new string[] {
    "Core",
    "CoreUObject",
    "Engine",
    "PillarsOfFortuneBridge"   // runtime module
});

PrivateDependencyModuleNames.AddRange(new string[] {
    "UnrealEd",
    "Slate",
    "SlateCore",
    "HTTP",
    "HTTPServer",
    "AssetRegistry",
    "BlueprintGraph",
    "KismetCompiler",
    "AutomationController",
    "LevelEditor",
    "Json",
    "JsonUtilities",
    "ImageWrapper",
    "RenderCore",
    "Renderer"
});
```

### Embedded HTTP Server

The Editor module starts an HTTP server on port 30040 during module startup. It uses the engine's `FHttpServerModule` (IHttpRouter) for zero external dependencies:

```cpp
// PofHttpServer.cpp - Startup
void FPofHttpServer::Start(uint32 Port)
{
    FHttpServerModule& HttpServerModule = FModuleManager::LoadModuleChecked<FHttpServerModule>("HTTPServer");
    HttpRouter = HttpServerModule.GetHttpRouter(Port);

    if (!HttpRouter.IsValid())
    {
        UE_LOG(LogPofBridge, Error, TEXT("Failed to create HTTP router on port %d"), Port);
        return;
    }

    // Bind routes
    BindRoute(TEXT("/pof/status"),            EHttpServerRequestVerbs::VERB_GET,  &FPofHttpServer::HandleStatus);
    BindRoute(TEXT("/pof/manifest"),           EHttpServerRequestVerbs::VERB_GET,  &FPofHttpServer::HandleManifest);
    BindRoute(TEXT("/pof/test/run"),           EHttpServerRequestVerbs::VERB_POST, &FPofHttpServer::HandleTestRun);
    BindRoute(TEXT("/pof/test/results"),       EHttpServerRequestVerbs::VERB_GET,  &FPofHttpServer::HandleTestResults);
    BindRoute(TEXT("/pof/snapshot/capture"),   EHttpServerRequestVerbs::VERB_POST, &FPofHttpServer::HandleSnapshotCapture);
    BindRoute(TEXT("/pof/snapshot/diff"),      EHttpServerRequestVerbs::VERB_GET,  &FPofHttpServer::HandleSnapshotDiff);
    BindRoute(TEXT("/pof/compile/live"),       EHttpServerRequestVerbs::VERB_POST, &FPofHttpServer::HandleLiveCoding);
    BindRoute(TEXT("/pof/compile/status"),     EHttpServerRequestVerbs::VERB_GET,  &FPofHttpServer::HandleCompileStatus);

    HttpServerModule.StartAllListeners();
    bIsRunning = true;

    UE_LOG(LogPofBridge, Log, TEXT("PofBridge HTTP server started on port %d"), Port);
}
```

### Shared Data Directory

The plugin writes structured data to `{ProjectRoot}/.pof/`. This directory is created on plugin startup if it does not exist:

```
{UE5 Project Root}/
  .pof/
    manifest.json              <-- Asset manifest (written by plugin)
    bridge-status.json         <-- Connection health + heartbeat (written by plugin)
    camera-presets.json        <-- Camera positions (written by PoF or user)
    test-results/              <-- Test outcomes (written by plugin)
      combat-damage.json
      inventory-pickup.json
    snapshots/                 <-- Viewport captures (written by plugin)
      main-view-20260221T143022.png
      diff-report.json
```

The `.pof/` directory should be added to the project's `.gitignore` (except `camera-presets.json`, which is user-authored and suitable for version control).

Recommended `.gitignore` entry:

```
# PoF Bridge data (generated)
.pof/manifest.json
.pof/bridge-status.json
.pof/test-results/
.pof/snapshots/
```

---

## 3. Asset Manifest System

### Purpose

The asset manifest provides PoF with a complete, structured inventory of every asset in the UE5 project's `Content/` directory. This enables the web app to display accurate module progress, verify Feature Matrix entries against real project state, and detect drift between what PoF expects and what exists in the Editor.

### Generation Strategy

The manifest is generated by querying `IAssetRegistry` at Editor startup and refreshing incrementally on asset changes.

```cpp
// PofAssetManifest.h
USTRUCT()
struct FPofAssetEntry
{
    GENERATED_BODY()

    UPROPERTY() FString AssetPath;        // /Game/Blueprints/BP_Player
    UPROPERTY() FString AssetClass;       // Blueprint, Material, AnimMontage, etc.
    UPROPERTY() FString ParentClass;      // For Blueprints: C++ parent class name
    UPROPERTY() FString SkeletonPath;     // For AnimAssets: skeleton reference
    UPROPERTY() int32 ContentHash;        // Hash for incremental change detection
    UPROPERTY() TArray<FString> Tags;     // User-defined asset tags
    UPROPERTY() TArray<FString> CrossRefs; // Paths of referenced assets
};
```

### Manifest JSON Schema

The generated `.pof/manifest.json` follows this structure:

```json
{
  "version": 2,
  "generatedAt": "2026-02-21T14:30:22Z",
  "projectName": "PillarsOfFortune",
  "engineVersion": "5.4.1",
  "assetCount": 847,
  "checksumSha256": "a3f2...c91d",
  "blueprints": [
    {
      "path": "/Game/Blueprints/Characters/BP_PlayerCharacter",
      "parentCppClass": "AARPGPlayerCharacter",
      "parentCppModule": "PillarsOfFortune",
      "overriddenFunctions": [
        "BeginPlay",
        "SetupPlayerInputComponent",
        "GetLifetimeReplicatedProps"
      ],
      "addedComponents": [
        {
          "name": "InventoryComponent",
          "class": "UARPGInventoryComponent",
          "isSceneComponent": false
        },
        {
          "name": "InteractionSphere",
          "class": "USphereComponent",
          "isSceneComponent": true,
          "attachParent": "RootComponent"
        }
      ],
      "variables": [
        {
          "name": "MaxHealth",
          "type": "float",
          "defaultValue": "100.0",
          "isReplicated": false,
          "category": "Stats"
        }
      ],
      "eventGraphEntryPoints": [
        "ReceiveBeginPlay",
        "OnComponentBeginOverlap (InteractionSphere)"
      ],
      "interfaces": [
        "BPI_Interactable",
        "BPI_Damageable"
      ],
      "crossReferences": [
        "/Game/Data/DT_WeaponStats",
        "/Game/UI/WBP_PlayerHUD"
      ],
      "contentHash": "b7e4a1f2"
    }
  ],
  "materials": [
    {
      "path": "/Game/Materials/M_Character_Base",
      "parentMaterial": null,
      "domain": "Surface",
      "blendMode": "Opaque",
      "shadingModel": "DefaultLit",
      "parameters": [
        {
          "name": "BaseColor",
          "type": "TextureParameter",
          "defaultTexture": "/Game/Textures/T_Char_BaseColor"
        },
        {
          "name": "Roughness",
          "type": "ScalarParameter",
          "defaultValue": 0.5,
          "min": 0.0,
          "max": 1.0
        },
        {
          "name": "TintColor",
          "type": "VectorParameter",
          "defaultValue": [1.0, 1.0, 1.0, 1.0]
        }
      ],
      "materialInstances": [
        "/Game/Materials/MI_Character_Red",
        "/Game/Materials/MI_Character_Blue"
      ],
      "textureReferences": [
        "/Game/Textures/T_Char_BaseColor",
        "/Game/Textures/T_Char_Normal",
        "/Game/Textures/T_Char_ORM"
      ],
      "crossReferences": [
        "/Game/Meshes/SK_PlayerCharacter"
      ],
      "contentHash": "c3d8e901"
    }
  ],
  "animAssets": [
    {
      "path": "/Game/Animations/AM_PrimaryAttack",
      "assetType": "AnimMontage",
      "skeletonPath": "/Game/Characters/SK_Mannequin_Skeleton",
      "duration": 1.2,
      "notifies": [
        {
          "name": "AN_EnableDamage",
          "time": 0.3,
          "notifyClass": "UARPGAnimNotify_EnableDamage"
        },
        {
          "name": "AN_DisableDamage",
          "time": 0.7,
          "notifyClass": "UARPGAnimNotify_DisableDamage"
        },
        {
          "name": "AN_PlaySwingSound",
          "time": 0.25,
          "notifyClass": "UAnimNotify_PlaySound"
        }
      ],
      "sections": ["Default", "Recovery"],
      "crossReferences": [
        "/Game/Characters/SK_Mannequin_Skeleton",
        "/Game/Animations/ABP_PlayerCharacter"
      ],
      "contentHash": "d9a2b3c4"
    },
    {
      "path": "/Game/Animations/ABP_PlayerCharacter",
      "assetType": "AnimBlueprint",
      "skeletonPath": "/Game/Characters/SK_Mannequin_Skeleton",
      "stateMachines": [
        {
          "name": "Locomotion",
          "states": ["Idle", "Walk", "Run", "Sprint", "Jump"],
          "transitions": [
            { "from": "Idle", "to": "Walk", "condition": "Speed > 10" },
            { "from": "Walk", "to": "Run", "condition": "Speed > 300" },
            { "from": "Run", "to": "Sprint", "condition": "bIsSprinting" },
            { "from": "*", "to": "Jump", "condition": "bIsInAir" }
          ]
        },
        {
          "name": "UpperBody",
          "states": ["Idle", "Attack", "CastAbility"],
          "transitions": [
            { "from": "Idle", "to": "Attack", "condition": "Montage Playing" }
          ]
        }
      ],
      "crossReferences": [
        "/Game/Animations/AM_PrimaryAttack",
        "/Game/Animations/BS_Locomotion"
      ],
      "contentHash": "e5f6a7b8"
    }
  ],
  "dataTables": [
    {
      "path": "/Game/Data/DT_WeaponStats",
      "rowStruct": "FWeaponStatsRow",
      "rowStructModule": "PillarsOfFortune",
      "rowCount": 24,
      "columnNames": ["BaseDamage", "AttackSpeed", "Range", "StaggerPower", "WeaponType"],
      "crossReferences": [
        "/Game/Blueprints/Items/BP_Weapon_Base"
      ],
      "contentHash": "f1a2b3c4"
    }
  ],
  "otherAssets": [
    {
      "path": "/Game/Maps/L_MainHub",
      "assetClass": "World",
      "crossReferences": [],
      "contentHash": "01234567"
    }
  ]
}
```

### Auto-Regeneration via AssetRegistry Delegates

The manifest updates incrementally when assets are saved, renamed, or deleted:

```cpp
// PofAssetManifest.cpp - Binding to asset registry events
void UPofAssetManifest::Initialize()
{
    IAssetRegistry& AssetRegistry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>(
        AssetRegistryConstants::ModuleName).Get();

    // Full scan on startup (async)
    if (AssetRegistry.IsLoadingAssets())
    {
        AssetRegistry.OnFilesLoaded().AddUObject(this, &UPofAssetManifest::OnInitialScanComplete);
    }
    else
    {
        OnInitialScanComplete();
    }

    // Incremental updates
    AssetRegistry.OnAssetAdded().AddUObject(this, &UPofAssetManifest::OnAssetAdded);
    AssetRegistry.OnAssetRemoved().AddUObject(this, &UPofAssetManifest::OnAssetRemoved);
    AssetRegistry.OnAssetRenamed().AddUObject(this, &UPofAssetManifest::OnAssetRenamed);
    AssetRegistry.OnAssetUpdatedOnDisk().AddUObject(this, &UPofAssetManifest::OnAssetUpdated);
}

void UPofAssetManifest::OnAssetAdded(const FAssetData& AssetData)
{
    // Compute content hash from asset file modification time + size
    uint32 NewHash = ComputeAssetHash(AssetData);

    // Check if this asset already exists in manifest with same hash
    if (FPofAssetEntry* Existing = ManifestEntries.Find(AssetData.GetSoftObjectPath()))
    {
        if (Existing->ContentHash == NewHash)
        {
            return; // No change, skip
        }
    }

    // Build entry and add/replace
    FPofAssetEntry Entry = BuildEntryFromAssetData(AssetData);
    Entry.ContentHash = NewHash;
    ManifestEntries.Add(AssetData.GetSoftObjectPath(), Entry);

    // Mark manifest as dirty -- will flush to disk on next tick batch
    bManifestDirty = true;
}
```

### Incremental Updates and Hash-Based Change Detection

Rather than regenerating the entire manifest on every asset change, the system uses hash-based detection:

1. Each asset entry stores a `contentHash` computed from the asset's file modification time and byte size (`FPlatformFileManager` stat call -- no need to load the asset).
2. On `OnAssetUpdated`, the hash is recomputed. If it matches the existing entry, no work is done.
3. Dirty entries are batched and flushed to disk at most once per second via a ticker delegate.
4. The top-level `checksumSha256` is a hash of all entry hashes, enabling PoF to quickly check "has anything changed?" with a single HTTP call to `GET /pof/manifest?checksum-only=true`.

### Performance Characteristics

- **Initial scan:** 2-5 seconds for a project with 1000+ assets (async, does not block Editor).
- **Incremental update:** <50ms per asset change (hash comparison + optional entry rebuild).
- **Disk write:** Batched, at most 1 write/second. JSON serialization of 1000 entries takes ~100ms.
- **Memory:** ~200 bytes per asset entry in-memory (string interning used for repeated class names).

---

## 4. Blueprint-C++ Mapping

### Purpose

PoF's Feature Matrix tracks implementation status of features like "BP_PlayerCharacter uses AARPGCharacterBase as parent" or "BP_EnemyBase has UAbilitySystemComponent added." The Blueprint-C++ mapping system allows PoF to verify these programmatically against the actual Editor state rather than relying on manual review.

### Data Extraction

For each Blueprint class asset, the introspector loads the Blueprint (via `FBlueprintEditorUtils`) and extracts:

```cpp
// PofBlueprintIntrospector.cpp
FPofBlueprintMapping UPofBlueprintIntrospector::IntrospectBlueprint(UBlueprint* Blueprint)
{
    FPofBlueprintMapping Mapping;

    // 1. Parent C++ class
    if (UClass* ParentClass = Blueprint->ParentClass)
    {
        // Walk up until we find a native (C++) class
        UClass* NativeParent = ParentClass;
        while (NativeParent && !NativeParent->IsNative())
        {
            NativeParent = NativeParent->GetSuperClass();
        }

        Mapping.ParentCppClass = NativeParent ? NativeParent->GetName() : TEXT("None");
        Mapping.ParentCppModule = NativeParent ? NativeParent->GetOuterUPackage()->GetName() : TEXT("");
        Mapping.ParentBlueprintClass = (!ParentClass->IsNative())
            ? ParentClass->GetName()
            : TEXT("");
    }

    // 2. Overridden UFUNCTIONs
    UClass* GeneratedClass = Blueprint->GeneratedClass;
    if (GeneratedClass)
    {
        for (TFieldIterator<UFunction> FuncIt(GeneratedClass, EFieldIteratorFlags::ExcludeSuper); FuncIt; ++FuncIt)
        {
            UFunction* Func = *FuncIt;

            // Check if this function overrides a parent C++ function
            UFunction* SuperFunc = GeneratedClass->GetSuperClass()
                ? GeneratedClass->GetSuperClass()->FindFunctionByName(Func->GetFName())
                : nullptr;

            if (SuperFunc && SuperFunc->IsNative())
            {
                FPofFunctionOverride Override;
                Override.FunctionName = Func->GetName();
                Override.DeclaringClass = SuperFunc->GetOwnerClass()->GetName();
                Override.IsEvent = Func->HasAnyFunctionFlags(FUNC_Event);
                Override.IsBlueprintCallable = Func->HasAnyFunctionFlags(FUNC_BlueprintCallable);
                Mapping.OverriddenFunctions.Add(Override);
            }
        }
    }

    // 3. Added UComponents
    if (Blueprint->SimpleConstructionScript)
    {
        TArray<USCS_Node*> AllNodes = Blueprint->SimpleConstructionScript->GetAllNodes();
        for (USCS_Node* Node : AllNodes)
        {
            if (Node && Node->ComponentClass)
            {
                FPofComponentEntry Comp;
                Comp.ComponentName = Node->GetVariableName().ToString();
                Comp.ComponentClass = Node->ComponentClass->GetName();
                Comp.IsSceneComponent = Node->ComponentClass->IsChildOf(USceneComponent::StaticClass());

                // Attach parent
                if (Node->ParentComponentOrVariableName != NAME_None)
                {
                    Comp.AttachParent = Node->ParentComponentOrVariableName.ToString();
                }

                // Extract default property values from the template
                if (UActorComponent* Template = Node->ComponentTemplate)
                {
                    Comp.DefaultValues = ExtractDefaultProperties(Template);
                }

                Mapping.AddedComponents.Add(Comp);
            }
        }
    }

    // 4. Event Graph entry points
    for (UEdGraph* Graph : Blueprint->EventGraphs)
    {
        if (!Graph) continue;
        for (UEdGraphNode* Node : Graph->Nodes)
        {
            if (UK2Node_Event* EventNode = Cast<UK2Node_Event>(Node))
            {
                Mapping.EventGraphEntryPoints.Add(EventNode->GetNodeTitle(ENodeTitleType::FullTitle).ToString());
            }
        }
    }

    // 5. Variables (class member variables declared in Blueprint)
    for (const FBPVariableDescription& Var : Blueprint->NewVariables)
    {
        FPofVariableEntry VarEntry;
        VarEntry.Name = Var.VarName.ToString();
        VarEntry.Type = Var.VarType.PinCategory.ToString();

        // Sub-type for object references
        if (Var.VarType.PinSubCategoryObject.IsValid())
        {
            VarEntry.SubType = Var.VarType.PinSubCategoryObject->GetName();
        }

        VarEntry.DefaultValue = Var.DefaultValue;
        VarEntry.IsReplicated = Var.HasMetaData(FBlueprintMetadata::MD_Replicated);
        VarEntry.Category = Var.Category.ToString();
        Mapping.Variables.Add(VarEntry);
    }

    // 6. Implemented interfaces
    for (const FBPInterfaceDescription& Interface : Blueprint->ImplementedInterfaces)
    {
        if (Interface.Interface)
        {
            Mapping.Interfaces.Add(Interface.Interface->GetName());
        }
    }

    return Mapping;
}
```

### PoF Feature Matrix Integration

The Blueprint mapping directly feeds into PoF's Feature Matrix verification. PoF's `FeatureRow` type includes a `status` field (`FeatureStatus`) that can be `'implemented' | 'improved' | 'partial' | 'missing' | 'unknown'`.

With the manifest data, PoF can define **verification rules** that automatically assess feature status:

```typescript
// Example: PoF-side verification rules (TypeScript, runs in PoF web app)
interface VerificationRule {
  featureName: string;
  moduleId: SubModuleId;
  check: (manifest: AssetManifest) => FeatureStatus;
}

const verificationRules: VerificationRule[] = [
  {
    featureName: 'Character Foundation',
    moduleId: 'arpg-character',
    check: (manifest) => {
      const playerBP = manifest.blueprints.find(
        bp => bp.path.includes('BP_PlayerCharacter') || bp.path.includes('BP_Player')
      );
      if (!playerBP) return 'missing';
      if (playerBP.parentCppClass !== 'AARPGPlayerCharacter'
          && playerBP.parentCppClass !== 'AARPGCharacterBase') return 'partial';

      // Check for required components
      const hasCamera = playerBP.addedComponents.some(c => c.class === 'UCameraComponent');
      const hasSpringArm = playerBP.addedComponents.some(c => c.class === 'USpringArmComponent');

      if (hasCamera && hasSpringArm) return 'implemented';
      return 'partial';
    }
  },
  {
    featureName: 'GAS Integration',
    moduleId: 'arpg-gas',
    check: (manifest) => {
      const charBPs = manifest.blueprints.filter(
        bp => bp.parentCppClass?.includes('Character')
      );
      const hasASC = charBPs.some(bp =>
        bp.addedComponents.some(c => c.class === 'UAbilitySystemComponent')
      );
      if (!hasASC) return 'missing';

      // Check for at least one GameplayAbility Blueprint
      const abilityBPs = manifest.blueprints.filter(
        bp => bp.parentCppClass === 'UGameplayAbility' || bp.parentCppClass?.includes('GameplayAbility')
      );
      if (abilityBPs.length === 0) return 'partial';
      return 'implemented';
    }
  }
];
```

### Mapping JSON Format

The per-Blueprint mapping is embedded in the manifest under the `blueprints` array (see Section 3). A dedicated endpoint also serves it:

```
GET /pof/manifest/blueprint?path=/Game/Blueprints/BP_PlayerCharacter
```

Response:

```json
{
  "path": "/Game/Blueprints/Characters/BP_PlayerCharacter",
  "parentCppClass": "AARPGPlayerCharacter",
  "parentCppModule": "/Script/PillarsOfFortune",
  "parentBlueprintClass": "",
  "overriddenFunctions": [
    {
      "functionName": "BeginPlay",
      "declaringClass": "AActor",
      "isEvent": true,
      "isBlueprintCallable": false
    },
    {
      "functionName": "SetupPlayerInputComponent",
      "declaringClass": "APawn",
      "isEvent": false,
      "isBlueprintCallable": false
    }
  ],
  "addedComponents": [
    {
      "componentName": "AbilitySystemComponent",
      "componentClass": "UAbilitySystemComponent",
      "isSceneComponent": false,
      "attachParent": null,
      "defaultValues": {}
    },
    {
      "componentName": "InteractionSphere",
      "componentClass": "USphereComponent",
      "isSceneComponent": true,
      "attachParent": "RootComponent",
      "defaultValues": {
        "SphereRadius": 200.0,
        "bGenerateOverlapEvents": true
      }
    }
  ],
  "variables": [
    {
      "name": "MaxHealth",
      "type": "float",
      "subType": null,
      "defaultValue": "100.0",
      "isReplicated": false,
      "category": "Stats"
    },
    {
      "name": "DefaultAbilities",
      "type": "object",
      "subType": "UGameplayAbility",
      "defaultValue": "",
      "isReplicated": false,
      "category": "GAS"
    }
  ],
  "eventGraphEntryPoints": [
    "Event BeginPlay",
    "Event OnComponentBeginOverlap (InteractionSphere)"
  ],
  "interfaces": [
    "BPI_Damageable",
    "BPI_Interactable"
  ],
  "contentHash": "b7e4a1f2"
}
```

---

## 5. Automated Test Runner

### Purpose

PoF can define functional test scenarios as JSON and send them to the plugin for execution in PIE. This enables automated verification of gameplay mechanics -- damage calculation, inventory operations, AI behavior -- without manual play testing.

### Test Spec Format

PoF sends test specs via `POST /pof/test/run`:

```json
{
  "testId": "combat-basic-damage",
  "description": "Verify primary attack deals damage to enemy",
  "timeout": 10.0,
  "setup": [
    {
      "spawn": "/Game/Blueprints/Characters/BP_PlayerCharacter",
      "tag": "Player",
      "location": [0, 0, 100],
      "rotation": [0, 0, 0]
    },
    {
      "spawn": "/Game/Blueprints/Characters/BP_EnemyBase",
      "tag": "Enemy",
      "location": [300, 0, 100],
      "rotation": [0, 180, 0],
      "propertyOverrides": {
        "MaxHealth": 100.0,
        "Health": 100.0
      }
    }
  ],
  "actions": [
    {
      "type": "call",
      "target": "Player",
      "function": "AttackPrimary",
      "args": {}
    },
    {
      "type": "wait",
      "duration": 1.5,
      "reason": "Wait for attack montage and damage application"
    },
    {
      "type": "call",
      "target": "Player",
      "function": "AttackPrimary",
      "args": {}
    },
    {
      "type": "wait",
      "duration": 1.5
    }
  ],
  "assertions": [
    {
      "id": "enemy-took-damage",
      "target": "Enemy",
      "property": "Health",
      "operator": "lessThan",
      "expected": 100.0,
      "description": "Enemy health should be reduced after two attacks"
    },
    {
      "id": "enemy-alive",
      "target": "Enemy",
      "property": "Health",
      "operator": "greaterThan",
      "expected": 0.0,
      "description": "Enemy should still be alive after two basic attacks"
    },
    {
      "id": "player-undamaged",
      "target": "Player",
      "property": "Health",
      "operator": "equals",
      "expected": 100.0,
      "description": "Player should not have taken damage"
    }
  ],
  "cleanup": "destroyAll"
}
```

### Assertion Operators

| Operator | Description |
|---|---|
| `equals` | Exact equality (with float epsilon for numeric types) |
| `notEquals` | Inequality |
| `greaterThan` | Numeric greater-than |
| `lessThan` | Numeric less-than |
| `greaterThanOrEqual` | Numeric >= |
| `lessThanOrEqual` | Numeric <= |
| `contains` | String contains substring, or array contains element |
| `hasTag` | Actor has gameplay tag |
| `isValid` | Property is not null/None |
| `isNull` | Property is null/None |
| `isTrue` | Boolean property is true |
| `isFalse` | Boolean property is false |

### Execution Flow

The plugin executes test specs in PIE using the following sequence:

```cpp
// PofTestRunner.cpp - High level flow
void UPofTestRunner::ExecuteTestSpec(const FPofTestSpec& Spec)
{
    CurrentSpec = Spec;
    CurrentResult.TestId = Spec.TestId;
    CurrentResult.StartTime = FDateTime::UtcNow();
    CurrentResult.Status = EPofTestStatus::Running;

    // 1. Start PIE session if not already running
    if (!GEditor->IsPlaySessionInProgress())
    {
        FRequestPlaySessionParams Params;
        Params.WorldType = EPlaySessionWorldType::PlayInEditor;
        Params.DestinationSlateViewport = nullptr; // Headless PIE (no viewport)
        GEditor->RequestPlaySession(Params);

        // Wait for PIE to initialize via delegate
        FEditorDelegates::PostPIEStarted.AddUObject(this, &UPofTestRunner::OnPIEStarted);
        return; // Continues in OnPIEStarted
    }

    ContinueExecution();
}

void UPofTestRunner::ContinueExecution()
{
    // 2. Spawn actors from setup block
    for (const FPofSpawnEntry& SpawnEntry : CurrentSpec.Setup)
    {
        UClass* ActorClass = LoadClass<AActor>(nullptr, *SpawnEntry.BlueprintPath);
        if (!ActorClass)
        {
            FailTest(FString::Printf(TEXT("Failed to load class: %s"), *SpawnEntry.BlueprintPath));
            return;
        }

        FActorSpawnParameters SpawnParams;
        SpawnParams.Name = FName(*SpawnEntry.Tag);
        SpawnParams.SpawnCollisionHandlingOverride =
            ESpawnActorCollisionHandlingMethod::AdjustIfPossibleButAlwaysSpawn;

        AActor* Actor = GetPIEWorld()->SpawnActor<AActor>(
            ActorClass,
            FVector(SpawnEntry.Location[0], SpawnEntry.Location[1], SpawnEntry.Location[2]),
            FRotator(SpawnEntry.Rotation[0], SpawnEntry.Rotation[1], SpawnEntry.Rotation[2]),
            SpawnParams
        );

        if (!Actor)
        {
            FailTest(FString::Printf(TEXT("Failed to spawn actor: %s"), *SpawnEntry.Tag));
            return;
        }

        // Apply property overrides
        for (const auto& Override : SpawnEntry.PropertyOverrides)
        {
            FProperty* Prop = Actor->GetClass()->FindPropertyByName(FName(*Override.Key));
            if (Prop)
            {
                void* ValuePtr = Prop->ContainerPtrToValuePtr<void>(Actor);
                Prop->ImportText_Direct(*Override.Value, ValuePtr, Actor, PPF_None);
            }
        }

        SpawnedActors.Add(SpawnEntry.Tag, Actor);
    }

    // 3. Execute actions sequentially via timer
    CurrentActionIndex = 0;
    ExecuteNextAction();
}

void UPofTestRunner::ExecuteNextAction()
{
    if (CurrentActionIndex >= CurrentSpec.Actions.Num())
    {
        // All actions complete -- run assertions
        RunAssertions();
        return;
    }

    const FPofTestAction& Action = CurrentSpec.Actions[CurrentActionIndex];
    CurrentActionIndex++;

    if (Action.Type == TEXT("call"))
    {
        AActor* Target = SpawnedActors.FindRef(Action.Target);
        if (!Target)
        {
            FailTest(FString::Printf(TEXT("Target actor not found: %s"), *Action.Target));
            return;
        }

        UFunction* Func = Target->FindFunction(FName(*Action.Function));
        if (!Func)
        {
            FailTest(FString::Printf(TEXT("Function not found: %s.%s"), *Action.Target, *Action.Function));
            return;
        }

        Target->ProcessEvent(Func, nullptr); // TODO: pass args struct
        ExecuteNextAction();
    }
    else if (Action.Type == TEXT("wait"))
    {
        GetWorld()->GetTimerManager().SetTimer(
            ActionTimerHandle,
            this,
            &UPofTestRunner::ExecuteNextAction,
            Action.Duration,
            false
        );
    }
}
```

### Test Result Format

Results are written to `.pof/test-results/{testId}.json` and returned via `GET /pof/test/results/{testId}`:

```json
{
  "testId": "combat-basic-damage",
  "status": "passed",
  "startTime": "2026-02-21T14:35:00Z",
  "endTime": "2026-02-21T14:35:04Z",
  "durationMs": 4120,
  "assertions": [
    {
      "id": "enemy-took-damage",
      "status": "passed",
      "description": "Enemy health should be reduced after two attacks",
      "expected": "< 100.0",
      "actual": "72.0"
    },
    {
      "id": "enemy-alive",
      "status": "passed",
      "description": "Enemy should still be alive after two basic attacks",
      "expected": "> 0.0",
      "actual": "72.0"
    },
    {
      "id": "player-undamaged",
      "status": "passed",
      "description": "Player should not have taken damage",
      "expected": "== 100.0",
      "actual": "100.0"
    }
  ],
  "logs": [
    { "time": 0.0, "message": "Spawned Player at (0, 0, 100)" },
    { "time": 0.0, "message": "Spawned Enemy at (300, 0, 100)" },
    { "time": 0.1, "message": "Called Player.AttackPrimary" },
    { "time": 1.6, "message": "Called Player.AttackPrimary" },
    { "time": 3.1, "message": "Running assertions..." },
    { "time": 3.1, "message": "All 3 assertions passed" }
  ],
  "errors": []
}
```

Failed test result example:

```json
{
  "testId": "combat-basic-damage",
  "status": "failed",
  "startTime": "2026-02-21T14:35:00Z",
  "endTime": "2026-02-21T14:35:04Z",
  "durationMs": 4200,
  "assertions": [
    {
      "id": "enemy-took-damage",
      "status": "failed",
      "description": "Enemy health should be reduced after two attacks",
      "expected": "< 100.0",
      "actual": "100.0",
      "failureReason": "Property 'Health' value 100.0 is not less than 100.0 -- damage was not applied"
    },
    {
      "id": "enemy-alive",
      "status": "passed",
      "description": "Enemy should still be alive after two basic attacks",
      "expected": "> 0.0",
      "actual": "100.0"
    },
    {
      "id": "player-undamaged",
      "status": "passed",
      "description": "Player should not have taken damage",
      "expected": "== 100.0",
      "actual": "100.0"
    }
  ],
  "logs": [
    { "time": 0.0, "message": "Spawned Player at (0, 0, 100)" },
    { "time": 0.0, "message": "Spawned Enemy at (300, 0, 100)" },
    { "time": 0.1, "message": "Called Player.AttackPrimary" },
    { "time": 0.1, "message": "WARNING: Function 'AttackPrimary' found but no montage played" }
  ],
  "errors": [
    "Assertion 'enemy-took-damage' failed: Health was 100.0, expected < 100.0"
  ]
}
```

### Integration with UE5 Automation Framework

The plugin can also discover and run existing `IMPLEMENT_SIMPLE_AUTOMATION_TEST` tests registered with UE5's Automation Framework:

```
POST /pof/test/run-automation
{
  "filter": "Project.PillarsOfFortune.Combat.*",
  "flags": ["EditorContext", "ProductFilter"]
}
```

Response wraps the standard `FAutomationTestResults` into PoF-compatible JSON format.

---

## 6. Visual Snapshot System

### Purpose

Capture viewport screenshots from predefined camera positions, compare against baselines, and report visual regressions. This is used to verify material changes, lighting adjustments, UI layout, and general visual quality without requiring human review of every change.

### Camera Presets

Camera positions are stored in `.pof/camera-presets.json`. This file can be authored by the user in the PoF web app (using the level design module's camera tools) or manually:

```json
{
  "version": 1,
  "presets": [
    {
      "id": "main-overview",
      "name": "Main Hub Overview",
      "description": "Isometric view of the central hub area",
      "location": [1200, -800, 2400],
      "rotation": [-55, 45, 0],
      "fov": 60.0,
      "resolution": [1920, 1080],
      "mapPath": "/Game/Maps/L_MainHub"
    },
    {
      "id": "char-closeup",
      "name": "Character Close-up",
      "description": "Close-up of player character for material/mesh inspection",
      "location": [0, -200, 150],
      "rotation": [0, 90, 0],
      "fov": 45.0,
      "resolution": [1920, 1080],
      "mapPath": "/Game/Maps/L_CharacterPreview"
    },
    {
      "id": "combat-arena",
      "name": "Combat Arena",
      "description": "Bird's-eye view of combat test arena",
      "location": [0, 0, 3000],
      "rotation": [-90, 0, 0],
      "fov": 70.0,
      "resolution": [1920, 1080],
      "mapPath": "/Game/Maps/L_CombatArena"
    },
    {
      "id": "ui-hud",
      "name": "HUD Layout",
      "description": "Capture of in-game HUD during normal gameplay",
      "location": [0, -1000, 1500],
      "rotation": [-45, 0, 0],
      "fov": 60.0,
      "resolution": [1920, 1080],
      "mapPath": "/Game/Maps/L_MainHub",
      "requiresPIE": true,
      "setupCommands": [
        "ShowFlag.HUD 1",
        "ShowFlag.PostProcessing 1"
      ]
    }
  ]
}
```

### Capture Endpoint

```
POST /pof/snapshot/capture
{
  "presetIds": ["main-overview", "char-closeup"],
  "saveBaseline": false,
  "compareToBaseline": true,
  "diffThreshold": 0.02
}
```

### Capture Implementation

```cpp
// PofSnapshotCapture.cpp
void UPofSnapshotCapture::CapturePreset(const FPofCameraPreset& Preset, bool bSaveAsBaseline)
{
    // 1. Get the active level editor viewport
    FLevelEditorViewportClient* ViewportClient = nullptr;
    if (GEditor && GEditor->GetLevelViewportClients().Num() > 0)
    {
        ViewportClient = GEditor->GetLevelViewportClients()[0];
    }

    if (!ViewportClient)
    {
        UE_LOG(LogPofBridge, Error, TEXT("No active viewport for snapshot capture"));
        return;
    }

    // 2. Store current camera state for restoration
    FVector OriginalLocation = ViewportClient->GetViewLocation();
    FRotator OriginalRotation = ViewportClient->GetViewRotation();
    float OriginalFOV = ViewportClient->ViewFOV;

    // 3. Set camera to preset position
    ViewportClient->SetViewLocation(
        FVector(Preset.Location[0], Preset.Location[1], Preset.Location[2]));
    ViewportClient->SetViewRotation(
        FRotator(Preset.Rotation[0], Preset.Rotation[1], Preset.Rotation[2]));
    ViewportClient->ViewFOV = Preset.FOV;

    // 4. Force a viewport redraw and wait for rendering to complete
    ViewportClient->Invalidate();
    FSlateApplication::Get().Tick();
    FlushRenderingCommands();

    // 5. Capture the viewport to an image
    FViewport* Viewport = ViewportClient->Viewport;
    TArray<FColor> Bitmap;
    bool bSuccess = Viewport->ReadPixels(Bitmap);

    if (bSuccess && Bitmap.Num() > 0)
    {
        int32 Width = Viewport->GetSizeXY().X;
        int32 Height = Viewport->GetSizeXY().Y;

        // Generate filename
        FString Timestamp = FDateTime::UtcNow().ToString(TEXT("%Y%m%dT%H%M%S"));
        FString Filename = bSaveAsBaseline
            ? FString::Printf(TEXT("%s-baseline.png"), *Preset.Id)
            : FString::Printf(TEXT("%s-%s.png"), *Preset.Id, *Timestamp);
        FString FullPath = FPaths::Combine(GetPofDirectory(), TEXT("snapshots"), Filename);

        // Save as PNG
        TArray<uint8> PngData;
        FImageUtils::PNGCompressImageArray(Width, Height, Bitmap, PngData);
        FFileHelper::SaveArrayToFile(PngData, *FullPath);

        UE_LOG(LogPofBridge, Log, TEXT("Snapshot saved: %s (%dx%d)"), *FullPath, Width, Height);

        // Store result for diff comparison
        FPofSnapshotResult Result;
        Result.PresetId = Preset.Id;
        Result.FilePath = FullPath;
        Result.Width = Width;
        Result.Height = Height;
        Result.Timestamp = FDateTime::UtcNow();
        SnapshotResults.Add(Result);
    }

    // 6. Restore original camera state
    ViewportClient->SetViewLocation(OriginalLocation);
    ViewportClient->SetViewRotation(OriginalRotation);
    ViewportClient->ViewFOV = OriginalFOV;
    ViewportClient->Invalidate();
}
```

### Baseline Comparison (Pixel Diff)

The diff engine compares a newly captured snapshot against its baseline using a per-pixel color distance metric:

```cpp
FPofDiffResult UPofSnapshotCapture::CompareWithBaseline(
    const FString& PresetId,
    float DiffThreshold)
{
    FPofDiffResult Result;
    Result.PresetId = PresetId;

    FString BaselinePath = FPaths::Combine(GetPofDirectory(), TEXT("snapshots"),
        FString::Printf(TEXT("%s-baseline.png"), *PresetId));
    FString LatestPath = GetLatestSnapshotPath(PresetId);

    if (!FPaths::FileExists(BaselinePath))
    {
        Result.Status = TEXT("no-baseline");
        Result.DiffPercentage = -1.0f;
        return Result;
    }

    // Load both images
    TArray<uint8> BaselineData, LatestData;
    FFileHelper::LoadFileToArray(BaselineData, *BaselinePath);
    FFileHelper::LoadFileToArray(LatestData, *LatestPath);

    // Decode PNGs to pixel arrays
    TArray<FColor> BaselinePixels, LatestPixels;
    int32 BaseW, BaseH, LatW, LatH;
    DecodePNG(BaselineData, BaselinePixels, BaseW, BaseH);
    DecodePNG(LatestData, LatestPixels, LatW, LatH);

    if (BaseW != LatW || BaseH != LatH)
    {
        Result.Status = TEXT("resolution-mismatch");
        Result.DiffPercentage = 100.0f;
        return Result;
    }

    // Per-pixel comparison
    int32 TotalPixels = BaseW * BaseH;
    int32 DiffPixels = 0;
    float MaxDiff = 0.0f;

    for (int32 i = 0; i < TotalPixels; ++i)
    {
        float ColorDistance = FLinearColor(BaselinePixels[i]).ComputeLuminance()
            - FLinearColor(LatestPixels[i]).ComputeLuminance();
        // Full color distance
        float R = (BaselinePixels[i].R - LatestPixels[i].R) / 255.0f;
        float G = (BaselinePixels[i].G - LatestPixels[i].G) / 255.0f;
        float B = (BaselinePixels[i].B - LatestPixels[i].B) / 255.0f;
        float PixelDiff = FMath::Sqrt(R * R + G * G + B * B) / 1.732f; // Normalize to 0-1

        if (PixelDiff > DiffThreshold)
        {
            DiffPixels++;
        }
        MaxDiff = FMath::Max(MaxDiff, PixelDiff);
    }

    Result.DiffPercentage = (float)DiffPixels / (float)TotalPixels * 100.0f;
    Result.MaxPixelDiff = MaxDiff;
    Result.DiffPixelCount = DiffPixels;
    Result.TotalPixelCount = TotalPixels;
    Result.Passed = (Result.DiffPercentage < DiffThreshold * 100.0f);
    Result.Status = Result.Passed ? TEXT("passed") : TEXT("failed");

    return Result;
}
```

### Diff Report Format

Written to `.pof/snapshots/diff-report.json`:

```json
{
  "generatedAt": "2026-02-21T14:40:00Z",
  "diffThreshold": 0.02,
  "overallStatus": "failed",
  "results": [
    {
      "presetId": "main-overview",
      "presetName": "Main Hub Overview",
      "status": "passed",
      "diffPercentage": 0.3,
      "maxPixelDiff": 0.08,
      "diffPixelCount": 6220,
      "totalPixelCount": 2073600,
      "baselinePath": ".pof/snapshots/main-overview-baseline.png",
      "capturePath": ".pof/snapshots/main-overview-20260221T144000.png",
      "note": "Minor lighting variance within threshold"
    },
    {
      "presetId": "char-closeup",
      "presetName": "Character Close-up",
      "status": "failed",
      "diffPercentage": 12.7,
      "maxPixelDiff": 0.95,
      "diffPixelCount": 263347,
      "totalPixelCount": 2073600,
      "baselinePath": ".pof/snapshots/char-closeup-baseline.png",
      "capturePath": ".pof/snapshots/char-closeup-20260221T144000.png",
      "note": "Significant material change detected on character torso"
    }
  ],
  "summary": {
    "totalPresets": 2,
    "passed": 1,
    "failed": 1,
    "noBaseline": 0,
    "skipped": 0
  }
}
```

### Use Cases

| Use Case | How It Works |
|---|---|
| **Material validation** | After editing M_Character_Base parameters, capture `char-closeup` and diff against baseline. >5% diff triggers review. |
| **Lighting consistency** | After light changes in L_MainHub, capture `main-overview` from the standard angle. Detects unintended global illumination shifts. |
| **UI regression** | With PIE running and HUD visible, capture `ui-hud` preset. Pixel diff catches layout shifts, missing elements, wrong colors. |
| **Post-process verification** | After adjusting post-process volumes, capture before/after. Diff isolates exactly which areas changed. |

---

## 7. Live Coding Integration

### Purpose

Trigger UE5's Live Coding (hot reload) from the PoF web app and receive structured compile results. This is faster than invoking UBT headlessly because Live Coding performs incremental compilation and directly patches the running Editor process.

### HTTP Endpoint

```
POST /pof/compile/live
{
  "waitForComplete": true,
  "timeoutSeconds": 120
}
```

### Implementation

```cpp
// PofLiveCodingBridge.cpp
void UPofLiveCodingBridge::TriggerLiveCoding(
    TFunction<void(const FPofCompileResult&)> OnComplete)
{
    CompletionCallback = OnComplete;
    CompileResult = FPofCompileResult();
    CompileResult.StartTime = FDateTime::UtcNow();
    CompileResult.Status = EPofCompileStatus::Compiling;

#if WITH_LIVE_CODING
    ILiveCodingModule& LiveCoding = FModuleManager::LoadModuleChecked<ILiveCodingModule>(
        LIVE_CODING_MODULE_NAME);

    if (!LiveCoding.IsEnabledForSession())
    {
        CompileResult.Status = EPofCompileStatus::Error;
        CompileResult.ErrorMessage = TEXT("Live Coding is not enabled for this session");
        OnComplete(CompileResult);
        return;
    }

    // Bind to completion delegate
    LiveCoding.GetOnPatchCompleteDelegate().AddUObject(
        this, &UPofLiveCodingBridge::OnLiveCodingComplete);

    // Trigger the compile
    LiveCoding.EnableByDefault(true);
    bool bStarted = LiveCoding.Compile();

    if (!bStarted)
    {
        CompileResult.Status = EPofCompileStatus::Error;
        CompileResult.ErrorMessage = TEXT("Failed to start Live Coding compilation");
        OnComplete(CompileResult);
    }

    // Set timeout
    GetWorld()->GetTimerManager().SetTimer(
        TimeoutHandle,
        [this]()
        {
            if (CompileResult.Status == EPofCompileStatus::Compiling)
            {
                CompileResult.Status = EPofCompileStatus::Timeout;
                CompileResult.ErrorMessage = TEXT("Compilation timed out");
                CompletionCallback(CompileResult);
            }
        },
        TimeoutSeconds,
        false
    );
#else
    CompileResult.Status = EPofCompileStatus::Error;
    CompileResult.ErrorMessage = TEXT("Live Coding not available in this build configuration");
    OnComplete(CompileResult);
#endif
}

void UPofLiveCodingBridge::OnLiveCodingComplete(bool bSuccess)
{
    CompileResult.EndTime = FDateTime::UtcNow();
    CompileResult.DurationMs = (CompileResult.EndTime - CompileResult.StartTime).GetTotalMilliseconds();
    CompileResult.Status = bSuccess ? EPofCompileStatus::Success : EPofCompileStatus::Failed;

    // Capture output log for diagnostic extraction
    CompileResult.RawOutput = CapturedLogOutput;

    // Parse diagnostics from captured log
    ParseCompileDiagnostics(CompileResult);

    CompletionCallback(CompileResult);
}
```

### Response Format

The response matches PoF's existing `BuildDiagnostic` interface (from `UE5BuildParser.ts`):

```json
{
  "status": "failed",
  "startTime": "2026-02-21T14:45:00Z",
  "endTime": "2026-02-21T14:45:08Z",
  "durationMs": 8200,
  "diagnostics": [
    {
      "id": "diag-001",
      "severity": "error",
      "file": "Source/PillarsOfFortune/Characters/ARPGCharacterBase.cpp",
      "line": 47,
      "column": 12,
      "code": "C2065",
      "message": "'MaxStamina': undeclared identifier",
      "rawText": "ARPGCharacterBase.cpp(47,12): error C2065: 'MaxStamina': undeclared identifier",
      "category": "compile"
    },
    {
      "id": "diag-002",
      "severity": "warning",
      "file": "Source/PillarsOfFortune/Combat/DamageCalculation.cpp",
      "line": 23,
      "column": 5,
      "code": "C4244",
      "message": "conversion from 'double' to 'float', possible loss of data",
      "rawText": "DamageCalculation.cpp(23,5): warning C4244: ...",
      "category": "compile"
    }
  ],
  "summary": {
    "success": false,
    "errorCount": 1,
    "warningCount": 1,
    "duration": "8.2s",
    "rawText": "Build FAILED: 1 error, 1 warning"
  }
}
```

This format is directly consumable by PoF's existing `ErrorCard` component and `UE5BuildParser` without any transformation.

### Advantages Over Headless UBT

| Aspect | Headless UBT (`UnrealBuildTool`) | Live Coding |
|---|---|---|
| Compilation type | Full or incremental (file-level) | Incremental (function-level patches) |
| Typical compile time | 15-60 seconds | 2-10 seconds |
| Editor restart required | Yes (must close and reopen Editor or use hot reload) | No (patches live process) |
| Reflects Editor state | No (separate process) | Yes (patches running Editor memory) |
| Works without Editor | Yes | No |
| Source file detection | Must specify targets | Auto-detects changed files |

---

## 8. Communication Protocol

### HTTP API (port 30040)

All endpoints are served at `http://localhost:30040`. The server binds to `127.0.0.1` only (localhost) for security.

#### Endpoint Reference

| Method | Path | Description | Request Body | Response |
|---|---|---|---|---|
| `GET` | `/pof/status` | Plugin version, project info, Editor state | -- | StatusResponse |
| `GET` | `/pof/manifest` | Full asset manifest | -- | ManifestResponse |
| `GET` | `/pof/manifest?checksum-only=true` | Manifest checksum only (fast change detection) | -- | `{ "checksum": "a3f2...c91d" }` |
| `GET` | `/pof/manifest/blueprint?path={assetPath}` | Single Blueprint introspection | -- | BlueprintMapping |
| `POST` | `/pof/test/run` | Execute a test spec in PIE | TestSpec JSON | `{ "accepted": true, "testId": "..." }` |
| `GET` | `/pof/test/results/{testId}` | Get test results | -- | TestResult JSON |
| `GET` | `/pof/test/results` | List all test results | -- | `{ "results": [...] }` |
| `POST` | `/pof/test/run-automation` | Run UE5 Automation Framework tests | Filter JSON | AutomationResult JSON |
| `POST` | `/pof/snapshot/capture` | Capture viewport snapshots | CaptureRequest JSON | `{ "accepted": true, "presetIds": [...] }` |
| `GET` | `/pof/snapshot/diff` | Get latest diff report | -- | DiffReport JSON |
| `POST` | `/pof/snapshot/baseline` | Save current captures as new baselines | `{ "presetIds": [...] }` | `{ "saved": [...] }` |
| `POST` | `/pof/compile/live` | Trigger Live Coding hot reload | CompileRequest JSON | CompileResult JSON |
| `GET` | `/pof/compile/status` | Current compilation status (polling) | -- | `{ "status": "idle|compiling|success|failed" }` |

#### Status Response

```json
{
  "pluginVersion": "0.1.0",
  "engineVersion": "5.4.1",
  "projectName": "PillarsOfFortune",
  "projectRoot": "C:/Users/kazda/UE5Projects/PillarsOfFortune",
  "editorState": "idle",
  "pieRunning": false,
  "liveCodingEnabled": true,
  "manifestReady": true,
  "manifestAssetCount": 847,
  "manifestLastUpdated": "2026-02-21T14:30:22Z",
  "uptimeSeconds": 3600,
  "port": 30040
}
```

#### Common Response Headers

All responses include:

```
Content-Type: application/json; charset=utf-8
X-Pof-Bridge-Version: 0.1.0
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Pof-Auth-Token
```

CORS is configured to allow requests from `localhost:3000` (the PoF web app dev server) and `localhost:3001` (alternative port).

#### Error Response Format

```json
{
  "error": true,
  "code": "MANIFEST_NOT_READY",
  "message": "Asset manifest is still being generated. Try again in a few seconds.",
  "retryAfterMs": 3000
}
```

Error codes:

| Code | HTTP Status | Description |
|---|---|---|
| `MANIFEST_NOT_READY` | 503 | Manifest is still generating on startup |
| `ASSET_NOT_FOUND` | 404 | Requested asset path does not exist |
| `PIE_NOT_RUNNING` | 409 | Test requires PIE but it is not running |
| `PIE_START_FAILED` | 500 | Failed to start PIE session |
| `COMPILE_IN_PROGRESS` | 409 | A compilation is already in progress |
| `LIVE_CODING_DISABLED` | 400 | Live Coding is not enabled |
| `INVALID_TEST_SPEC` | 400 | Test spec JSON is malformed |
| `TEST_TIMEOUT` | 408 | Test execution exceeded timeout |
| `SNAPSHOT_FAILED` | 500 | Viewport capture failed |
| `AUTH_FAILED` | 401 | Invalid or missing auth token |

### File-Based Exchange (.pof/ Directory)

For data that is large (manifest), persistent across Editor restarts, or consumed offline, the plugin writes to the `.pof/` directory:

| File | Written By | Purpose | Update Frequency |
|---|---|---|---|
| `manifest.json` | Plugin | Full asset manifest | On asset change (batched, max 1/sec) |
| `bridge-status.json` | Plugin | Connection health, heartbeat | Every 5 seconds |
| `test-results/{testId}.json` | Plugin | Test execution outcomes | After each test completes |
| `snapshots/*.png` | Plugin | Viewport captures | On capture command |
| `snapshots/diff-report.json` | Plugin | Visual regression report | After capture+compare |
| `camera-presets.json` | PoF / User | Camera positions for snapshots | User-authored |

#### bridge-status.json

```json
{
  "alive": true,
  "pid": 12345,
  "port": 30040,
  "lastHeartbeat": "2026-02-21T14:50:00Z",
  "editorState": "idle",
  "pieRunning": false,
  "manifestReady": true,
  "pendingOperations": []
}
```

PoF can poll this file (filesystem watch or periodic read) to detect whether the Editor is running without making HTTP requests. This is useful for the PoF web app to show "UE5 Editor Connected" / "UE5 Editor Not Running" status in the UI.

### Authentication

By default, no authentication is required (localhost-only). For environments where multiple users share a machine or where additional security is desired, an optional auth token can be configured:

1. User sets `PofBridgeAuthToken` in `DefaultEngine.ini`:
   ```ini
   [/Script/PillarsOfFortuneBridge.PofBridgeSettings]
   AuthToken=my-secret-token-here
   ```

2. PoF sends the token in requests:
   ```
   X-Pof-Auth-Token: my-secret-token-here
   ```

3. Plugin rejects requests without valid token (401 response).

If `AuthToken` is empty (default), authentication is disabled and all localhost requests are accepted.

---

## 9. Implementation Phases

### Phase A: Plugin Skeleton + HTTP Server + Status Endpoint

**Goal:** Minimal viable plugin that proves the architecture works.

**Deliverables:**
- `.uplugin` file with both modules declared
- `PillarsOfFortuneBridge.Build.cs` and `PillarsOfFortuneBridgeEditor.Build.cs`
- Editor module startup: creates `.pof/` directory, starts HTTP server on port 30040
- `GET /pof/status` returns project info and plugin version
- `bridge-status.json` heartbeat file written every 5 seconds
- CORS headers for `localhost:3000`
- Basic logging (`LogPofBridge` category)

**Estimated effort:** 2-3 days

**Validation:**
- Plugin loads in UE5 Editor without errors
- `curl http://localhost:30040/pof/status` returns valid JSON
- `.pof/bridge-status.json` exists and updates
- Plugin does not load in packaged builds

### Phase B: Asset Manifest + Blueprint-C++ Mapping

**Goal:** Full project introspection available to PoF.

**Deliverables:**
- `UPofAssetManifest` class with full `IAssetRegistry` scan
- Blueprint introspection (parent class, components, variables, overrides, interfaces)
- Material parameter extraction
- AnimAsset metadata (montage notifies, ABP state machines)
- DataTable row struct and column discovery
- Cross-reference tracking between assets
- Incremental update via asset registry delegates
- Hash-based change detection
- `GET /pof/manifest` endpoint
- `GET /pof/manifest/blueprint?path=...` endpoint
- `manifest.json` file output

**Estimated effort:** 5-7 days

**Validation:**
- Manifest JSON contains all project Blueprints with correct parent classes
- Editing a Blueprint and saving triggers incremental manifest update within 2 seconds
- PoF web app can fetch manifest and display asset inventory
- Feature Matrix verification rules can query manifest data

### Phase C: Visual Snapshot System

**Goal:** Automated viewport capture and visual regression detection.

**Deliverables:**
- Camera preset file parsing (`.pof/camera-presets.json`)
- Viewport capture at preset positions
- PNG file output to `.pof/snapshots/`
- Baseline save and comparison
- Per-pixel diff with configurable threshold
- Diff report JSON generation
- `POST /pof/snapshot/capture` endpoint
- `POST /pof/snapshot/baseline` endpoint
- `GET /pof/snapshot/diff` endpoint

**Estimated effort:** 4-5 days

**Validation:**
- Captured PNGs match expected camera positions
- Diff report correctly identifies changed pixels after a material edit
- Diff report shows "passed" when nothing has changed
- Resolution mismatch is handled gracefully

### Phase D: Automated Test Runner

**Goal:** PoF can define and execute gameplay tests in PIE.

**Deliverables:**
- Test spec JSON parser
- PIE session start/stop management
- Actor spawning from Blueprint paths
- Property override application
- Function invocation via `ProcessEvent`
- Wait actions via timer
- Assertion evaluation (all operators)
- Test result JSON output
- `POST /pof/test/run` endpoint
- `GET /pof/test/results/{testId}` endpoint
- UE5 Automation Framework integration (`POST /pof/test/run-automation`)
- Cleanup and error recovery

**Estimated effort:** 7-10 days

**Validation:**
- Simple spawn-and-check test passes
- Combat damage test (spawn player + enemy, attack, verify health) works end-to-end
- Failed assertions produce clear failure messages with actual vs expected
- Test timeout is respected
- PIE session is cleaned up after test completion

### Phase E: Live Coding Integration

**Goal:** Trigger compilation from PoF and receive structured diagnostics.

**Deliverables:**
- Live Coding trigger via `ILiveCodingModule`
- Compile output capture and parsing
- Structured diagnostic extraction (errors, warnings, linker issues)
- Format matching PoF's `BuildDiagnostic` interface
- `POST /pof/compile/live` endpoint
- `GET /pof/compile/status` endpoint
- Timeout handling

**Estimated effort:** 3-4 days

**Validation:**
- Triggering compile from PoF succeeds and returns diagnostics
- Intentional compile error produces structured error with file, line, message
- PoF's `ErrorCard` component renders the diagnostics without modification
- Compile timeout is respected and reported

### Phase Summary

| Phase | Deliverable | Effort | Cumulative |
|---|---|---|---|
| A | Plugin skeleton + HTTP + status | 2-3 days | 2-3 days |
| B | Asset manifest + Blueprint mapping | 5-7 days | 7-10 days |
| C | Visual snapshot system | 4-5 days | 11-15 days |
| D | Automated test runner | 7-10 days | 18-25 days |
| E | Live Coding integration | 3-4 days | 21-29 days |

Total estimated effort: **21-29 days** of focused development.

---

## 10. Technical Considerations

### Thread Safety

UE5's game thread owns most Editor state. The HTTP server (via `FHttpServerModule`) receives requests on a background thread but dispatches handlers to the game thread automatically. All plugin logic that touches Editor state (asset registry queries, viewport manipulation, PIE control, Blueprint introspection) runs on the game thread.

For long-running operations (manifest generation, test execution), the pattern is:

1. HTTP request received on background thread
2. Handler queued to game thread via `AsyncTask(ENamedThreads::GameThread, [...])`
3. Operation starts on game thread (may span multiple frames via timers/delegates)
4. Result written to a thread-safe completion structure
5. HTTP response sent from background thread when completion is signaled

```cpp
// Pattern for async HTTP handler
void FPofHttpServer::HandleManifest(const FHttpServerRequest& Request,
    const FHttpResultCallback& OnComplete)
{
    // Queue to game thread
    AsyncTask(ENamedThreads::GameThread, [this, OnComplete]()
    {
        // This runs on game thread -- safe to access Editor state
        FString ManifestJson = AssetManifest->GetManifestJson();

        // Respond (this is thread-safe in FHttpServerModule)
        auto Response = FHttpServerResponse::Create(ManifestJson, TEXT("application/json"));
        OnComplete(MoveTemp(Response));
    });
}
```

### Editor-Only Enforcement

The Editor module (`PillarsOfFortuneBridgeEditor`) uses `Type: EditorNoCommandlet` in the `.uplugin` descriptor. This ensures:

- The module is NOT loaded in packaged/shipping builds
- The module is NOT loaded during commandlet execution (cook, build automation)
- The HTTP server never runs outside the Editor

The runtime module (`PillarsOfFortuneBridge`) contains only data structures and is harmless in packaged builds, but can be changed to `Type: Editor` if zero footprint is required.

### Version Compatibility

**Target:** UE5 5.4+

Key API dependencies and their stability:

| API | Module | Stable Since | Notes |
|---|---|---|---|
| `IAssetRegistry` | AssetRegistry | UE 4.0 | Very stable, backward compatible |
| `FHttpServerModule` | HTTPServer | UE 5.0 | Stable in UE5 |
| `ILiveCodingModule` | LiveCoding | UE 5.0 | Stable, API rarely changes |
| `FBlueprintEditorUtils` | UnrealEd | UE 4.0 | Stable for introspection |
| `USCS_Node` (SimpleConstructionScript) | Engine | UE 4.0 | Stable |
| `FAutomationControllerModule` | AutomationController | UE 4.0 | Stable |
| `FViewport::ReadPixels` | RenderCore | UE 4.0 | Stable |

**Risk areas:**
- `ILiveCodingModule::Compile()` signature may change across UE5 minor versions. Use `#if ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 4` guards.
- `FHttpServerModule` route binding API changed slightly between 5.1 and 5.3. Test against target version.

### Performance

**Manifest generation:**
- Initial full scan: async, 2-5 seconds for ~1000 assets
- Does NOT block Editor startup -- manifest generation starts after `OnFilesLoaded`
- HTTP requests for manifest before generation completes return 503 with `retryAfterMs`
- Incremental updates: <50ms per asset (hash comparison is O(1) lookup)
- Disk flush: batched to at most once per second via `FTSTicker`

**Blueprint introspection:**
- Loading a Blueprint for introspection: 50-200ms per asset (depends on graph complexity)
- Introspection results are cached alongside the manifest entry
- Cache is invalidated only when the asset's content hash changes

**Snapshot capture:**
- Viewport capture: ~200ms per preset (render flush + pixel readback)
- PNG compression: ~100ms for 1920x1080
- Pixel diff comparison: ~50ms for two 1920x1080 images

**HTTP server:**
- Request handling latency: <10ms for cached responses (status, manifest)
- Concurrent requests: FHttpServerModule handles connection pooling internally
- Memory overhead: ~50MB for manifest of a large project (1000+ assets)

### Security

**Localhost binding:** The HTTP server binds to `127.0.0.1:30040`, rejecting connections from external interfaces. This is enforced at the socket level in `FHttpServerModule`.

**Optional auth token:** When configured, all requests must include `X-Pof-Auth-Token` header. The token is stored in `DefaultEngine.ini` (not checked into version control for project-specific configs, or in user-local `Saved/Config/`).

**CORS:** Only `http://localhost:3000` and `http://localhost:3001` origins are allowed. Configurable via `PofBridgeSettings`.

**No remote execution of arbitrary code:** The test runner only invokes `UFUNCTION`-marked functions on spawned actors. It cannot execute arbitrary C++ or Blueprint script. The compile endpoint only triggers Live Coding (the same as pressing Ctrl+Alt+F11 in the Editor).

**File system access:** The plugin only writes to `{ProjectRoot}/.pof/`. It does not read or write files outside this directory (except asset registry queries, which are read-only through UE5's API).

### Configuration

All plugin settings are exposed via `UPofBridgeSettings` (a `UDeveloperSettings` subclass), editable in Project Settings > Plugins > Pillars of Fortune Bridge:

```cpp
UCLASS(Config=Engine, DefaultConfig, meta=(DisplayName="Pillars of Fortune Bridge"))
class PILLARSOFFORTUNEBRIDGE_API UPofBridgeSettings : public UDeveloperSettings
{
    GENERATED_BODY()

public:
    /** HTTP server port (requires Editor restart to change) */
    UPROPERTY(Config, EditAnywhere, Category="Server", meta=(ClampMin=1024, ClampMax=65535))
    int32 ServerPort = 30040;

    /** Optional authentication token. Leave empty to disable auth. */
    UPROPERTY(Config, EditAnywhere, Category="Security")
    FString AuthToken;

    /** Allowed CORS origins (comma-separated) */
    UPROPERTY(Config, EditAnywhere, Category="Security")
    FString AllowedOrigins = TEXT("http://localhost:3000,http://localhost:3001");

    /** Enable automatic manifest regeneration on asset save */
    UPROPERTY(Config, EditAnywhere, Category="Manifest")
    bool bAutoRegenerateManifest = true;

    /** Maximum time between manifest disk flushes (seconds) */
    UPROPERTY(Config, EditAnywhere, Category="Manifest", meta=(ClampMin=0.5, ClampMax=30.0))
    float ManifestFlushIntervalSeconds = 1.0f;

    /** Heartbeat write interval for bridge-status.json (seconds) */
    UPROPERTY(Config, EditAnywhere, Category="Status", meta=(ClampMin=1.0, ClampMax=60.0))
    float HeartbeatIntervalSeconds = 5.0f;

    /** Default visual diff threshold (0.0 = exact match, 1.0 = all different) */
    UPROPERTY(Config, EditAnywhere, Category="Snapshots", meta=(ClampMin=0.0, ClampMax=1.0))
    float DefaultDiffThreshold = 0.02f;

    /** Default test execution timeout (seconds) */
    UPROPERTY(Config, EditAnywhere, Category="Testing", meta=(ClampMin=5.0, ClampMax=300.0))
    float DefaultTestTimeoutSeconds = 30.0f;
};
```

### Error Recovery

| Failure Scenario | Recovery |
|---|---|
| HTTP server fails to bind port 30040 | Log error, try ports 30041-30049, update `bridge-status.json` with actual port |
| Asset registry not ready at startup | Queue manifest generation for `OnFilesLoaded` delegate |
| Blueprint fails to load for introspection | Skip asset, log warning, mark as `"introspectionFailed": true` in manifest |
| PIE fails to start for test | Return error result with `PIE_START_FAILED` code |
| Test actor fails to spawn | Abort test, return result with spawn failure details |
| Live Coding module not available | Return `LIVE_CODING_DISABLED` error |
| Viewport capture returns empty bitmap | Retry once after 100ms tick; if still empty, return `SNAPSHOT_FAILED` |
| `.pof/` directory deleted while running | Re-create on next write operation |
| Editor crash during test | `bridge-status.json` heartbeat stops; PoF detects via stale timestamp |

### Logging

All plugin logging uses a dedicated category:

```cpp
DECLARE_LOG_CATEGORY_EXTERN(LogPofBridge, Log, All);
DEFINE_LOG_CATEGORY(LogPofBridge);
```

Log levels:
- `Log`: Normal operations (server started, manifest regenerated, test completed)
- `Warning`: Recoverable issues (asset introspection failed, port conflict resolved)
- `Error`: Unrecoverable issues (server failed to start, PIE crash during test)
- `Verbose`: Per-request HTTP logging, per-asset manifest updates (disabled by default)

Logs are also captured to `.pof/bridge-log.txt` (last 1000 lines, rotating) for PoF to read when troubleshooting connection issues.
