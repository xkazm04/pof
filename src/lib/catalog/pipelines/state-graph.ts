import { registerCatalogPipeline } from '../pipeline-registry';
import { minLength, fieldsPopulated, selected, minCount } from '../acceptance/dataCheckers';
import { graphValid } from '../acceptance/graphCheckers';
import { runtimeDeferred } from '../acceptance/deferred';
import { cppSymbolExists } from '../acceptance/ueStaticCheckers';
import type { LabEntity } from '@/components/layout-lab/useLabCatalogData';

const slug = (n: string) => n.replace(/[^a-z0-9]+/gi, '');

/**
 * State Graph pipeline (catalogId: 'state-graph').
 *
 * Represents a generic finite state machine (FSM) used across systems — player,
 * enemy AI, interactable actors (doors, levers), quest stages, and companion logic.
 * The pipeline is authored around an **enemy AI FSM** as the canonical exemplar
 * (Idle → Patrol → Chase → Attack → {Flee, Dead}) because it is the most
 * cross-cutting use-case: it reads the blackboard (perception/health), drives
 * anim-notify hooks, ties to the save system for persistence, and surfaces in
 * PIE automated testing.
 *
 * Target entity: "Enemy AI State Graph" — the FSM governing a standard melee
 * enemy NPC (e.g. the Brute archetype from the bestiary catalog).  States are
 * IDLE, PATROL, CHASE, ATTACK, FLEE, and DEAD.  Guards on edges read the
 * blackboard keys (TargetActor, HealthPct, AlertRadius) and map to UE StateTree
 * / BehaviorTree evaluation conditions.  DEAD is the sole persistent terminal
 * (once entered, the actor is destroyed/ragdolled and its state is not saved);
 * FLEE is a time-bounded recovery terminal (re-enters IDLE if health recovers
 * above the flee threshold, otherwise transitions to DEAD).
 *
 * UE asset mapping:
 *   StateTree asset:  ST_EnemyAI_<slug>  (UStateTreeComponent drives evaluation)
 *   BT fallback:      BT_EnemyAI_<slug>  (legacy BehaviorTree; StateTree is primary)
 *   Blackboard:       BB_EnemyAI_<slug>  (key set declared in Blackboard Schema step)
 *   Anim blueprint:   ABP_EnemyAI_<slug> (uses state tags for blend-space selection)
 *   DataTable row:    DT_StateGraphs :: <slug> (FARPGStateGraphRow for config)
 *   Seed script:      Content/Python/seed_state_graph.py
 *
 * Wiring: UStateTreeComponent on the enemy actor runs the StateTree asset.
 * Transitions read the BB keys set by UAISenseConfig_Sight and UAISenseConfig_Damage.
 * Hook points fire AnimNotify / GameplayEvent on state ENTER and EXIT events so VFX
 * (NS_), SFX (SC_), and anim-blends key off UStateTreeComponent state tags
 * (State.AI.<StateName>) — not imperative calls.  Persistence: state-graph rows
 * obey the arpg-save-semantics canon (ephemeral game-session data is NOT saved;
 * only discrete world-state mutations are — e.g. "boss defeated" tag).
 *
 * Top-level cross-catalog links:
 *   icon-sets::iconset-abilities  — source for the FSM icon art (role: 'icon-source')
 */
