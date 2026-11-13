import { initializeApp } from 'firebase-admin/app';
import { HttpsError, onCall, onRequest } from 'firebase-functions/v2/https';
import { receiveReport } from './report-intake.ts';
import { defineSecret } from 'firebase-functions/params';
import { receivePlaceLookup } from './place-lookup.ts';
import { listResidentReports, readResidentReport } from './report-access.ts';
import { setGlobalOptions } from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { reviewSubmittedReport } from './automatic-review.ts';
import { servePublicApi } from './public-api.ts';
import { submitFieldCheck } from './field-checks.ts';
import { communityCommand } from './community.ts';
import { fieldTestCommand } from './field-test.ts';
import { reviewResolutionEvidence } from './resolution-review.ts';
import { reviewFieldEvidence } from './field-evidence-review.ts';
import { deliverCommunityNotifications } from './community-notifications.ts';

initializeApp();
setGlobalOptions({
  serviceAccount: 'civic263-backend@civic263-df6ec.iam.gserviceaccount.com',
  concurrency: 4,
  maxInstances: 2,
});

export const reviewReport = onDocumentCreated(
  {
    document: 'reports/{reportId}',
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 240,
    retry: true,
  },
  async (event) => reviewSubmittedReport(event.params.reportId),
);

export const reviewResolution = onDocumentCreated(
  {
    document: 'reportEvents/{eventId}',
    region: 'europe-west1',
    memory: '1GiB',
    timeoutSeconds: 240,
    retry: true,
  },
  async (event) => {
    if (event.data?.data().event === 'resident-resolved')
      await reviewResolutionEvidence(event.data.data().reportId);
    if (event.data?.data().event === 'community-field-check') {
      const data = event.data.data();
      const results = await Promise.allSettled([
        reviewFieldEvidence(data.checkId),
        deliverCommunityNotifications(data.checkId, data.notificationUids),
      ]);
      if (results.some((result) => result.status === 'rejected'))
        throw new Error('Community follow-up needs a retry');
    }
  },
);

export const publicApi = onRequest(
  {
    region: 'europe-west1',
    cors: [
      'https://civic263-df6ec.web.app',
      'https://civic263-df6ec.firebaseapp.com',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ],
  },
  servePublicApi,
);

const residentOptions = {
  region: 'europe-west1',
  maxInstances: 2,
  enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
};
export const getMyReports = onCall(residentOptions, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to view your reports.');
  return listResidentReports(request.data, request.auth.uid);
});
export const getMyReport = onCall(
  { ...residentOptions, memory: '512MiB', timeoutSeconds: 60 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to view your report.');
    return readResidentReport(request.data, request.auth.uid);
  },
);

const mapsServerKey = defineSecret('GOOGLE_MAPS_SERVER_KEY');
export const lookupPlace = onCall(
  {
    region: 'europe-west1',
    maxInstances: 2,
    timeoutSeconds: 15,
    secrets: [mapsServerKey],
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async (request) => {
    if (!request.auth)
      throw new HttpsError('unauthenticated', 'Sign in before looking up a place.');
    return receivePlaceLookup(request.data, request.auth.uid, mapsServerKey.value());
  },
);

export const submitReport = onCall(
  {
    region: 'europe-west1',
    maxInstances: 2,
    timeoutSeconds: 60,
    memory: '512MiB',
    // Expo Go can exercise emulators. Production requires a device-attested client.
    enforceAppCheck: process.env.FUNCTIONS_EMULATOR !== 'true',
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before sending a report.');
    const fieldTester =
      request.auth.token.civic263Test === true &&
      typeof request.auth.token.civic263FieldTestUntil === 'number' &&
      request.auth.token.civic263FieldTestUntil > Date.now();
    if (['resolve', 'report-fix', 'confirm-fix', 'reject-fix'].includes(request.data?.action))
      return submitFieldCheck(
        request.data,
        request.auth.uid,
        request.auth.token.civic263Test === true,
      );
    if (request.data?.action === 'community-field-test')
      return fieldTestCommand(request.data, request.auth.uid, fieldTester);
    if (typeof request.data?.action === 'string' && request.data.action.startsWith('community-'))
      return communityCommand(request.data, request.auth.uid, fieldTester);
    return receiveReport(request.data, request.auth.uid, request.auth.token.civic263Test === true);
  },
);

// Keep the existing region; project provisioning remains an explicit deployment step.
export const health = onRequest(
  { region: 'europe-west1', maxInstances: 2 },
  (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.status(200).json({
      service: 'Civic263',
      stage: 'reporting-and-automatic-review',
      reportIntakeEnabled: true,
      testIdentityIsolation: true,
    });
  },
);

// Receipt confirms private platform intake, not municipal acknowledgement or publication.
