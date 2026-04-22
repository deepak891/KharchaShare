import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SHADOW } from '../lib/theme';

export interface SettlePerson {
  id: string;
  name: string;
  initials: string;
  initialsColor: string;
  initBg: string;
  amount: number;
  group: string;
}

interface PersonCardProps {
  person: SettlePerson;
  type: 'owe' | 'owed';
  onPay?: () => void;
  onRemind?: () => void;
}

export function PersonCard({ person, type, onPay, onRemind }: PersonCardProps) {
  return (
    <View style={styles.card}>
      <View style={[styles.avatar, { backgroundColor: person.initBg }]}>
        <Text style={[styles.initials, { color: person.initialsColor }]}>
          {person.initials}
        </Text>
      </View>

      <View style={styles.info}>
        <Text style={styles.name}>{person.name}</Text>
        <Text style={styles.group}>{person.group}</Text>
      </View>

      <View style={styles.right}>
        <Text style={[styles.amount, type === 'owe' ? styles.colorDanger : styles.colorSuccess]}>
          ₹{person.amount}
        </Text>
        {type === 'owe' ? (
          <TouchableOpacity style={styles.payButton} activeOpacity={0.8} onPress={onPay}>
            <Text style={styles.payButtonText}>Pay via UPI</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.remindButton} activeOpacity={0.8} onPress={onRemind}>
            <Text style={styles.remindButtonText}>Remind 🔔</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 14,
    marginBottom: 10,
    ...SHADOW.card,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  initials: { fontSize: 18, fontWeight: '700' },
  info:     { flex: 1 },
  name:     { fontSize: 15, fontWeight: '600', color: COLORS.text1, marginBottom: 3 },
  group:    { fontSize: 12, color: COLORS.text3 },
  right:    { alignItems: 'flex-end', gap: 6 },
  amount:   { fontSize: 17, fontWeight: '700' },

  payButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  payButtonText: { fontSize: 12, color: '#FFFFFF', fontWeight: '600' },

  remindButton: {
    backgroundColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  remindButtonText: { fontSize: 12, color: COLORS.text2, fontWeight: '600' },

  colorSuccess: { color: COLORS.success },
  colorDanger:  { color: COLORS.danger  },
});
