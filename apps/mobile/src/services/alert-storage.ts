import { Directory, File, Paths } from 'expo-file-system';
import { uuid } from 'expo';
import {
  DEFAULT_COMMUNITY_PREFERENCES,
  type CommunityPreferences,
  type IssueLocation,
  type PublicIncident,
  type ReminderLedger,
  type FieldTestSession,
} from '@civic263/domain';

export interface AlertState {
  fieldTest?: FieldTestSession;
  devicePaused?: boolean;
  devicePushPaused?: boolean;
  deviceBackgroundPaused?: boolean;
  preferences: CommunityPreferences;
  installationId: string;
  ownFixIds: string[];
  targets: PublicIncident[];
  ledger: ReminderLedger;
  centre: IssueLocation | null;
  refreshedAt: number;
}
function stateFile(name = 'state.json') {
  const directory = new Directory(
    Paths.document,
    process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST ? 'civic263-demo-alerts' : 'civic263-alerts',
  );
  directory.create({ idempotent: true, intermediates: true });
  return new File(directory, name);
}
export async function readAlertState(): Promise<AlertState> {
  const file = stateFile();
  if (file.exists) {
    try {
      const value = JSON.parse(await file.text()) as AlertState;
      if (
        value.preferences &&
        value.ledger &&
        Array.isArray(value.targets) &&
        Array.isArray(value.ownFixIds) &&
        typeof value.installationId === 'string'
      )
        return value;
    } catch {
      /* Corrupt local preferences fail closed. */
    }
  }
  return {
    preferences: { ...DEFAULT_COMMUNITY_PREFERENCES },
    installationId: uuid.v4(),
    ownFixIds: [],
    targets: [],
    ledger: { day: '', count: 0, issues: {} },
    centre: null,
    refreshedAt: 0,
  };
}
let writes: Promise<unknown> = Promise.resolve();
export function updateAlertState(
  change: (state: AlertState) => void | Promise<void>,
): Promise<AlertState> {
  const result = writes
    .catch(() => {})
    .then(async () => {
      const state = await readAlertState();
      await change(state);
      const temporary = stateFile('state.tmp');
      temporary.create({ overwrite: true });
      await temporary.write(JSON.stringify(state));
      await temporary.move(stateFile(), { overwrite: true });
      return state;
    });
  writes = result;
  return result;
}
export async function rememberOwnFix(checkId: string) {
  await updateAlertState((state) => {
    state.ownFixIds = [checkId, ...state.ownFixIds.filter((id) => id !== checkId)].slice(0, 100);
  });
}
