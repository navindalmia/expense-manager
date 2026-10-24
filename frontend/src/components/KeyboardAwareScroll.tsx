/**
 * KeyboardAwareScroll: the ONE keyboard-aware scrolling form body for every screen.
 *
 * Composes what each screen used to hand-roll, and what was repeatedly forgotten on some of them:
 *  - KeyboardAvoidingView with 'padding' on iOS and NOTHING on Android (the 'height' mode cannot work
 *    on edge-to-edge Android: the window does not resize, so it left the whole layout offset by the
 *    navigation-bar height, hiding bottom buttons on a Samsung 3-button phone),
 *  - KeyboardInsetView (pads by the real keyboard overlap) and the focused-input scroll-into-view helper
 *    from hooks/useKeyboardInset,
 *  - keyboardShouldPersistTaps="handled" so a tap on a button is not swallowed by the keyboard.
 *
 * Use this for any screen with a scrolling form. Do NOT import KeyboardAvoidingView or
 * KeyboardInsetView in a screen: a regression test (issue-138-keyboard-standard) fails if you do.
 * `header` renders above the scroll area inside the keyboard handling (e.g. the staging banner).
 */
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardInsetView, useScrollFocusedInputIntoView } from '../hooks/useKeyboardInset';

interface KeyboardAwareScrollProps extends ScrollViewProps {
  children?: React.ReactNode;
  header?: React.ReactNode;
  /** Style of the outermost wrapper (default fills the screen). */
  avoiderStyle?: StyleProp<ViewStyle>;
}

export default function KeyboardAwareScroll({
  children,
  header,
  avoiderStyle,
  ...scrollViewProps
}: KeyboardAwareScrollProps): React.ReactElement {
  const { scrollRef, scrollProps } = useScrollFocusedInputIntoView();
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={avoiderStyle ?? { flex: 1 }}>
      <KeyboardInsetView style={{ flex: 1 }}>
        {header}
        <ScrollView ref={scrollRef} {...scrollProps} keyboardShouldPersistTaps="handled" {...scrollViewProps}>
          {children}
        </ScrollView>
      </KeyboardInsetView>
    </KeyboardAvoidingView>
  );
}
