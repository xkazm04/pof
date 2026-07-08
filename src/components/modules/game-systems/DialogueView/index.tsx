'use client';

import { Sparkles } from 'lucide-react';
import { createTabbedModuleView } from '@/components/modules/shared/createTabbedModuleView';
import { QuestGeneratorPanel } from './QuestGeneratorPanel';

// ── Main view ──
//
// DialogueView used to hand-roll its own `generator | checklist` tab bar (with
// inline `style={{ borderColor: ACCENT }}` underline drift and duplicated
// ReviewableModuleView prop wiring). It now defers to the shared
// `createTabbedModuleView` factory, which threads the QuestGenerator panel
// through ReviewableModuleView's existing `extraTabs` slot. Brings DialogueView
// in line with its 4 createSimpleModuleView siblings (see ui-perfectionist 16.1).

export const DialogueView = createTabbedModuleView('dialogue-quests', [
  {
    id: 'generator',
    label: 'Quest Generator',
    icon: Sparkles,
    render: () => <QuestGeneratorPanel />,
  },
]);
