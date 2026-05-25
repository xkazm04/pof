/**
 * Track-workspace registrations (ECW Part 3). Side-effect import barrel —
 * `EntityInspector` imports this once so every specialized track workspace
 * registers itself. Tracks without an entry fall back to DefaultTrackWorkspace.
 */
import { registerTrackWorkspace } from '@/components/ecw/inspector/trackWorkspaceRegistry';
import { LogicWorkspace } from './LogicWorkspace';
import { TestWorkspace } from './TestWorkspace';

registerTrackWorkspace('*', 'logic', LogicWorkspace);
registerTrackWorkspace('*', 'test', TestWorkspace);