registerCatalogPipeline({
  catalogId: 'state-graph',
  steps: [
    // ── 1. Concept Brief ──────────────────────────────────────────────────────
    {
      archetype: 'brief',
      label: 'Concept Brief',
      view: { kind: 'prose', field: 'brief', emptyText: 'No brief yet' },
      produce: (e: LabEntity) => ({
        data: {
          brief:
            `${e.name} is a generic finite state machine driving AI decision-making for melee enemy ` +
            `archetypes in PoF.  The FSM governs six distinct behavioral states — Idle (passive roaming), ` +
            `Patrol (scripted waypoint traversal), Chase (detected player engagement), Attack (within melee ` +
            `range, executes montages), Flee (low-health retreat, bounded by a timer + health threshold), ` +
            `and Dead (terminal, triggers ragdoll + loot drop + world-state mutation).  ` +
            `Transitions are guard-conditioned against a typed blackboard (TargetActor, HealthPct, ` +
            `AlertRadius, AlertCooldown) evaluated by UStateTreeComponent each tick.  ` +
            `The FSM is the authoritative AI behavior source — BehaviorTree is a legacy fallback only. ` +
            `Hook points on state ENTER/EXIT fire AnimNotify-driven Niagara VFX, SFX cues, and blend-space ` +
            `switches so every sub-system keys off State.AI.* gameplay tags, never off imperative calls. ` +
            `Persistence: ephemeral session state (current state, patrol index) is discarded on session end; ` +
            `only discrete world-state mutations (State.Enemy.Defeated.<slug>) are written to the save ` +
            `game and respected on reload (per arpg-save-semantics canon).  ` +
            `UE asset: ST_EnemyAI_<slug> (StateTree), BB_EnemyAI_<slug> (Blackboard), ` +
            `ABP_EnemyAI_<slug> (AnimBP), seeded via seed_state_graph.py.`,
        },
      }),
      accept: minLength('brief', 'Brief ≥ 300 characters', 300),
    },

    // ── 2. State Graph ─────────────────────────────────────────────────────────
    // KEY STEP — archetype: 'graph', view: graph, accept: graphValid
    // FSM nodes: Idle (root) → Patrol → Chase → Attack → {Flee, Dead}
    // Guards on edges; DEAD is the hard terminal; FLEE is a recovery terminal.
    // graphValid enforces: no dangling edges, all nodes reachable from [0] (Idle),
    // and ≥1 terminal node.
    {
      archetype: 'graph',
      label: 'State Graph',
      view: { kind: 'graph', field: 'graph' },
      produce: () => ({
        data: {
          graph: {
            nodes: [
              // ── Root ────────────────────────────────────────────────────────
              {
                id: 'idle',
                label: 'IDLE — passive; no target; plays idle animation loop',
              },
              // ── Intermediate states ─────────────────────────────────────────
              {
                id: 'patrol',
                label: 'PATROL — waypoint traversal; alert radius active',
              },
              {
                id: 'chase',
                label: 'CHASE — target detected; close distance at run speed',
              },
              {
                id: 'attack',
                label: 'ATTACK — within melee range; execute attack montage sequence',
              },
              // ── Recovery terminal ───────────────────────────────────────────
              {
                id: 'flee',
                label: 'FLEE — HealthPct < 0.20; retreat and recover; re-enters IDLE or transitions to DEAD',
                terminal: true,
              },
              // ── Hard terminal ────────────────────────────────────────────────
              {
                id: 'dead',
                label: 'DEAD — HealthPct ≤ 0.0; ragdoll → loot drop → world-state mutation State.Enemy.Defeated',
                terminal: true,
              },
            ],
            edges: [
              // IDLE → PATROL: no target detected within AlertRadius for ≥5 s
              {
                from: 'idle',
                to: 'patrol',
                label: 'guard: TargetActor == null AND AlertCooldown > 5s',
              },
              // IDLE → CHASE: target detected (sight/damage sense)
              {
                from: 'idle',
                to: 'chase',
                label: 'guard: TargetActor != null AND TargetInAlertRadius == true',
              },
              // PATROL → IDLE: patrol complete (all waypoints visited)
              {
                from: 'patrol',
                to: 'idle',
                label: 'guard: WaypointQueueEmpty == true',
              },
              // PATROL → CHASE: player enters alert radius during patrol
              {
                from: 'patrol',
                to: 'chase',
                label: 'guard: TargetActor != null AND TargetInAlertRadius == true',
              },
              // CHASE → ATTACK: target is within melee range (≤ 150 cm)
              {
                from: 'chase',
                to: 'attack',
                label: 'guard: DistanceToTarget ≤ 150 cm',
              },
              // CHASE → FLEE: health drops below flee threshold while chasing
              {
                from: 'chase',
                to: 'flee',
                label: 'guard: HealthPct < 0.20',
              },
              // CHASE → IDLE: target lost (out of range > 800 cm, no LOS for 3 s)
              {
                from: 'chase',
                to: 'idle',
                label: 'guard: TargetActor == null AND NoLOSDuration > 3s',
              },
              // ATTACK → CHASE: target moved out of melee range during attack recovery
              {
                from: 'attack',
                to: 'chase',
                label: 'guard: DistanceToTarget > 150 cm AND HealthPct ≥ 0.20',
              },
              // ATTACK → FLEE: health falls below flee threshold mid-combat
              {
                from: 'attack',
                to: 'flee',
                label: 'guard: HealthPct < 0.20',
              },
              // ATTACK → DEAD: lethal hit received while attacking
              {
                from: 'attack',
                to: 'dead',
                label: 'guard: HealthPct ≤ 0.0',
              },
              // FLEE → IDLE: health recovered above recovery threshold (0.35) during flee
              {
                from: 'flee',
                to: 'idle',
                label: 'guard: HealthPct ≥ 0.35 AND FleeTimerExpired == false',
              },
              // FLEE → DEAD: flee timer expired OR health still ≤ 0 after regen attempt
              {
                from: 'flee',
                to: 'dead',
                label: 'guard: FleeTimerExpired == true OR HealthPct ≤ 0.0',
              },
            ],
            note:
              'Two terminals: FLEE (recovery — bounded; may return to IDLE if health recovers) + ' +
              'DEAD (hard — ragdoll, loot, world-state tag). ' +
              'All 6 nodes are reachable from IDLE[0]. ' +
              'graphValid: 6 nodes, 13 edges, no dangling edges. ' +
              'Guards read UStateTreeComponent blackboard keys evaluated each StateTree tick. ' +
              'Wiring: UStateTreeComponent on AARPGEnemyCharacter owns the ST_EnemyAI asset; ' +
              'DEAD terminal fires GameplayEvent Ability.Enemy.Defeated → UARPGLootDropComponent executes drop + ' +
              'AARPGWorldStateComponent writes State.Enemy.Defeated.<slug> tag.',
          },
          wiringContract: {
            grantedBy:
              'UStateTreeComponent (on AARPGEnemyCharacter) owns ST_EnemyAI_<slug> asset. ' +
              'The StateTree evaluates transition guards against BB_EnemyAI_<slug> blackboard ' +
              'keys updated by UAISenseConfig_Sight and UAISenseConfig_Damage perception services.',
            activatedBy:
              'AARPGEnemyCharacter::BeginPlay → UStateTreeComponent.StartLogic() → enters IDLE state. ' +
              'Perception hits (sight/damage) write TargetActor + TargetInAlertRadius blackboard keys; ' +
              'health changes write HealthPct; timer services write AlertCooldown / FleeTimerExpired.',
            dependencies: [
              'bestiary (enemy actor class AARPGEnemyCharacter — host of UStateTreeComponent)',
              'loot-tables (UARPGLootDropComponent — triggered on DEAD terminal)',
            ],
            verification:
              'L2: UStateTreeComponent declared in Source/PoF/ + ST_EnemyAI seeded via seed_state_graph.py; ' +
              'L3: VSStateGraphTest — no deadlock, all 6 states reachable in PIE, ' +
              'DEAD terminal fires loot drop + world-state tag (deferred)',
          },
        },
      }),
      accept: graphValid('graph', 'States reachable + ≥1 terminal'),
    },

    // ── 3. Blackboard Schema ──────────────────────────────────────────────────
    // The typed keys the FSM reads when evaluating edge guards.
    {
      archetype: 'schema',
      label: 'Blackboard Schema',
      view: {
        kind: 'table',
        field: 'blackboard',
        columns: [{ key: 'key' }, { key: 'type' }, { key: 'updatedBy' }, { key: 'usedBy' }],
      },
      produce: () => ({
        data: {
          blackboard: [
            {
              key: 'TargetActor',
              type: 'Object (AActor*)',
              updatedBy: 'UAISenseConfig_Sight on perception hit/loss',
              usedBy: 'IDLE→CHASE, PATROL→CHASE, CHASE→IDLE guard conditions',
            },
            {
              key: 'TargetInAlertRadius',
              type: 'Bool',
              updatedBy: 'UAISenseConfig_Sight (within 800 cm cone, 90° FOV)',
              usedBy: 'IDLE→CHASE, PATROL→CHASE',
            },
            {
              key: 'DistanceToTarget',
              type: 'Float (cm)',
              updatedBy: 'StateTree service task (USTService_UpdateDistanceToTarget) each tick',
              usedBy: 'CHASE→ATTACK (≤150 cm), ATTACK→CHASE (>150 cm)',
            },
            {
              key: 'HealthPct',
              type: 'Float (0.0–1.0)',
              updatedBy:
                'UARPGAttributeSet health change callback → writes HealthPct = CurrentHealth / MaxHealth',
              usedBy: 'CHASE→FLEE (<0.20), ATTACK→FLEE (<0.20), ATTACK→DEAD (≤0.0), FLEE→DEAD (≤0.0), FLEE→IDLE (≥0.35)',
            },
            {
              key: 'AlertCooldown',
              type: 'Float (seconds)',
              updatedBy: 'StateTree timer service (USTService_AlertCooldown); resets on IDLE entry',
              usedBy: 'IDLE→PATROL (≥5 s with no target)',
            },
            {
              key: 'WaypointQueueEmpty',
              type: 'Bool',
              updatedBy:
                'UARPGPatrolComponent — sets true when last waypoint reached and no loop configured',
              usedBy: 'PATROL→IDLE',
            },
            {
              key: 'NoLOSDuration',
              type: 'Float (seconds)',
              updatedBy:
                'StateTree service (USTService_LOSTracker); counts seconds without line-of-sight to TargetActor',
              usedBy: 'CHASE→IDLE (>3 s with no target + no LOS)',
            },
            {
              key: 'FleeTimerExpired',
              type: 'Bool',
              updatedBy:
                'StateTree timer task (USTTask_FleeTimer, 8 s); set true on expiry during FLEE state',
              usedBy: 'FLEE→DEAD',
            },
          ],
          wiringContract: {
            grantedBy:
              'BB_EnemyAI_<slug> BlackboardData asset; keys initialised on UStateTreeComponent.StartLogic(). ' +
              'Typed keys (not string lookups) — all reads use const FName keys compiled in USTTask/USTService headers.',
            activatedBy:
              'UStateTreeComponent reads blackboard each evaluation tick; ' +
              'perception + health callbacks write asynchronously via delegate binding on BeginPlay.',
            dependencies: [
              'bestiary (AARPGEnemyCharacter — host actor; UARPGAttributeSet — HealthPct source)',
            ],
            verification:
              'L2: BB_EnemyAI_<slug> asset seeded via seed_state_graph.py; ' +
              'USTService_UpdateDistanceToTarget + USTService_LOSTracker declared in Source/PoF/; ' +
              'L3: VSStateGraphTest — all 8 BB keys written before first state transition (deferred)',
          },
        },
      }),
      accept: minCount('blackboard', '≥7 blackboard keys declared', 7),
    },

    // ── 4. Transition Rules ────────────────────────────────────────────────────
    // Guard conditions on each edge, mapped to UStateTree condition types.
    {
      archetype: 'rules',
      label: 'Transition Rules',
      view: {
        kind: 'table',
        field: 'transitions',
        columns: [{ key: 'from' }, { key: 'to' }, { key: 'guard' }, { key: 'ueConditionType' }],
      },
      produce: () => ({
        data: {
          transitions: [
            {
              from: 'idle',
              to: 'patrol',
              guard: 'TargetActor == null AND AlertCooldown ≥ 5 s',
              ueConditionType:
                'FAICondition_IsNull(TargetActor) AND FSTCondition_TimerExpired(AlertCooldown, 5.0)',
              priority: 'low — runs background patrol only when truly idle',
            },
            {
              from: 'idle',
              to: 'chase',
              guard: 'TargetActor != null AND TargetInAlertRadius == true',
              ueConditionType:
                'FAICondition_IsNotNull(TargetActor) AND FAICondition_BBBool(TargetInAlertRadius, true)',
              priority: 'high — immediate; overrides patrol check',
            },
            {
              from: 'patrol',
              to: 'idle',
              guard: 'WaypointQueueEmpty == true',
              ueConditionType: 'FAICondition_BBBool(WaypointQueueEmpty, true)',
              priority: 'normal',
            },
            {
              from: 'patrol',
              to: 'chase',
              guard: 'TargetActor != null AND TargetInAlertRadius == true',
              ueConditionType:
                'FAICondition_IsNotNull(TargetActor) AND FAICondition_BBBool(TargetInAlertRadius, true)',
              priority: 'high — interrupts patrol immediately',
            },
            {
              from: 'chase',
              to: 'attack',
              guard: 'DistanceToTarget ≤ 150 cm',
              ueConditionType: 'FAICondition_BBFloat_LessEqual(DistanceToTarget, 150.0)',
              priority: 'high',
            },
            {
              from: 'chase',
              to: 'flee',
              guard: 'HealthPct < 0.20',
              ueConditionType: 'FAICondition_BBFloat_Less(HealthPct, 0.20)',
              priority: 'critical — checked before chase→attack',
            },
            {
              from: 'chase',
              to: 'idle',
              guard: 'TargetActor == null AND NoLOSDuration > 3 s',
              ueConditionType:
                'FAICondition_IsNull(TargetActor) AND FSTCondition_TimerExpired(NoLOSDuration, 3.0)',
              priority: 'normal — gives up pursuit after 3 s out of LOS',
            },
            {
              from: 'attack',
              to: 'chase',
              guard: 'DistanceToTarget > 150 cm AND HealthPct ≥ 0.20',
              ueConditionType:
                'FAICondition_BBFloat_Greater(DistanceToTarget, 150.0) AND FAICondition_BBFloat_GreaterEqual(HealthPct, 0.20)',
              priority: 'normal — re-closes gap after target kites',
            },
            {
              from: 'attack',
              to: 'flee',
              guard: 'HealthPct < 0.20',
              ueConditionType: 'FAICondition_BBFloat_Less(HealthPct, 0.20)',
              priority: 'critical — checked every tick during ATTACK',
            },
            {
              from: 'attack',
              to: 'dead',
              guard: 'HealthPct ≤ 0.0',
              ueConditionType: 'FAICondition_BBFloat_LessEqual(HealthPct, 0.0)',
              priority: 'immediate — lethal hit',
            },
            {
              from: 'flee',
              to: 'idle',
              guard: 'HealthPct ≥ 0.35 AND FleeTimerExpired == false',
              ueConditionType:
                'FAICondition_BBFloat_GreaterEqual(HealthPct, 0.35) AND FAICondition_BBBool(FleeTimerExpired, false)',
              priority: 'recovery path — regen must outpace damage during flee',
            },
            {
              from: 'flee',
              to: 'dead',
              guard: 'FleeTimerExpired == true OR HealthPct ≤ 0.0',
              ueConditionType:
                'FAICondition_BBBool(FleeTimerExpired, true) OR FAICondition_BBFloat_LessEqual(HealthPct, 0.0)',
              priority: 'terminal — flee fails; die',
            },
          ],
          evaluationModel:
            'Guards are evaluated top-down within each state; first matching guard wins (priority order). ' +
            'UStateTreeComponent evaluates the active state\'s transitions on every AI tick (default 0.1 s for enemies). ' +
            'Health-change transitions (→FLEE, →DEAD) are event-driven (UARPGAttributeSet health callback) ' +
            'AND tick-evaluated for safety — whichever fires first wins.',
          wiringContract: {
            grantedBy:
              'FARPGStateGraphRow.Transitions[] in DT_StateGraphs; each entry maps to a UStateTreeCondition ' +
              'class and a blackboard key reference seeded via seed_state_graph.py.',
            activatedBy:
              'UStateTreeComponent evaluation loop; health-driven transitions also fire via ' +
              'UARPGAttributeSet.OnHealthChanged delegate → USTTask_WriteHealthPct task.',
            dependencies: [
              'bestiary (AARPGEnemyCharacter — blackboard owner + attribute set)',
            ],
            verification:
              'L2: FARPGStateGraphRow declared in Source/PoF/; ' +
              'L3: VSStateGraphTest — all 12 transitions exercised in automated walk (deferred)',
          },
        },
      }),
      accept: minCount('transitions', '≥6 transition rules declared', 6),
    },

    // ── 5. Hook Points ─────────────────────────────────────────────────────────
    // VFX / SFX / anim-notify bindings on state ENTER and EXIT events.
    {
      archetype: 'rules',
      label: 'Hook Points',
      view: {
        kind: 'table',
        field: 'hooks',
        columns: [{ key: 'state' }, { key: 'event' }, { key: 'type' }, { key: 'binding' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          hooks: [
            // IDLE hooks
            {
              state: 'idle',
              event: 'ENTER',
              type: 'AnimBP',
              binding: 'ABP_EnemyAI: State.AI.Idle tag → blend-space IdleBS (ambient sway)',
            },
            // PATROL hooks
            {
              state: 'patrol',
              event: 'ENTER',
              type: 'AnimBP',
              binding: 'ABP_EnemyAI: State.AI.Patrol tag → walk blend-space WalkBS (move speed 250 cm/s)',
            },
            // CHASE hooks
            {
              state: 'chase',
              event: 'ENTER',
              type: 'AnimBP + SFX',
              binding:
                'ABP_EnemyAI: State.AI.Chase tag → run blend-space RunBS (move speed 500 cm/s); ' +
                `SC_${slug(e.name)}_Alert plays once on ENTER (enemy "spotted" audio cue)`,
            },
            // ATTACK hooks
            {
              state: 'attack',
              event: 'ENTER',
              type: 'AnimNotify',
              binding:
                'AnimNotify AN_HitDetect fires on attack montage frame 0.3 s → UARPGMeleeComponent.EnableHit(); ' +
                'AnimNotify AN_ComboWindow fires at frame 0.6 s → enables combo input buffer',
            },
            {
              state: 'attack',
              event: 'ENTER',
              type: 'VFX',
              binding: `NS_${slug(e.name)}_AttackTrail attached to weapon socket; activated by AN_HitDetect notify`,
            },
            {
              state: 'attack',
              event: 'EXIT',
              type: 'AnimNotify',
              binding: 'AnimNotify AN_HitDetectEnd fires at montage end → UARPGMeleeComponent.DisableHit()',
            },
            // FLEE hooks
            {
              state: 'flee',
              event: 'ENTER',
              type: 'AnimBP + VFX + SFX',
              binding:
                'ABP_EnemyAI: State.AI.Flee tag → flee-run blend-space FleeBS; ' +
                `NS_${slug(e.name)}_LowHealthAura activated (red pulsing rim-light, per art-vfx canon); ` +
                `SC_${slug(e.name)}_Flee plays once on ENTER (enemy vocalization)`,
            },
            {
              state: 'flee',
              event: 'EXIT',
              type: 'VFX',
              binding: `NS_${slug(e.name)}_LowHealthAura deactivated on EXIT (to prevent aura persisting after recovery to IDLE)`,
            },
            // DEAD hooks
            {
              state: 'dead',
              event: 'ENTER',
              type: 'AnimNotify + VFX + SFX',
              binding:
                'Death montage AM_Death plays (ragdoll blend at frame end); ' +
                `NS_${slug(e.name)}_DeathBurst fires once at ENTER (particle burst, ≤0.48 ms GPU per art-vfx); ` +
                `SC_${slug(e.name)}_Death plays once; ` +
                'GameplayEvent Ability.Enemy.Defeated fired → UARPGLootDropComponent.ExecuteDrop()',
            },
          ],
          hookModel:
            'All hooks key off State.AI.* gameplay tags applied by UStateTreeComponent on state entry/exit. ' +
            'AnimBP reads the active tag set via GetOwnedGameplayTags() each animation tick. ' +
            'VFX Niagara systems are spawned/destroyed by UARPGVFXComponent, not directly by the StateTree task — ' +
            'UARPGVFXComponent listens for OnGameplayTagAdded/Removed events (art-vfx canon: never BeginPlay/timer). ' +
            'SFX cues are triggered via UARPGAudioComponent.PlayCueForTag(State.AI.*).',
          wiringContract: {
            grantedBy:
              `UStateTreeComponent applies State.AI.<StateName> tags on entry/exit via USTTask_ApplyStateTag. ` +
              `UARPGVFXComponent + UARPGAudioComponent (both on AARPGEnemyCharacter) listen for tag events.`,
            activatedBy:
              'State ENTER: USTTask_ApplyStateTag adds State.AI.<StateName>; listeners fire. ' +
              'State EXIT: USTTask_RemoveStateTag removes it; Niagara/audio components deactivate.',
            dependencies: [
              'bestiary (AARPGEnemyCharacter — component host)',
              'vfx (NS_ assets: AttackTrail, LowHealthAura, DeathBurst)',
            ],
            verification:
              `L2: USTTask_ApplyStateTag + UARPGVFXComponent declared in Source/PoF/; ` +
              `L3: VSStateGraphTest — State.AI.Chase tag present during CHASE, NS_${slug(e.name)}_DeathBurst fires on DEAD (deferred)`,
          },
        },
      }),
      accept: minCount('hooks', '≥5 hook points declared', 5),
    },

    // ── 6. Persistence ─────────────────────────────────────────────────────────
    // What state saves/migrates, tied to arpg-save-semantics.
    {
      archetype: 'rules',
      label: 'Persistence',
      view: {
        kind: 'table',
        field: 'persistence',
        columns: [{ key: 'field' }, { key: 'saved' }, { key: 'rationale' }],
      },
      produce: (e: LabEntity) => ({
        data: {
          persistence: {
            currentState: {
              field: 'CurrentState (enum: IDLE/PATROL/CHASE/ATTACK/FLEE/DEAD)',
              saved: false,
              rationale:
                'Ephemeral session data — enemy re-spawns from IDLE on next session load. ' +
                'Saving transient AI state would cause unexpected post-load combat behavior ' +
                '(canon: session-transient data is discarded, only discrete world-state mutations persist).',
            },
            patrolIndex: {
              field: 'CurrentPatrolIndex (int)',
              saved: false,
              rationale:
                'Patrol waypoint index is ephemeral — patrol restarts from waypoint 0 on reload. ' +
                'Consistent with PoE-style checkpoint design: enemy positions reset on area re-entry.',
            },
            blackboardKeys: {
              field: 'All BB keys (TargetActor, HealthPct, etc.)',
              saved: false,
              rationale:
                'All blackboard keys are runtime-derived (perception + health callbacks) — ' +
                'they are re-populated from attributes + AI sense config on BeginPlay. No serialization needed.',
            },
            defeatedTag: {
              field: 'State.Enemy.Defeated.<slug> gameplay tag (world-state mutation)',
              saved: true,
              rationale:
                `Discrete world-state mutation written by AARPGWorldStateComponent when DEAD terminal is reached. ` +
                `Persisted via the ARPG save game (USaveGame subclass ARPGWorldStateSave). ` +
                `On reload, if State.Enemy.Defeated.${slug(e.name)} is present, the enemy actor is not spawned ` +
                `(or spawned as a corpse prop for narrative clarity). ` +
                `This is the only saved field — consistent with arpg-wiring-contract canon (only world-state mutations persist).`,
            },
            migrationNote: {
              field: 'Save migration',
              saved: 'N/A',
              rationale:
                'No migration needed for the defeated tag — it is a raw gameplay tag string; ' +
                'new tags added in future patches are simply absent on old saves (not a blocker). ' +
                'If the slug changes (entity rename), a save-migration map in ARPGWorldStateSave handles tag renames.',
            },
          },
          wiringContract: {
            grantedBy:
              'AARPGWorldStateComponent.ApplyMutation() writes the defeated tag on DEAD terminal. ' +
              'ARPGWorldStateSave.TagSet TArray<FGameplayTag> is serialised via standard UE SaveGame.',
            activatedBy:
              'USTTask_WriteDead task in the DEAD state: fires GameplayEvent Ability.Enemy.Defeated → ' +
              'AARPGWorldStateComponent.ApplyMutation(State.Enemy.Defeated.<slug>).',
            dependencies: [
              'bestiary (AARPGEnemyCharacter — actor spawner checks the defeated tag on BeginPlay)',
            ],
            verification:
              'L2: AARPGWorldStateComponent + ARPGWorldStateSave declared in Source/PoF/; ' +
              'L3: VSStateGraphTest — save/reload with defeated tag suppresses enemy re-spawn (deferred)',
          },
        },
      }),
      accept: fieldsPopulated('persistence', 'currentState / patrolIndex / defeatedTag fields present', [
        'currentState',
        'patrolIndex',
        'defeatedTag',
      ]),
    },

    // ── 7. Icon 2D Art ────────────────────────────────────────────────────────
    // Universal Icon step — every row includes this.
    // Bound to icon-sets::iconset-abilities (shared ability/character/generic icon family).
    {
      archetype: 'gallery',
      label: 'Icon 2D Art',
      view: { kind: 'gallery', field: 'selected', candidates: 4 },
      produce: (e: LabEntity) => ({
        data: { selected: 0 },
        links: [
          { catalogId: 'icon-sets', entityId: 'iconset-abilities', role: 'icon-source' },
        ],
        ueAssets: [`/Game/UI/Icons/T_${slug(e.name)}_StateGraphIcon`],
      }),
      accept: selected('selected', 'A state graph icon is selected'),
    },

    // ── 8. Test Gate ──────────────────────────────────────────────────────────
    {
      archetype: 'checklist',
      label: 'Test Gate',
      view: { kind: 'checklist', field: 'checks' },
      produce: () => ({
        data: {
          checks: [
            'enemy spawns in IDLE state; UStateTreeComponent.StartLogic() called on BeginPlay',
            'IDLE→PATROL transitions when no target and AlertCooldown ≥ 5 s',
            'IDLE→CHASE transitions on sight perception hit (TargetActor populated)',
            'PATROL→CHASE transitions on perception hit during waypoint traversal',
            'CHASE→ATTACK transitions when DistanceToTarget ≤ 150 cm',
            'CHASE→FLEE transitions when HealthPct drops below 0.20 (no deadlock)',
            'ATTACK→DEAD transitions on HealthPct ≤ 0.0 (lethal hit)',
            'FLEE→IDLE transitions when HealthPct recovers to ≥ 0.35 before FleeTimerExpired',
            'FLEE→DEAD transitions when FleeTimerExpired == true',
            'all 6 states reachable from IDLE in automated state-coverage walk',
            'no deadlock: no state is a sink with outgoing transitions that can never fire',
            'DEAD terminal: loot drop fires (UARPGLootDropComponent.ExecuteDrop() called)',
            'DEAD terminal: State.Enemy.Defeated.<slug> tag written to AARPGWorldStateComponent',
            'reload after DEAD: enemy actor not re-spawned (defeated tag respected on BeginPlay)',
            'State.AI.* tags correctly applied/removed on each state transition (hook points fire)',
          ],
        },
      }),
      accept: runtimeDeferred('VSStateGraphTest', 'No deadlock + all states reachable in PIE'),
    },

    // ── 9. UE Packaging ───────────────────────────────────────────────────────
    // Wiring contract per arpg-wiring-contract canon.
    {
      archetype: 'manifest',
      label: 'UE Packaging',
      view: { kind: 'manifest', field: 'assets' },
      produce: (e: LabEntity) => {
        const s = slug(e.name);
        const assets = [
          `ST_EnemyAI_${s}`,
          `BB_EnemyAI_${s}`,
          `BT_EnemyAI_${s}`,
          `ABP_EnemyAI_${s}`,
          `DT_StateGraphs :: ${s}`,
          `T_${s}_StateGraphIcon`,
        ];
        return {
          data: {
            assets,
            wiringContract: {
              grantedBy:
                `UStateTreeComponent (on AARPGEnemyCharacter) owns ST_EnemyAI_${s}. ` +
                `BB_EnemyAI_${s} BlackboardData asset holds the 8 typed keys. ` +
                `DT_StateGraphs row "${e.id}" (FARPGStateGraphRow) declares asset path + defeated-tag name. ` +
                `Seeded via Content/Python/seed_state_graph.py.`,
              activatedBy:
                `AARPGEnemyCharacter::BeginPlay → UStateTreeComponent.StartLogic() → ST_EnemyAI_${s} begins evaluation. ` +
                `Perception services start writing blackboard keys; ` +
                `UARPGAttributeSet.OnHealthChanged delegate writes HealthPct. ` +
                `DEAD terminal fires GameplayEvent Ability.Enemy.Defeated → ` +
                `UARPGLootDropComponent.ExecuteDrop() + AARPGWorldStateComponent.ApplyMutation(State.Enemy.Defeated.${s}).`,
              dependencies: [
                'bestiary (AARPGEnemyCharacter — actor host; UARPGAttributeSet — HealthPct)',
                'loot-tables (UARPGLootDropComponent — fires on DEAD terminal)',
                'icon-sets (iconset-abilities — source icon family)',
              ],
              verification:
                `L2: FARPGStateGraphRow in Source/PoF/ + DT_StateGraphs seeded via seed_state_graph.py + ` +
                `UStateTreeComponent.cpp compiled (or UStateTreeComponent is a UE5 engine component — confirm linkage); ` +
                `L3: VSStateGraphTest — no deadlock, all 6 states reachable, DEAD fires drop + world-state tag (deferred)`,
            },
          },
          ueAssets: assets.map((a) => `/Game/AI/StateGraph/${s}/${a}`),
        };
      },
      accept: minCount('assets', '≥4 UE state-graph assets packaged', 4),
      staticChecks: () => [
        cppSymbolExists('UStateTreeComponent', 'StateTree component present in UE Source (engine or project)'),
      ],
    },
  ],
});
