import * as SecureStore from 'expo-secure-store';
import { uuid } from 'expo';

// Firebase persistence can exceed SecureStore's per-item size on some platforms.
// Write encrypted chunks first and switch the manifest only after every chunk exists.
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const keyFor = (key: string) =>
  'civic263.auth.' + Array.from(key, (char) => char.charCodeAt(0).toString(16)).join('_');
type Manifest = { generation: string; count: number };
async function manifest(key: string): Promise<Manifest | null> {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;
  const parsed = JSON.parse(value) as Manifest;
  if (
    !/^[a-f0-9-]+$/u.test(parsed.generation) ||
    !Number.isInteger(parsed.count) ||
    parsed.count < 1 ||
    parsed.count > 100
  )
    throw new Error('The saved reporting identity could not be read.');
  return parsed;
}
async function clearChunks(key: string, previous: Manifest | null) {
  if (previous)
    for (let index = 0; index < previous.count; index++)
      await SecureStore.deleteItemAsync(`${key}.${previous.generation}.${index}`);
}
export const secureAuthStorage = {
  async getItem(rawKey: string) {
    const key = keyFor(rawKey);
    const saved = await manifest(key);
    if (!saved) return null;
    let value = '';
    for (let index = 0; index < saved.count; index++) {
      const chunk = await SecureStore.getItemAsync(`${key}.${saved.generation}.${index}`);
      if (chunk === null) throw new Error('The saved reporting identity is incomplete.');
      value += chunk;
    }
    return value;
  },
  async setItem(rawKey: string, value: string) {
    const key = keyFor(rawKey);
    const previous = await manifest(key);
    const next = { generation: uuid.v4(), count: Math.ceil(value.length / 500) };
    if (next.count > 100) throw new Error('The reporting identity is too large to save securely.');
    for (let index = 0; index < next.count; index++)
      await SecureStore.setItemAsync(
        `${key}.${next.generation}.${index}`,
        value.slice(index * 500, (index + 1) * 500),
        options,
      );
    await SecureStore.setItemAsync(key, JSON.stringify(next), options);
    await clearChunks(key, previous).catch(() => {});
  },
  async removeItem(rawKey: string) {
    const key = keyFor(rawKey);
    const previous = await manifest(key);
    await SecureStore.deleteItemAsync(key);
    await clearChunks(key, previous);
  },
};
