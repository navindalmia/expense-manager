import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isStaging } from '../utils/appVariant';
import { getUpdateLabel } from '../utils/updateInfo';

// Static string: the app has no i18n layer for static UI text yet (screen titles are literals too).
export const STAGING_BANNER_TEXT = 'STAGING - test data only';
export const STAGING_ORANGE = '#F57C00';

interface StagingBannerProps {
  /** Pad for the status bar. Only for headerless screens whose container does not already inset the top. */
  padTop?: boolean;
}

/**
 * In-flow orange strip rendered INSIDE a screen (never as an app-root wrapper, which
 * resized every screen and hid bottom buttons under the navigation bar: issue #118).
 * Renders nothing in production.
 */
export default function StagingBanner({ padTop = false }: StagingBannerProps): React.ReactElement | null {
  if (!isStaging()) return null;
  return <StagingStrip padTop={padTop} />;
}

function StagingStrip({ padTop }: { padTop: boolean }): React.ReactElement {
  const insets = useSafeAreaInsets();
  const update = getUpdateLabel();
  return (
    <View style={[styles.strip, { paddingTop: padTop ? insets.top : 0 }]} testID="staging-banner">
      <Text accessibilityRole="text" style={styles.text}>
        {update ? `${STAGING_BANNER_TEXT} | ${update}` : STAGING_BANNER_TEXT}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: STAGING_ORANGE, alignItems: 'center', paddingBottom: 3 },
  text: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
});
