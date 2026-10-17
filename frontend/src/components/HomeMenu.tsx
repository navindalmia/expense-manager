/**
 * Home Menu
 *
 * Right-side overflow menu for the Home header. The header used to hold four text
 * buttons (About, Themes, Labels, Logout), which crowded the title on narrow phones.
 * One menu button opens a small popover listing them. Picking an item closes the menu
 * first, then runs its action.
 */

import React, { useState } from 'react';
import { View, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export interface HomeMenuItem {
  key: string;
  label: string;
  testID: string;
  onPress: () => void;
}

interface HomeMenuProps {
  items: HomeMenuItem[];
}

const styles = StyleSheet.create({
  menuButton: { paddingHorizontal: 12, paddingVertical: 4, marginRight: 4 },
  menuGlyph: { color: '#0066cc', fontSize: 22, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  safeArea: { flex: 1, alignItems: 'flex-end' },
  card: { backgroundColor: '#fff', borderRadius: 8, marginTop: 8, marginRight: 8, minWidth: 160, paddingVertical: 4, elevation: 6 },
  item: { paddingHorizontal: 16, paddingVertical: 12 },
  itemText: { fontSize: 15, color: '#333', fontWeight: '500' },
});

export default function HomeMenu({ items }: HomeMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);

  const choose = (item: HomeMenuItem): void => {
    setOpen(false);
    item.onPress();
  };

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.menuButton}
        testID="home-menu-button"
        accessibilityRole="button"
        accessibilityLabel="Menu"
      >
        <Text style={styles.menuGlyph}>{'⋮'}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} testID="home-menu-backdrop">
          <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
            <View style={styles.card} testID="home-menu">
              {items.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.item}
                  onPress={() => choose(item)}
                  testID={item.testID}
                  accessibilityRole="menuitem"
                >
                  <Text style={styles.itemText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </SafeAreaView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
