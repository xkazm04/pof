/**
 * Build Queue — Singleton sequential executor for headless UE5 builds.
 *
 * Only one build runs at a time. Additional requests are queued FIFO.
 * Emits typed events on the event bus for UI reactivity.
 *
 * Every build is recorded in `headless_builds` before it can spawn: 'queued' at
 * enqueue (refused when the row cannot be written), 'running' just before
 * executeBuild, then its result. A build aborted while queued settles as
 * 'aborted'. GET ?buildId reads live item + row through resolveBuildStatus.
 */

import {
  executeBuild, generateBuildId, recordQueuedBuild, markBuildRunning, settleBuildRow,
} from '@/lib/ue5-bridge/build-pipeline';
import { eventBus } from '@/lib/event-bus';
import { logger } from '@/lib/logger';
import type { BuildRequest, BuildQueueItem, BuildStatus } from '@/types/ue5-bridge';

// ── Build Queue ──────────────────────────────────────────────────────────────

class BuildQueue {
  private queue: BuildQueueItem[] = [];
  private currentBuild: {
    item: BuildQueueItem;
    abortController: AbortController;
  } | null = null;
  private processing = false;

  /**
   * Add a build request to the queue. Returns the generated buildId.
   * If no build is currently running, processing starts immediately.
   * Throws (and queues nothing) when the build's record cannot be written.
   */
  enqueue(request: BuildRequest, moduleId?: string): string {
    const buildId = generateBuildId();
    const item: BuildQueueItem = {
      buildId,
      request,
      status: 'queued',
      queuedAt: new Date().toISOString(),
      startedAt: null,
    };

    try {
      recordQueuedBuild(buildId, request, item.queuedAt);
    } catch (e) {
      const why = e instanceof Error ? e.message : String(e);
      throw new Error(`Build not started: its record could not be written to headless_builds (${why})`);
    }

    this.queue.push(item);
    logger.info(`[build-queue] Enqueued build ${buildId} for ${request.targetName} (queue depth: ${this.queue.length})`);

    // Store moduleId in a side map so processNext can pass it to executeBuild
    this.moduleIds.set(buildId, moduleId);

    // Kick off processing (no-op if already running)
    this.processNext();

    return buildId;
  }

  /**
   * Abort a build. If it's the currently running build, kills the process.
   * If it's queued, removes it from the queue.
   * Returns true if the build was found and aborted/removed.
   */
  abort(buildId: string): boolean {
    // Check if it's the current build
    if (this.currentBuild && this.currentBuild.item.buildId === buildId) {
      logger.info(`[build-queue] Aborting active build ${buildId}`);
      this.currentBuild.abortController.abort();
      return true;
    }

    // Check if it's in the queue
    const idx = this.queue.findIndex((item) => item.buildId === buildId);
    if (idx !== -1) {
      logger.info(`[build-queue] Removing queued build ${buildId}`);
      this.queue.splice(idx, 1);
      this.moduleIds.delete(buildId);
      this.settle(buildId, { status: 'aborted', completedAt: new Date().toISOString(), durationMs: null, exitCode: null, errorCount: 0, warningCount: 0 });
      eventBus.emit('build.aborted', { buildId }, 'build-queue');
      return true;
    }

    return false;
  }

  /**
   * The LIVE item for a build id (current build or queue), or null. A settled or
   * orphaned build is answered from its row: see resolveBuildStatus.
   */
  getStatus(buildId: string): BuildQueueItem | null {
    if (this.currentBuild?.item.buildId === buildId) {
      return { ...this.currentBuild.item };
    }
    const queued = this.queue.find((item) => item.buildId === buildId);
    return queued ? { ...queued } : null;
  }

