'use client';

import { Flame, Package, Lock, Zap, Map, Puzzle, Image, AlertTriangle } from 'lucide-react';
import type { CookSettings } from '@/lib/packaging/build-profiles';
import { COOK_SETTING_APPLICATION } from '@/lib/packaging/uat-command-generator';
import { MODULE_COLORS, STATUS_WARNING } from '@/lib/chart-colors';

interface CookSettingsPanelProps {
  settings: CookSettings;
  onChange: (settings: CookSettings) => void;
}

/**
 * The disclosure a control gets when the generated BuildCookRun command cannot carry it.
 *
 * Read from the ONE application table in `uat-command-generator`, so the editor can never
 * promise something the command does not do. These controls stay editable — the value is
 * a real record of intent an operator can act on in `.uproject`/`.ini` — but the panel
 * says at the control that saving it does NOT change the build.
 */
function NotAppliedNote({ settingKey }: { settingKey: keyof CookSettings }) {
  const entry = COOK_SETTING_APPLICATION[settingKey];
  if (entry.appliedAs !== null) return null;
  return (
    <div
      className="flex items-start gap-1 mt-1 text-2xs leading-tight"
      style={{ color: STATUS_WARNING }}
      data-testid={`cook-setting-not-applied-${settingKey}`}
    >
      <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0 mt-px" />
      <span>
        <span className="font-semibold uppercase tracking-wider">Not applied by the generated command.</span>{' '}
        {entry.reason}
      </span>
    </div>
  );
}

function Toggle({ label, description, checked, onChange, icon }: {
  label: string; description: string; checked: boolean;
  onChange: (v: boolean) => void; icon: React.ReactNode;
}) {
  return (
    <label className="flex items-start gap-2.5 py-1.5 cursor-pointer group">
      <div className="flex items-center mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-7 h-4 rounded-full transition-colors flex items-center ${checked ? '' : 'bg-border-bright'}`} style={checked ? { backgroundColor: MODULE_COLORS.systems } : undefined}>
          <div className={`w-3 h-3 rounded-full bg-white transition-transform mx-0.5 ${checked ? 'translate-x-3' : 'translate-x-0'}`} />
        </div>
      </div>
      <div className="flex items-start gap-1.5 flex-1 min-w-0">
        <span className="flex-shrink-0 mt-px text-text-muted group-hover:text-text-muted transition-colors">
          {icon}
        </span>
        <div>
          <div className="text-xs font-medium text-text">{label}</div>
          <div className="text-2xs text-text-muted leading-tight mt-0.5">{description}</div>
        </div>
      </div>
    </label>
  );
}

export function CookSettingsPanel({ settings, onChange }: CookSettingsPanelProps) {
  const update = <K extends keyof CookSettings>(key: K, value: CookSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  const inputClass = 'w-full bg-background border border-border-bright rounded px-2 py-1 text-xs text-text-muted font-mono outline-none focus:border-violet-500/50';

  return (
    <div className="space-y-4">
      {/* Packaging */}
      <Section title="Packaging">
        <Toggle
          label="Use PAK files"
          description="Package assets into .pak files for shipping"
          checked={settings.usePak}
          onChange={(v) => update('usePak', v)}
          icon={<Package className="w-3 h-3" />}
        />
        <Toggle
          label="Compress PAK"
          description="Compress .pak files to reduce package size"
          checked={settings.compressPak}
          onChange={(v) => update('compressPak', v)}
          icon={<Zap className="w-3 h-3" />}
        />
        <Toggle
          label="Encrypt PAK"
          description="Encrypt .pak index for content protection"
          checked={settings.encryptPak}
          onChange={(v) => update('encryptPak', v)}
          icon={<Lock className="w-3 h-3" />}
        />
        <Toggle
          label="IoStore (UE5)"
          description="Use optimized I/O storage for faster loading"
          checked={settings.useIoStore}
          onChange={(v) => update('useIoStore', v)}
          icon={<Zap className="w-3 h-3" />}
        />
      </Section>

      {/* Cooking */}
      <Section title="Cooking">
        <Toggle
          label="Iterative cooking"
          description="Only re-cook changed assets (faster iteration)"
          checked={settings.iterativeCooking}
          onChange={(v) => update('iterativeCooking', v)}
          icon={<Flame className="w-3 h-3" />}
        />
        <Toggle
          label="Cook on the fly"
          description="Cook assets on demand (development only)"
          checked={settings.cookOnTheFly}
          onChange={(v) => update('cookOnTheFly', v)}
          icon={<Flame className="w-3 h-3" />}
        />
        <div>
          <Toggle
            label="Compress textures"
            description="Recorded intent only — the cook takes texture compression from the .ini/asset settings"
            checked={settings.compressTextures}
            onChange={(v) => update('compressTextures', v)}
            icon={<Image className="w-3 h-3" />}
          />
          <NotAppliedNote settingKey="compressTextures" />
        </div>
      </Section>

      {/* Maps */}
      <Section title="Map Selection">
        <div>
          <label className="text-2xs text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
            <Map className="w-3 h-3" />
            Maps to include
          </label>
          <textarea
            value={settings.mapsToInclude.join('\n')}
            onChange={(e) => update('mapsToInclude', e.target.value.split('\n').filter((m) => m.trim()))}
            placeholder="Leave empty to include all maps.&#10;One map per line, e.g.:&#10;/Game/Maps/MainMenu&#10;/Game/Maps/Level1"
            className={`${inputClass} mt-1 h-16 resize-none`}
          />
        </div>
      </Section>

      {/* Plugins */}
      <Section title="Plugin Management">
        <div>
          <label className="text-2xs text-text-muted font-medium uppercase tracking-wider flex items-center gap-1">
            <Puzzle className="w-3 h-3" />
            Plugins to disable
          </label>
          <textarea
            value={settings.pluginsToDisable.join('\n')}
            onChange={(e) => update('pluginsToDisable', e.target.value.split('\n').filter((p) => p.trim()))}
            placeholder="Recorded here; NOT excluded by the generated command.&#10;One per line, e.g.:&#10;OnlineSubsystemSteam"
            className={`${inputClass} mt-1 h-12 resize-none`}
          />
          <NotAppliedNote settingKey="pluginsToDisable" />
        </div>
      </Section>

      {/* Texture budget */}
      <Section title="Texture Streaming">
        <div>
          <label className="text-2xs text-text-muted font-medium uppercase tracking-wider">
            Budget (MB, 0 = unlimited)
          </label>
          <input
            type="number"
            value={settings.textureStreamingBudgetMB}
            onChange={(e) => update('textureStreamingBudgetMB', Number(e.target.value) || 0)}
            min={0}
            className={`${inputClass} mt-1 w-24`}
          />
          <NotAppliedNote settingKey="textureStreamingBudgetMB" />
        </div>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xs font-bold uppercase tracking-wider text-text-muted-hover mb-1.5 border-b border-border/50 pb-1">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
