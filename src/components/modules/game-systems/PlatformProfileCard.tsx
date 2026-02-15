'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Monitor, Terminal, Laptop, Smartphone, Tablet,
  ChevronDown, ChevronRight, Star, Trash2, Play, Copy,
  AlertCircle,
} from 'lucide-react';
import type { BuildProfile, PlatformId } from '@/lib/packaging/build-profiles';
import { PLATFORM_NOTES } from '@/lib/packaging/uat-command-generator';

const PLATFORM_ICONS: Record<PlatformId, typeof Monitor> = {
  Win64: Monitor,
  Linux: Terminal,
  Mac: Laptop,
  Android: Smartphone,
  IOS: Tablet,
};

const PLATFORM_COLORS: Record<PlatformId, string> = {
  Win64: '#3b82f6',
  Linux: '#f97316',
  Mac: '#a78bfa',
  Android: '#22c55e',
  IOS: 'var(--text-muted)',
};

interface PlatformProfileCardProps {
  profile: BuildProfile;
  uatCommand?: string;
  onEdit: (profile: BuildProfile) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
  onPackage: (profile: BuildProfile) => void;
}

export function PlatformProfileCard({
  profile, uatCommand, onEdit, onDelete, onSetDefault, onPackage,
}: PlatformProfileCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [cmdCopied, setCmdCopied] = useState(false);

  const Icon = PLATFORM_ICONS[profile.platform] ?? Monitor;
  const color = PLATFORM_COLORS[profile.platform] ?? 'var(--text-muted)';
  const notes = PLATFORM_NOTES[profile.platform] ?? [];

  return (
    <motion.div
      layout
      className="rounded-lg border bg-surface-deep/80 overflow-hidden"
      style={{ borderColor: `${color}30` }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-text truncate">{profile.name}</span>
            {profile.isDefault && (
              <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" fill="currentColor" />
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-2xs font-mono px-1 py-px rounded" style={{ backgroundColor: `${color}15`, color }}>
              {profile.platform}
            </span>
            <span className="text-2xs font-mono text-text-muted">{profile.config}</span>
            {profile.cookSettings.usePak && (
              <span className="text-2xs text-text-muted bg-surface-hover px-1 py-px rounded">PAK</span>
            )}
            {profile.cookSettings.compressPak && (
              <span className="text-2xs text-text-muted bg-surface-hover px-1 py-px rounded">COMP</span>
            )}
            {profile.cookSettings.encryptPak && (
              <span className="text-2xs text-text-muted bg-surface-hover px-1 py-px rounded">ENC</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPackage(profile)}
            className="flex items-center gap-1 px-2 py-1 rounded text-2xs font-medium text-white transition-colors"
            style={{ backgroundColor: `${color}cc` }}
            title="Package"
          >
            <Play className="w-2.5 h-2.5" />
            Package
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 border-t border-border/50 pt-2 space-y-2.5">
              {/* Cook settings summary */}
              <div>
                <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Cook Settings</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {profile.cookSettings.useIoStore && <Badge label="IoStore" />}
                  {profile.cookSettings.iterativeCooking && <Badge label="Iterative" />}
                  {profile.cookSettings.compressTextures && <Badge label="Tex Compress" />}
                  {profile.cookSettings.mapsToInclude.length > 0 && (
                    <Badge label={`${profile.cookSettings.mapsToInclude.length} maps`} />
                  )}
                  {profile.cookSettings.mapsToInclude.length === 0 && <Badge label="All maps" />}
                  {profile.stage && <Badge label="Stage" />}
                  {profile.archive && <Badge label="Archive" />}
                </div>
              </div>

              {/* UAT Command preview */}
              {uatCommand && (
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">UAT Command</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(uatCommand).then(() => {
                          setCmdCopied(true);
                          setTimeout(() => setCmdCopied(false), 2000);
                        });
                      }}
                      className="flex items-center gap-0.5 text-2xs text-text-muted hover:text-text transition-colors"
                    >
                      <Copy className="w-2.5 h-2.5" />
                      {cmdCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <pre className="mt-1 text-2xs font-mono text-text-muted bg-background rounded p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {uatCommand}
                  </pre>
                </div>
              )}

              {/* Platform notes */}
              {notes.length > 0 && (
                <div>
                  <span className="text-2xs uppercase tracking-wider text-text-muted font-medium">Platform Notes</span>
                  <div className="mt-1 space-y-0.5">
                    {notes.map((note, i) => (
                      <div key={i} className="flex items-start gap-1 text-2xs text-text-muted-hover">
                        <AlertCircle className="w-2.5 h-2.5 text-text-muted flex-shrink-0 mt-px" />
                        {note}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Profile actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-border/30">
                <button
                  onClick={() => onEdit(profile)}
                  className="text-2xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Edit
                </button>
                {!profile.isDefault && (
                  <button
                    onClick={() => onSetDefault(profile.id)}
                    className="text-2xs text-yellow-400 hover:text-yellow-300 transition-colors"
                  >
                    Set Default
                  </button>
                )}
                <button
                  onClick={() => onDelete(profile.id)}
                  className="flex items-center gap-0.5 text-2xs text-red-400/60 hover:text-red-400 transition-colors ml-auto"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="text-2xs text-text-muted-hover bg-surface-hover px-1.5 py-px rounded">
      {label}
    </span>
  );
}
