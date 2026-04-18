/**
 * AccordionSection Component
 * 
 * Reusable collapsible section for hiding optional fields.
 * Used for Notes, Split Configuration, etc.
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, LayoutAnimation,
  Platform, UIManager,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface AccordionSectionProps {
  title: string;
  subtitle?: string;
  isOptional?: boolean;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  onToggle?: (expanded: boolean) => void;
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    fontSize: 16,
    color: '#0066cc',
    fontWeight: 'bold',
    width: 20,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  subtitle: {
    fontSize: 12,
    color: '#999',
    fontWeight: '400',
    marginLeft: 4,
  },
  optionalBadge: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    marginLeft: 8,
  },
  content: {
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e0e0e0',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
});

export function AccordionSection({
  title,
  subtitle,
  isOptional = false,
  defaultExpanded = false,
  children,
  onToggle,
}: AccordionSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newExpanded = !expanded;
    setExpanded(newExpanded);
    onToggle?.(newExpanded);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>{expanded ? '▼' : '▶'}</Text>
          <Text style={styles.headerText}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
          {isOptional && <Text style={styles.optionalBadge}>(optional)</Text>}
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.content}>
          {children}
        </View>
      )}
    </View>
  );
}
