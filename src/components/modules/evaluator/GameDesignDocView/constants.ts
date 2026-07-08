import {
  FileText, BarChart3, Map, Volume2, Wrench, Package, Layers,
} from 'lucide-react';
import { MODULE_COLORS } from '@/lib/chart-colors';
import { mermaidNodeIdToModuleId } from '@/lib/gdd-mermaid';

export const ACCENT = MODULE_COLORS.evaluator;

/** A diagram node is interactive only when it resolves to a real sub-module. */
export const isModuleNode = (svgNodeId: string) => mermaidNodeIdToModuleId(svgNodeId) !== null;

export const SECTION_ICONS: Record<string, typeof FileText> = {
  'overview': BarChart3,
  'core-systems': Layers,
  'roadmap': FileText,
  'level-design': Map,
  'audio-design': Volume2,
  'architecture': Wrench,
  'deployment': Package,
};
