import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import { isStaging } from '../utils/appVariant';
import { getUpdateLabel } from '../utils/updateInfo';

// Static string: the app has no i18n layer for static UI text yet (screen titles are literals too).
export const STAGING_BANNER_TEXT = 'STAGING - test data only';
export const STAGING_ORANGE = '#F57C00';

/** Orange strip at the top of the screen (covers the status bar area). Renders nothing in production. */
export default function StagingBanner(): React.ReactElement | null {
  if (!isStaging()) return null;
  return <StagingStrip />;
}

function StagingStrip(): React.ReactElement {
  const insets = useSafeAreaInsets();
  const update = getUpdateLabel();
  return (
    <View style={[styles.strip, { paddingTop: insets.top }]} testID="staging-banner">
      <Text accessibilityRole="text" style={styles.text}>
        {update ? `${STAGING_BANNER_TEXT} | ${update}` : STAGING_BANNER_TEXT}
      </Text>
    </View>
  );
}

/**
 * App-root wrapper: banner on top, thin orange frame around the content.
 * In production it returns its children untouched (identical render tree).
 */
export function StagingFrame({ children }: { children: React.ReactNode }): React.ReactElement {
  if (!isStaging()) return <>{children}</>;
  return <StagingFrameInner>{children}</StagingFrameInner>;
}

function StagingFrameInner({ children }: { children: React.ReactNode }): React.ReactElement {
  const insets = useSafeAreaInsets();
  // The banner already consumes the top inset, so headers below must not pad for it again.
  return (
    <View style={styles.frame}>
      <StagingStrip />
      <View style={styles.content}>
        <SafeAreaInsetsContext.Provider value={{ ...insets, top: 0 }}>
          {children}
        </SafeAreaInsetsContext.Provider>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { backgroundColor: STAGING_ORANGE, alignItems: 'center', paddingBottom: 3 },
  text: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 12 },
  frame: { flex: 1, backgroundColor: STAGING_ORANGE, borderLeftWidth: 3, borderRightWidth: 3, borderBottomWidth: 3, borderColor: STAGING_ORANGE },
  content: { flex: 1, backgroundColor: '#FFFFFF' },
});
