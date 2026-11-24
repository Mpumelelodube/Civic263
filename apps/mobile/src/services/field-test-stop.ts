export interface FieldTestStopSteps {
  /** Stops background/geofence work and records the pause on this device. Must not use the network. */
  pauseLocally(): Promise<void>;
  /** Server-side cleanup. May fail when offline or when the two-hour grant has expired. */
  stopRemotely(): Promise<void>;
  /** Records whether server cleanup is still outstanding, so the UI can explain it. */
  recordRemoteCleanup(pending: boolean): Promise<void>;
}
export interface FieldTestStopResult {
  remoteCleanupPending: boolean;
}
/**
 * The device is paused before any remote request. A remote failure never undoes the
 * pause; it only leaves a pending-cleanup marker. The pause itself must succeed.
 */
export async function stopFieldTestSafely(steps: FieldTestStopSteps): Promise<FieldTestStopResult> {
  await steps.pauseLocally();
  try {
    await steps.stopRemotely();
  } catch {
    await steps.recordRemoteCleanup(true);
    return { remoteCleanupPending: true };
  }
  await steps.recordRemoteCleanup(false);
  return { remoteCleanupPending: false };
}
