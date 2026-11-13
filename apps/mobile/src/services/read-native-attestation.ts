export function readNativeAttestation(value: unknown, projectId: string, now = Date.now()) {
  if (!value || typeof value !== 'object')
    throw new Error('Device verification returned an invalid response.');
  const data = value as Record<string, unknown>;
  if (
    data.projectId !== projectId ||
    typeof data.token !== 'string' ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(data.token) ||
    typeof data.expireTimeMillis !== 'number' ||
    !Number.isFinite(data.expireTimeMillis) ||
    data.expireTimeMillis <= now + 1000
  ) {
    throw new Error('Could not verify this device for Civic263. Connect and retry.');
  }
  return { token: data.token, expireTimeMillis: data.expireTimeMillis };
}
