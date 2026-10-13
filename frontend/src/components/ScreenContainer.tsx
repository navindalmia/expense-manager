import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
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
  return (
    <SafeAreaView edges={EDGES_WITH_HEADER} style={[{ flex: 1 }, style]} testID={testID}>
      {!withHeader && <StagingBanner padTop />}
      {children}
    </SafeAreaView>
  );
}
