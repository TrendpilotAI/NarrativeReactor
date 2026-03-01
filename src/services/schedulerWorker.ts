/**
 * Scheduler Worker — Polls for due scheduled posts and publishes them.
 *
 * Uses a simple setInterval loop (60s default) to check the calendar
 * for posts whose scheduledAt time has passed, then publishes them
 * via the publisher service.
 *
 * Alternatives considered:
 *   - node-cron: overkill for a simple interval check
 *   - BullMQ: requires Redis; too heavyweight for this use case
 *
 * The simple polling approach is reliable, restartable, and stateless.
 */

import { getNextDue, markPublished } from './calendarStore';
import { publishToAll } from './publisher';

const POLL_INTERVAL_MS = parseInt(process.env.SCHEDULER_POLL_MS || '60000', 10);

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Process a single tick: find the next due post and publish it.
 * Processes one at a time to avoid thundering herd on restart.
 */
async function tick(): Promise<void> {
  if (running) return; // guard against overlapping ticks
  running = true;
  try {
    // Process all due posts in order
    let due = await getNextDue();
    while (due) {
      console.log(`[scheduler] Publishing due post ${due.id} to ${due.platform} (scheduled for ${due.scheduledAt})`);
      try {
        await publishToAll(due.content, [due.platform]);
        await markPublished(due.id);
        console.log(`[scheduler] Successfully published post ${due.id}`);
      } catch (err: any) {
        console.error(`[scheduler] Failed to publish post ${due.id}:`, err.message);
        // Don't mark as published — will retry next tick
        break;
      }
      due = await getNextDue();
    }
  } catch (err: any) {
    console.error('[scheduler] Tick error:', err.message);
  } finally {
    running = false;
  }
}

/**
 * Start the scheduler. Safe to call multiple times (idempotent).
 */
export function startScheduler(): void {
  if (intervalHandle) {
    console.warn('[scheduler] Already running');
    return;
  }
  console.log(`[scheduler] Starting — polling every ${POLL_INTERVAL_MS / 1000}s`);
  // Run immediately on startup to catch any posts that were due during downtime
  tick();
  intervalHandle = setInterval(tick, POLL_INTERVAL_MS);
}

/**
 * Stop the scheduler.
 */
export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[scheduler] Stopped');
  }
}
