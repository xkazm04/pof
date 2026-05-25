/**
 * Track-workspace registrations (ECW Part 3). Side-effect import barrel —
 * `EntityInspector` imports this once so every specialized track workspace
 * registers itself. Tracks without an entry fall back to DefaultTrackWorkspace.
 */
import { registerTrackWorkspace } from '@/components/ecw/inspector/trackWorkspaceRegistry';
import { LogicWorkspace } from './LogicWorkspace';
import { TestWorkspace } from './TestWorkspace';
import { Leonardo2DWorkspace } from './Leonardo2DWorkspace';

registerTrackWorkspace('*', 'logic', LogicWorkspace);
registerTrackWorkspace('*', 'test', TestWorkspace);
registerTrackWorkspace('*', 'art-2d', Leonardo2DWorkspace);
