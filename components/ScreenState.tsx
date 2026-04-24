/**
 * ScreenState — loading, error, and empty state display.
 *
 * Open/Closed Principle: the component is open for extension (callers
 * customise every string and emoji via props) but closed for modification
 * (the layout logic never changes when a new screen is added).
 *
 * Before this component existed, the same ActivityIndicator + stateContainer
 * + retryBtn pattern was copy-pasted into index.tsx, settle.tsx, and
 * group-detail.tsx. Any style fix had to be applied in three places.
 *
 * Usage:
 *
 *   // Loading
 *   <ScreenState variant="loading" message="Loading groups…" />
 *
 *   // Error with retry
 *   <ScreenState variant="error" message={error} onRetry={reload} />
 *
 *   // Empty
 *   <ScreenState variant="empty" emoji="🏕️" title="No groups yet"
 *                message="Tap + to create your first group" />
 */

import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, RADIUS } from '../lib/theme';

type ScreenStateProps =
  | { variant: 'loading'; message?: string }
  | { variant: 'error';   message: string; onRetry?: () => void }
  | { variant: 'empty';   emoji?: string;  title?: string; message?: string };

export function ScreenState(props: ScreenStateProps) {
  return (
    <View style={styles.container}>
      {props.variant === 'loading' && (
        <>
          <ActivityIndicator size="large" color={COLORS.primary} />
          {props.message != null && (
            <Text style={styles.message}>{props.message}</Text>
          )}
        </>
      )}

      {props.variant === 'error' && (
        <>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={[styles.message, styles.errorText]}>{props.message}</Text>
          {props.onRetry != null && (
            <TouchableOpacity style={styles.retryBtn} onPress={props.onRetry}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {props.variant === 'empty' && (
        <>
          {props.emoji != null && (
            <Text style={styles.emoji}>{props.emoji}</Text>
          )}
          {props.title != null && (
            <Text style={styles.title}>{props.title}</Text>
          )}
          {props.message != null && (
            <Text style={styles.message}>{props.message}</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emoji:     { fontSize: 48 },
  title:     { fontSize: 18, fontWeight: '700', color: COLORS.text1 },
  message:   { fontSize: 14, color: COLORS.text2, textAlign: 'center', paddingHorizontal: 24 },
  errorText: { color: COLORS.danger },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.sm,
  },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
});
