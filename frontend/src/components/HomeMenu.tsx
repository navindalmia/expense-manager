/**
 * Home Menu
 *
 * Right-side overflow menu for the Home header. The header used to hold four text
 * buttons (About, Themes, Labels, Logout), which crowded the title on narrow phones.
 * One menu button opens a small popover listing them. Picking an item closes the menu
 * first, then runs its action.
 */

import React, { useRef, useState } from 'react';
import { View, Modal, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface HomeMenuItem {
  key: string;
  label: string;
  testID: string;
  onPress: () => void;
}

interface HomeMenuProps {
  items: HomeMenuItem[];
}

// Used when the button cannot be measured (tests, web): about one standard header below the top.
const FALLBACK_TOP = 56;
const MENU_GAP = 4;
const MENU_EDGE_MARGIN = 8;

const styles = StyleSheet.create({
  menuButton: { minHeight: 48, minWidth: 48, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  menuGlyph: { color: '#0066cc', fontSize: 22, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  card: { position: 'absolute', right: MENU_EDGE_MARGIN, backgroundColor: '#fff', borderRadius: 8, minWidth: 160, paddingVertical: 4, elevation: 6 },
  item: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  itemText: { fontSize: 15, color: '#333', fontWeight: '500' },
});

export default function HomeMenu({ items }: HomeMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(FALLBACK_TOP);
  const anchorRef = useRef<View>(null);
  const closing = useRef(false);

  // Open just below the button, wherever the header puts it (status bar, notch, edge-to-edge).
  const openMenu = (): void => {
    closing.current = false;
    const anchor = anchorRef.current;
    if (anchor && typeof anchor.measureInWindow === 'function') {
      anchor.measureInWindow((_x, y, _w, height) => {
        setTop(y + height + MENU_GAP);
        setOpen(true);
      });
    } else {
      setTop(FALLBACK_TOP);
      setOpen(true);
    }
  };

  // The fading Modal stays tappable for a frame, so ignore a second tap on any item.
  const choose = (item: HomeMenuItem): void => {
    if (closing.current) return;
    closing.current = true;
    setOpen(false);
    item.onPress();
  };

  return (
    <View ref={anchorRef} collapsable={false}>
      <TouchableOpacity
        onPress={openMenu}
        style={styles.menuButton}
        testID="home-menu-button"
        accessibilityRole="button"
        accessibilityLabel="Menu"
      >
        <Text style={styles.menuGlyph}>{'⋮'}</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)} testID="home-menu-backdrop">
          <View style={[styles.card, { top }]} testID="home-menu">
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
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
