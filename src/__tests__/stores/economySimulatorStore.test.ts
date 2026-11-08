/**
 * economySimulatorStore — generated code belongs to the run it was generated from.
 *
 * `runSimulation` replaced result/metrics/alerts/drift but left `codeGenResult` in place, so
 * EconomyCodeGenPanel kept showing files (and the "Max Level" footer) from the PREVIOUS run under
 * a new one. A codegen still in flight when a new run started also landed afterwards. A new
 * simulation now clears the generated code and invalidates any in-flight generate.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useEconomySimulatorStore } from '@/stores/economySimulatorStore';
import type { SimulationConfig, SimulationResult } from '@/types/economy-simulator';
import type { CodeGenResult } from '@/lib/economy/codegen';

const config = { agentCount: 5, maxLevel: 10, maxPlayHours: 5, philosophy: 'loot-driven', seed: 1 } as SimulationConfig;
const result = { config, metrics: [], alerts: [], supplyDemand: [] } as unknown as SimulationResult;
const code = { files: [], generatedAt: 'x' } as unknown as CodeGenResult;

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

beforeEach(() => {
  useEconomySimulatorStore.setState({ result: null, config: null, codeGenResult: null, isGenerating: false, isSimulating: false, error: null, baselineRun: null });
});

describe('economySimulatorStore — codegen follows the run', () => {
  it('a new simulation clears the previous run\'s generated code', async () => {
    useEconomySimulatorStore.setState({ result, config, codeGenResult: code });
    globalThis.fetch = vi.fn().mockResolvedValue(ok({ result })) as unknown as typeof fetch;

    await useEconomySimulatorStore.getState().runSimulation({ ...config, maxLevel: 20 });

    expect(useEconomySimulatorStore.getState().codeGenResult).toBeNull();
  });

  it('a generate still in flight when a new simulation starts does not land', async () => {
    useEconomySimulatorStore.setState({ result, config });
    let releaseGen!: () => void;
    globalThis.fetch = vi.fn((_url: string, init?: RequestInit) => {
      const action = JSON.parse(String(init?.body ?? '{}')).action;
      if (action === 'generate-code') return new Promise((r) => { releaseGen = () => r(ok(code)); });
      return Promise.resolve(ok({ result }));
    }) as unknown as typeof fetch;

    const gen = useEconomySimulatorStore.getState().generateCode();
    await useEconomySimulatorStore.getState().runSimulation({ ...config, maxLevel: 20 });
    releaseGen();
    await gen;

    const s = useEconomySimulatorStore.getState();
    expect(s.codeGenResult).toBeNull();
    expect(s.isGenerating).toBe(false);
  });
});
