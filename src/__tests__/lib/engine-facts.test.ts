import { describe, it, expect } from 'vitest';
import { getEngineFacts, DEFAULT_UE_VERSION } from '@/lib/engine-facts';
import { getModuleDomainContext, getRequiredMSVCVersion } from '@/lib/prompt-context';
import { buildMaterialConfiguratorPrompt } from '@/lib/prompts/material-configurator';
import type { ProjectContext } from '@/lib/prompt-context';
import type { MaterialConfiguratorConfig } from '@/components/modules/content/materials/MaterialParameterConfigurator';

const MATERIAL_CONFIG: MaterialConfiguratorConfig = {
  surfaceType: 'metal',
  features: ['tessellation'],
  outputType: 'master',
  params: { roughness: { name: 'Roughness', min: 0, max: 1, defaultValue: 0.35, step: 0.01 } },
};

function ctxFor(ueVersion: string): ProjectContext {
  return { projectName: 'PoF', projectPath: 'C:\\proj\\PoF', ueVersion };
}

describe('engine facts are version-keyed', () => {
  it('defaults to the version the project store starts on', () => {
    expect(getEngineFacts(DEFAULT_UE_VERSION).version).toBe('5.8');
  });

  it('resolves 5.7 and 5.8 to distinct records, and 5.9+ forward to the newest', () => {
    expect(getEngineFacts('5.7.2').version).toBe('5.7');
    expect(getEngineFacts('5.8.0').version).toBe('5.8');
    // A newer minor must NOT fall back to older framing.
    expect(getEngineFacts('5.9.0').version).toBe('5.8');
  });

  it('throws loudly on a non-UE5 major or an unparseable version', () => {
    expect(() => getEngineFacts('6.0')).toThrow(/unsupported UE major/);
    expect(() => getEngineFacts('4.27')).toThrow(/unsupported UE major/);
    expect(() => getEngineFacts('abc')).toThrow(/unparseable/);
  });

  describe('MSVC toolchain', () => {
    it('has an EXPLICIT 5.8 branch (not a >= 5.7 catch-all)', () => {
      // Ground truth from the installed engine's UBT config
      // (<UE_5.8>/Engine/Config/Windows/Windows_SDK.json): MinimumVisualCppVersion
      // is 14.38.33130, but 14.39–14.43 and pre-14.44.35211 are BANNED and
      // PreferredVisualCppVersions is 14.44.35207+ / 14.50.35717+. 14.44 is the
      // lowest family that is both allowed and preferred.
      expect(getEngineFacts('5.8.0').msvc).toBe('14.44');
      expect(getEngineFacts('5.8').msvc).toBe('14.44');
      // The branch is real: 5.8 resolves through its own record, not 5.7's.
      expect(getEngineFacts('5.8').version).not.toBe(getEngineFacts('5.7').version);
    });

    it('keeps the historical mapping for older engines', () => {
      expect(getRequiredMSVCVersion('5.7')).toBe('14.44');
      expect(getRequiredMSVCVersion('5.5.1')).toBe('14.38');
      expect(getRequiredMSVCVersion('5.3')).toBe('14.34');
    });
  });

  describe('5.8 framing is not stale 5.7 framing', () => {
    it('MegaLights is production-ready on 5.8 and beta on 5.7', () => {
      expect(getEngineFacts('5.8').megaLights).toMatch(/production-ready/);
      expect(getEngineFacts('5.8').megaLights).not.toMatch(/beta/i);
      expect(getEngineFacts('5.7').megaLights).toMatch(/beta/i);
    });

    it('the level-design domain context carries the version-correct MegaLights claim', () => {
      const on58 = getModuleDomainContext('level-design', '5.8.0')!;
      const on57 = getModuleDomainContext('level-design', '5.7.2')!;
      expect(on58).toContain('MegaLights is production-ready on 5.8');
      expect(on58).not.toMatch(/MegaLights \(beta/i);
      expect(on57).toMatch(/MegaLights \(beta/i);
    });

    it('Iris stays conservative — no invented promotion', () => {
      // The repo records nothing about Iris graduating on 5.8, so the claim is
      // carried forward and SAYS it is unverified rather than asserting GA.
      expect(getEngineFacts('5.8').iris).toMatch(/beta/i);
      expect(getEngineFacts('5.8').iris).toMatch(/records no promotion/);
    });
  });

  describe('single-literal facts', () => {
    it('the material builder renders the ONE Substrate literal for the project engine', () => {
      const facts = getEngineFacts('5.8.0');
      const prompt = buildMaterialConfiguratorPrompt(MATERIAL_CONFIG, ctxFor('5.8.0'));
      expect(prompt).toContain(facts.substrate);
      expect(prompt).toContain(facts.substrateSlabHint);
      expect(prompt).toContain(facts.naniteDisplacement);
      // The old hard-coded framing is gone from the emitted prompt.
      expect(prompt).not.toContain('or Substrate Slab for 5.7+');
      expect(prompt).not.toContain('For UE 5.7+: Substrate is production-ready');
    });

    it('the same builder reframes for a 5.7 project', () => {
      const prompt = buildMaterialConfiguratorPrompt(MATERIAL_CONFIG, ctxFor('5.7.2'));
      expect(prompt).toContain(getEngineFacts('5.7').substrateSlabHint);
      expect(prompt).not.toContain(getEngineFacts('5.8').substrateSlabHint);
    });

    it('pre-5.7 engines are told Substrate is NOT a production path', () => {
      const prompt = buildMaterialConfiguratorPrompt(MATERIAL_CONFIG, ctxFor('5.5.0'));
      expect(prompt).toContain('Substrate is NOT a production path on UE 5.5');
    });
  });
});
