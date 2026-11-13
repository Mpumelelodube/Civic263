import { requireOptionalNativeModule } from 'expo';
import { readNativeAttestation } from './read-native-attestation';

type NativeFirebase = {
  getAppCheckTokenAsync(forceRefresh: boolean): Promise<unknown>;
  getMessagingTokenAsync?(apnsToken: string): Promise<string>;
};
const native = requireOptionalNativeModule<NativeFirebase>('CivicAppCheck');
export async function nativeAppCheckToken(projectId: string) {
  if (!native)
    throw new Error('This build cannot verify the device. Install the current Civic263 app.');
  return readNativeAttestation(await native.getAppCheckTokenAsync(false), projectId);
}
export async function appleFcmToken(apnsToken: string) {
  if (!native?.getMessagingTokenAsync)
    throw new Error('Apple push support is missing from this build.');
  const token = await native.getMessagingTokenAsync(apnsToken);
  if (!/^[A-Za-z0-9:_-]{32,4096}$/.test(token))
    throw new Error('Push registration returned an invalid response.');
  return token;
}
