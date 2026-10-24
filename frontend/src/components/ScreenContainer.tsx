import React from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import StagingBanner from './StagingBanner';

interface ScreenContainerProps {
  children: React.ReactNode;
  /**
   * True (default) when the navigator draws a header: the header already insets the top, so only
   * the sides and bottom are inset here. Set false for headerless screens (login etc.).
   */
  withHeader?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const EDGES_WITH_HEADER: Edge[] = ['bottom', 'left', 'right'];

/**
 * Height (dp) of a standard 3-button Android navigation bar. Some Samsung nav-bar modes draw
 * the system buttons over the app while reporting a bottom safe-area inset of 0, so the inset
 * alone leaves bottom buttons (Create/Save/Cancel) underneath them. When Android reports 0 we
 * reserve this much instead; any real inset (gesture pill, normal nav bar) is used as reported.
 */
export const ANDROID_ZERO_INSET_NAV_CLEARANCE = 48;

/**
 * The ONE standard root for every screen. It keeps content (especially bottom buttons) clear of the
 * system navigation bar on edge-to-edge Android, whatever the navigation mode, and shows the
 * staging marker on headerless screens. Do not hand-roll a screen root: a regression test
 * (issue-118-screen-layout-uniform) fails for any screen that does not use this or SafeAreaView.
 */
export default function ScreenContainer({
  children,
  withHeader = true,
  style,
  testID,
}: ScreenContainerProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const bottomClearance = Platform.OS === 'android' && insets.bottom === 0 ? ANDROID_ZERO_INSET_NAV_CLEARANCE : 0;
  return (
    <SafeAreaView edges={EDGES_WITH_HEADER} style={[{ flex: 1 }, style]} testID={testID}>
      {!withHeader && <StagingBanner padTop />}
      {children}
      {bottomClearance > 0 && <View style={{ height: bottomClearance }} testID="screen-bottom-clearance" />}
    </SafeAreaView>
  );
}
