import { onRequest } from 'firebase-functions/v2/https';

// Region is a launch decision. No database is created or accessed by this scaffold.
export const health = onRequest(
  { region: 'europe-west1', maxInstances: 2 },
  (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response
      .status(200)
      .json({ service: 'Civic263', stage: 'scaffold', reportIntakeEnabled: false });
  },
);

// Future modules: commands/report-intake, moderation, incident-workflow,
// publication, public-data and notification-outbox. No anonymous write API yet.
