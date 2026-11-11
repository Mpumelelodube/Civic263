import { Button, Host } from '@expo/ui';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { Panel, Paragraph, Screen } from '@/components/screen';
import { theme } from '@/theme';
export function NearbyScreen() {
  return (
    <Screen>
      <Panel>
        <Text style={{ fontSize: 26, color: theme.text, fontWeight: '600' }}>Civic263</Text>
        <Paragraph>Report it. Track what happens.</Paragraph>
        <Paragraph>A public municipal issue register for Zimbabwe.</Paragraph>
      </Panel>
      <Panel>
        <Text style={{ fontSize: 18, color: theme.text, fontWeight: '600' }}>
          Your reporting workspace
        </Text>
        <Paragraph>
          Save issue drafts on this device. Live incident browsing and server submission will be
          connected next.
        </Paragraph>
        <Host matchContents>
          <Button onPress={() => router.push('/report')}>Start an issue draft</Button>
        </Host>
      </Panel>
      <Paragraph>
        Saving a draft does not notify a municipality or emergency service. No location, camera or
        sign-in permission is needed to open this scaffold.
      </Paragraph>
    </Screen>
  );
}
