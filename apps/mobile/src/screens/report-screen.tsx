import { Button, Column, Host, TextInput, useNativeState } from '@expo/ui';
import { useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { CATEGORIES, categoryLabel, type CategoryId } from '@civic263/domain';
import { Panel, Paragraph, Screen } from '@/components/screen';
import { saveDraft } from '@/services/drafts';
import { theme } from '@/theme';
export function ReportScreen() {
  const [categoryId, setCategoryId] = useState<CategoryId>('roads');
  const [showCategories, setShowCategories] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const description = useNativeState('');
  const landmark = useNativeState('');
  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await saveDraft({ categoryId, description: description.value, landmark: landmark.value });
      description.value = '';
      landmark.value = '';
      router.navigate('/my-reports');
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Could not save. Your entered details remain here.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Screen>
      <Paragraph>
        Capture an issue without signing in. This form saves a device-local draft; it does not
        submit a live report.
      </Paragraph>
      <Panel>
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>
          Service: {categoryLabel(categoryId)}
        </Text>
        <Host matchContents>
          <Column>
            <Button onPress={() => setShowCategories(!showCategories)}>
              {showCategories ? 'Close service choices' : 'Choose a service'}
            </Button>
            {showCategories &&
              CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  onPress={() => {
                    setCategoryId(category.id);
                    setShowCategories(false);
                  }}
                >
                  {category.label}
                </Button>
              ))}
          </Column>
        </Host>
      </Panel>
      <Panel>
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>
          What needs attention?
        </Text>
        <Paragraph>Use 10 to 1,000 characters. Avoid personal names and contact details.</Paragraph>
        <Host matchContents>
          <TextInput
            accessibilityLabel="Describe the issue"
            multiline
            numberOfLines={4}
            maxLength={1000}
            value={description}
            onChangeText={(value) => {
              description.value = value;
            }}
            placeholder="Describe the issue"
          />
        </Host>
        <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>
          Issue location or landmark
        </Text>
        <Host matchContents>
          <TextInput
            accessibilityLabel="Issue location or landmark"
            maxLength={200}
            value={landmark}
            onChangeText={(value) => {
              landmark.value = value;
            }}
            placeholder="Road, intersection or nearby landmark"
          />
        </Host>
      </Panel>
      {error && (
        <Text accessibilityRole="alert" style={{ color: theme.error, fontSize: 16 }}>
          {error}
        </Text>
      )}
      <Host matchContents>
        <Button
          onPress={() => {
            void save();
          }}
          disabled={saving}
        >
          {saving ? 'Saving draft...' : 'Save draft on this device'}
        </Button>
      </Host>
      <Paragraph>
        Clearing app data or uninstalling can remove local drafts. Server tracking will be added
        with silent Firebase ownership.
      </Paragraph>
    </Screen>
  );
}
