import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS } from '../lib/theme';
import type { ParsedExpense } from '../lib/types';

interface ParseResultModalProps {
  result: ParsedExpense;
  onClose: () => void;
  onAdd: () => void;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return '✓ High confidence';
  if (confidence >= 0.6)  return '~ Medium confidence';
  return '⚠ Low confidence — please review';
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.85) return COLORS.success;
  if (confidence >= 0.6)  return '#F59E0B';
  return COLORS.danger;
}

export function ParseResultModal({ result, onClose, onAdd }: ParseResultModalProps) {
  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>AI Split Result ✨</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.description}>{result.description}</Text>
              <Text style={styles.total}>₹{result.total.toLocaleString('en-IN')}</Text>
              {result.paid_by != null && (
                <Text style={styles.paidBy}>Paid by {result.paid_by}</Text>
              )}
            </View>

            {/* Splits */}
            <Text style={styles.splitsHeader}>How it's split</Text>
            {result.splits.map(split => (
              <View key={split.person} style={styles.splitRow}>
                <View style={styles.avatarCircle}>
                  <Text style={styles.avatarText}>{split.person[0]}</Text>
                </View>
                <Text style={styles.splitName}>{split.person}</Text>
                <Text style={styles.splitPct}>{split.percentage}%</Text>
                <Text style={styles.splitAmount}>₹{Math.round(split.amount)}</Text>
              </View>
            ))}

            {/* Notes */}
            {result.notes.length > 0 && (
              <View style={styles.notesBox}>
                <Text style={styles.notesText}>💡 {result.notes}</Text>
              </View>
            )}

            {/* Confidence */}
            <Text style={[styles.confidence, { color: confidenceColor(result.confidence) }]}>
              {confidenceLabel(result.confidence)}
            </Text>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
              <Text style={styles.addText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '88%',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', color: COLORS.text1 },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { fontSize: 13, color: COLORS.text2, fontWeight: '600' },

  // Summary
  summaryCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  description: { fontSize: 15, fontWeight: '600', color: COLORS.primary, marginBottom: 4 },
  total:       { fontSize: 32, fontWeight: '800', color: COLORS.primary },
  paidBy:      { fontSize: 13, color: COLORS.text2, marginTop: 4 },

  // Split rows
  splitsHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  splitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText:  { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  splitName:   { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.text1 },
  splitPct:    { fontSize: 13, color: COLORS.text3, width: 44, textAlign: 'right' },
  splitAmount: { fontSize: 16, fontWeight: '700', color: COLORS.text1, width: 72, textAlign: 'right' },

  // Notes
  notesBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: RADIUS.sm,
    padding: 10,
    marginTop: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  notesText: { fontSize: 13, color: '#92400E', lineHeight: 18 },

  confidence: { fontSize: 12, fontWeight: '600', marginTop: 10, marginBottom: 4 },

  // Action buttons
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '600', color: COLORS.text2 },
  addBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  addText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
