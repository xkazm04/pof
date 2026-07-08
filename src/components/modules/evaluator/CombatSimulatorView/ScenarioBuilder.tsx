import { Target } from 'lucide-react';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { NumberField } from '@/components/ui/NumberField';
import type {
  GearLoadout,
  CombatAbility,
  EnemyArchetype,
} from '@/types/combat-simulator';
import { ABILITY_GROUPS } from './constants';

// ── Scenario Builder ────────────────────────────────────────────────────────

export function ScenarioBuilder({
  playerLevel, setPlayerLevel, gearId, setGearId, gearLoadouts,
  selectedAbilities, setSelectedAbilities, abilities,
  enemySetup, setEnemySetup, enemyArchetypes,
  iterations, setIterations,
}: {
  playerLevel: number;
  setPlayerLevel: (v: number) => void;
  gearId: string;
  setGearId: (v: string) => void;
  gearLoadouts: GearLoadout[];
  selectedAbilities: string[];
  setSelectedAbilities: (v: string[]) => void;
  abilities: CombatAbility[];
  enemySetup: { archetypeId: string; count: number; level: number }[];
  setEnemySetup: (v: typeof enemySetup) => void;
  enemyArchetypes: EnemyArchetype[];
  iterations: number;
  setIterations: (v: number) => void;
}) {
  const toggleAbility = (id: string) =>
    setSelectedAbilities(
      selectedAbilities.includes(id)
        ? selectedAbilities.filter((x) => x !== id)
        : [...selectedAbilities, id],
    );

  return (
    <SurfaceCard className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-cyan-400" />
        <h2 className="text-sm font-medium text-text">Scenario</h2>
      </div>

      <div className="space-y-3">
        {/* Player config */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="text-2xs text-text-muted font-medium block mb-1">Player Level</label>
            <NumberField
              value={playerLevel}
              min={1}
              max={50}
              fallback={1}
              onChange={setPlayerLevel}
              ariaLabel="Player level"
              className="w-full px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-status-red-strong"
            />
          </div>
          <div>
            <label className="text-2xs text-text-muted font-medium block mb-1">Gear</label>
            <select
              value={gearId}
              onChange={(e) => setGearId(e.target.value)}
              className="w-full px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-status-red-strong cursor-pointer"
            >
              {gearLoadouts.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-2xs text-text-muted font-medium block mb-1">Iterations</label>
            <NumberField
              value={iterations}
              min={100}
              max={5000}
              fallback={1000}
              step={100}
              onChange={setIterations}
              ariaLabel="Simulation iterations"
              className="w-full px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text focus:outline-none focus:border-status-red-strong"
            />
          </div>
        </div>

        {/* Abilities */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-2xs text-text-muted font-medium">
              Abilities <span className="text-cyan-400">({selectedAbilities.length}/{abilities.length})</span>
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSelectedAbilities(abilities.map((a) => a.id))}
                disabled={selectedAbilities.length === abilities.length}
                className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedAbilities([])}
                disabled={selectedAbilities.length === 0}
                className="px-1.5 py-0.5 rounded text-2xs text-text-muted hover:text-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            {ABILITY_GROUPS.map(({ type, label }) => {
              const group = abilities.filter((a) => a.type === type);
              if (group.length === 0) return null;
              const groupIds = group.map((a) => a.id);
              const selectedInGroup = groupIds.filter((id) => selectedAbilities.includes(id)).length;
              const allSelected = selectedInGroup === group.length;
              return (
                <div key={type}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedAbilities(
                          allSelected
                            ? selectedAbilities.filter((id) => !groupIds.includes(id))
                            : [...new Set([...selectedAbilities, ...groupIds])],
                        )
                      }
                      className="text-[10px] uppercase tracking-wide font-semibold text-text-muted/70 hover:text-text transition-colors"
                      title={allSelected ? `Clear all ${label}` : `Select all ${label}`}
                    >
                      {label}
                    </button>
                    <span className="text-[10px] text-text-muted/50">{selectedInGroup}/{group.length}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {group.map((a) => (
                      <button
                        key={a.id}
                        onClick={() => toggleAbility(a.id)}
                        className={`px-2 py-0.5 rounded text-2xs font-medium border transition-colors ${
                          selectedAbilities.includes(a.id)
                            ? 'bg-cyan-500/15 border-cyan-500/30 text-cyan-400'
                            : 'bg-surface border-border text-text-muted hover:text-text'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Enemy setup */}
        <div>
          <label className="text-2xs text-text-muted font-medium block mb-1">Enemies</label>
          <div className="space-y-1.5">
            {enemySetup.map((entry, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={entry.archetypeId}
                  onChange={(e) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], archetypeId: e.target.value };
                    setEnemySetup(next);
                  }}
                  aria-label={`Enemy group ${i + 1} archetype`}
                  className="flex-1 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text cursor-pointer"
                >
                  {enemyArchetypes.map((arch) => (
                    <option key={arch.id} value={arch.id}>{arch.name}</option>
                  ))}
                </select>
                <span className="text-2xs text-text-muted">×</span>
                <NumberField
                  value={entry.count}
                  min={1}
                  max={10}
                  fallback={1}
                  onChange={(count) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], count };
                    setEnemySetup(next);
                  }}
                  ariaLabel={`Enemy group ${i + 1} count`}
                  className="w-12 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text text-center"
                />
                <span className="text-2xs text-text-muted">Lvl</span>
                <NumberField
                  value={entry.level}
                  min={1}
                  max={50}
                  fallback={1}
                  onChange={(level) => {
                    const next = [...enemySetup];
                    next[i] = { ...next[i], level };
                    setEnemySetup(next);
                  }}
                  ariaLabel={`Enemy group ${i + 1} level`}
                  className="w-12 px-2 py-1 bg-surface border border-border rounded-lg text-xs text-text text-center"
                />
                {enemySetup.length > 1 && (
                  <button
                    onClick={() => setEnemySetup(enemySetup.filter((_, j) => j !== i))}
                    className="text-2xs text-text-muted hover:text-red-400 transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setEnemySetup([...enemySetup, { archetypeId: 'melee-grunt', count: 1, level: playerLevel }])}
              className="text-2xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              + Add enemy group
            </button>
          </div>
        </div>
      </div>
    </SurfaceCard>
  );
}
