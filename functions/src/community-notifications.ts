import { createHash, randomUUID } from 'node:crypto';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import type { Message, SendResponse } from 'firebase-admin/messaging';

const sendMessages = (messages: Message[]) => getMessaging().sendEach(messages);
// Inbox records are transactional. Push is best-effort, bounded, and never changes lifecycle state.
export async function deliverCommunityNotifications(
  checkId: string,
  recipients: string[],
  send = sendMessages,
) {
  const db = getFirestore();
  for (const uid of [...new Set(recipients)].slice(0, 3)) {
    const ref = db.collection('residentNotifications').doc(uid).collection('items').doc(checkId);
    const lease = randomUUID();
    const item = await db.runTransaction(async (transaction) => {
      const [snapshot, profile] = await Promise.all([
        transaction.get(ref),
        transaction.get(db.collection('residentCommunity').doc(uid)),
      ]);
      const data = snapshot.data();
      if (!data || ['delivered', 'disabled', 'failed'].includes(data.pushStatus)) return null;
      if (profile.data()?.preferences?.pushUpdates !== true) {
        transaction.update(ref, { pushStatus: 'disabled' });
        return null;
      }
      if (data.pushLeaseUntil > Date.now()) throw new Error('Notification delivery is running');
      const attempts = (data.pushAttempts ?? 0) + 1;
      if (attempts > 5) {
        transaction.update(ref, { pushStatus: 'failed' });
        return null;
      }
      transaction.update(ref, {
        pushLease: lease,
        pushLeaseUntil: Date.now() + 120000,
        pushAttempts: attempts,
      });
      return { ...data, attempts };
    });
    if (!item) continue;
    const data = item as FirebaseFirestore.DocumentData;
    let retry = false;
    try {
      const devices = await db
        .collection('residentDevices')
        .doc(uid)
        .collection('devices')
        .limit(5)
        .get();
      const currentDevices = [];
      for (const device of devices.docs) {
        const registration = await db
          .collection('communityPushRegistrations')
          .doc(createHash('sha256').update(device.data().token).digest('hex'))
          .get();
        if (registration.data()?.uid === uid && registration.data()?.installationId === device.id)
          currentDevices.push(device);
      }
      const body =
        data.kind === 'report-fix'
          ? `A fix was reported for ${data.reference}. Community confirmation is pending.`
          : data.kind === 'confirm-fix'
            ? `${data.reference} was confirmed resolved by a community reviewer.`
            : `A reviewer found ${data.reference} is still broken. It remains active.`;
      if (currentDevices.length) {
        const result = await send(
          currentDevices.map((device) => ({
            token: device.data().token,
            notification: { title: 'Civic263 update', body },
            data: { reportId: data.reportId, notificationId: checkId },
            apns: {
              headers: {
                'apns-push-type': 'alert',
                'apns-priority': '10',
                'apns-collapse-id': checkId,
              },
              payload: { aps: { sound: 'default', threadId: data.reportId } },
            },
            android: {
              collapseKey: checkId,
              notification: { channelId: 'community-updates', tag: checkId },
            },
          })),
        );
        for (const [index, response] of result.responses.entries()) {
          const code = (response as SendResponse).error?.code;
          if (
            [
              'messaging/registration-token-not-registered',
              'messaging/invalid-registration-token',
            ].includes(code ?? '')
          )
            await currentDevices[index]!.ref.delete();
          else if (!response.success) retry = true;
        }
      }
    } catch {
      retry = true;
    }
    const shouldRetry = retry && data.attempts < 5;
    await db.runTransaction(async (transaction) => {
      if ((await transaction.get(ref)).data()?.pushLease === lease)
        transaction.update(ref, {
          pushStatus: shouldRetry ? 'queued' : retry ? 'failed' : 'delivered',
          pushLeaseUntil: 0,
        });
    });
    if (shouldRetry) throw new Error('Notification delivery needs a retry');
  }
}
