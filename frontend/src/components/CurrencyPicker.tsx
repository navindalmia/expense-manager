/**
 * CurrencyPicker
 *
 * Shared currency selector for the group Create screen and Edit modal.
 * Always lists the currencies fetched from the backend (/currencies) so both
 * views show the same list (GitHub #51).
 *
 * Guarantees the user never submits a currency they cannot see: if `value`
 * is not in the loaded list, onChange is called with the first loaded
 * currency. On load failure or an empty list an explanatory message is
 * shown (with Retry on failure).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { getCurrencies, type Currency } from '../services/currencyService';
import { logger } from '../utils/logger';

interface CurrencyPickerProps {
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
  /** Each option's testID is `${testIDPrefix}${code}`. */
  testIDPrefix: string;
}

// NOTE: user-facing strings are plain English; the app has no i18n layer yet.
type LoadStatus = 'loading' | 'ready' | 'error';

export default function CurrencyPicker({
  value,
  onChange,
  disabled = false,
  testIDPrefix,
}: CurrencyPickerProps): React.ReactElement {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    getCurrencies()
      .then((data) => {
        if (cancelled) return;
        setCurrencies(data);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        logger.error('Failed to load currencies', error);
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Never leave a currency selected that the user cannot see in the list.
  useEffect(() => {
    if (status === 'ready' && currencies.length > 0 && !currencies.some((c) => c.code === value)) {
      onChange(currencies[0].code);
    }
  }, [status, currencies, value, onChange]);

  const retry = useCallback((): void => setAttempt((n) => n + 1), []);

  if (status === 'loading') {
    return <ActivityIndicator size="small" color="#0066cc" style={styles.loader} />;
  }

  if (status === 'error') {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.message}>Could not load currencies.</Text>
        <TouchableOpacity onPress={retry} testID={`${testIDPrefix}retry`} accessibilityRole="button">
          <Text style={styles.retry}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currencies.length === 0) {
    return (
      <View style={styles.messageBox}>
        <Text style={styles.message}>No currencies are available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currencies.map((curr) => (
        <TouchableOpacity
          key={curr.id}
          style={[styles.button, value === curr.code && styles.buttonActive]}
          onPress={() => onChange(curr.code)}
          disabled={disabled}
          testID={`${testIDPrefix}${curr.code}`}
          accessibilityLabel={`Select ${curr.code}`}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === curr.code }}
        >
          <Text style={[styles.text, value === curr.code && styles.textActive]}>{curr.code}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  loader: { marginVertical: 10 },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  message: { fontSize: 13, color: '#cc0000' },
  retry: { fontSize: 13, color: '#0066cc', fontWeight: '600' },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  buttonActive: { borderColor: '#0066cc', backgroundColor: '#e6f0ff' },
  text: { fontSize: 14, color: '#666', fontWeight: '500' },
  textActive: { color: '#0066cc', fontWeight: '600' },
});
