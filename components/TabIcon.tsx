import { StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../lib/theme';

interface TabIconProps {
  emoji: string;
  focused: boolean;
}

export function TabIcon({ emoji, focused }: TabIconProps) {
  return (
    <View style={[styles.container, focused && styles.active]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  active: {
    backgroundColor: COLORS.primaryLight,
  },
  emoji: {
    fontSize: 18,
  },
});