  /**
   * Get all items: the currently running build (if any) + all pending items.
   */
  getQueue(): BuildQueueItem[] {
    const items: BuildQueueItem[] = [];
    if (this.currentBuild) {
      items.push({ ...this.currentBuild.item });
    }
    for (const item of this.queue) {
      items.push({ ...item });
    }
    return items;
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  /** Side map: buildId -> moduleId for error memory integration */
  private moduleIds = new Map<string, string | undefined>();

  /** Write a result summary onto a row not yet settled (a failed write is logged, never thrown). */
  private settle(buildId: string, summary: Parameters<typeof settleBuildRow>[1]): void {
    try {
      settleBuildRow(buildId, summary);
    } catch (err) {
      logger.warn(`[build-queue] Failed to settle the record of build ${buildId}:`, err);
    }
  }

  private async processNext(): Promise<void> {
    if (this.processing) return;
    if (this.queue.length === 0) return;

    this.processing = true;

    // Dequeue the next item
    const item = this.queue.shift()!;
    const moduleId = this.moduleIds.get(item.buildId);
    this.moduleIds.delete(item.buildId);

    // Mark as running
    item.status = 'running' as BuildStatus;
    const startedAt = new Date().toISOString();
    item.startedAt = startedAt;

    // The row reads 'running' before anything spawns (it was recorded 'queued' at enqueue).
    try {
      markBuildRunning(item.buildId, startedAt);
    } catch (err) {
      logger.warn(`[build-queue] Failed to mark build ${item.buildId} running:`, err);
    }

    const abortController = new AbortController();
    this.currentBuild = { item, abortController };

    // Emit queued event
    eventBus.emit('build.queued', {
      buildId: item.buildId,
      targetName: item.request.targetName,
    }, 'build-queue');

    logger.info(`[build-queue] Processing build ${item.buildId} for ${item.request.targetName}`);

    try {
      const result = await executeBuild(item.request, {
        buildId: item.buildId,
        moduleId,
        abortSignal: abortController.signal,
        onProgress: (message, percent) => {
          // Kept on the item (not only emitted) so GET ?buildId / ?projectPath can show it.
          item.progress = percent === undefined ? { message } : { message, percent };
          eventBus.emit('build.progress', {
            buildId: item.buildId,
            message,
            percent,
          }, 'build-queue');
        },
      });

      // executeBuild writes the full result; this fills the summary only if that write did not land.
      this.settle(item.buildId, {
        status: result.status,
        completedAt: result.completedAt || new Date().toISOString(),
        durationMs: result.durationMs ?? Date.now() - Date.parse(startedAt),
        exitCode: result.exitCode ?? null,
        errorCount: result.errorCount ?? 0,
        warningCount: result.warningCount ?? 0,
      });

      // Emit result event
      switch (result.status) {
        case 'success':
          eventBus.emit('build.succeeded', {
            buildId: item.buildId,
            errorCount: result.errorCount,
            warningCount: result.warningCount,
            durationMs: result.durationMs ?? 0,
          }, 'build-queue');
          item.status = 'success';
          break;

        case 'aborted':
          eventBus.emit('build.aborted', {
            buildId: item.buildId,
          }, 'build-queue');
          item.status = 'aborted';
          break;

        case 'failed':
        default:
          eventBus.emit('build.failed', {
            buildId: item.buildId,
            errorCount: result.errorCount,
            exitCode: result.exitCode,
          }, 'build-queue');
          item.status = 'failed';
          break;
      }
    } catch (err) {
      logger.warn(`[build-queue] Unexpected error during build ${item.buildId}:`, err);
      this.settle(item.buildId, {
        status: 'failed', completedAt: new Date().toISOString(),
        durationMs: Date.now() - Date.parse(startedAt), exitCode: null, errorCount: 1, warningCount: 0,
      });
      eventBus.emit('build.failed', {
        buildId: item.buildId,
        errorCount: 1,
        exitCode: null,
      }, 'build-queue');
      item.status = 'failed';
    }

    // Clear current build
    this.currentBuild = null;
    this.processing = false;

    // Process next item if any
    this.processNext();
  }
}

/** Singleton build queue instance */
export const buildQueue = new BuildQueue();
