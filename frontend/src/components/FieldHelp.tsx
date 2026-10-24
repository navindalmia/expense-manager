/**
 * Field Help
 *
 * A small "i" affordance next to a field label (Category / Label / Theme)
 * that opens a short plain-language explainer. The explainer is a light
 * popover (no close button of its own): tap anywhere outside it to dismiss.
 */

import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';

export type HelpTopic = 'Category' | 'Label' | 'Theme';

export const HELP_TEXT: Record<HelpTopic, string> = {
  Category:
    'A Category says what kind of spending an expense is, such as Food or Travel. Every expense has exactly one Category.',
  Label:
    'A Label is an optional tag you can add to expenses in any group, such as "Liverpool trip", so you can see related spending together.',
  Theme:
    'A Theme links groups and expenses that belong together over time, such as "Monthly Expense" reused every month.',
};

const HIT_SLOP = { top: 16, bottom: 16, left: 16, right: 16 };

interface FieldHelpProps {
  topic: HelpTopic;
  testIDPrefix: string;
}

const styles = StyleSheet.create({
  // Superscript: a small "i" hugging the end of the label, top-aligned so it sits above the text
  // baseline. The 44pt touch target comes from HIT_SLOP, not from the glyph's own box.
  trigger: { alignSelf: 'flex-start', marginLeft: 3, marginTop: -2 },
  triggerText: { fontSize: 11, lineHeight: 12, color: '#0066cc', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.3)', justifyContent: 'center', paddingHorizontal: 32 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 16 },
  heading: { fontSize: 15, fontWeight: '700', color: '#000', marginBottom: 6 },
  body: { fontSize: 14, color: '#333', lineHeight: 20 },
});

export default function FieldHelp({ topic, testIDPrefix }: FieldHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TouchableOpacity
        style={styles.trigger}
        hitSlop={HIT_SLOP}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`What is a ${topic}?`}
        testID={`${testIDPrefix}-help-button`}
      >
        <Text style={styles.triggerText}>i</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          accessibilityLabel="Dismiss"
          testID={`${testIDPrefix}-help-backdrop`}
        >
          <View style={styles.card} testID={`${testIDPrefix}-help-popover`}>
            <Text style={styles.heading}>What is a {topic}?</Text>
            <Text style={styles.body}>{HELP_TEXT[topic]}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
