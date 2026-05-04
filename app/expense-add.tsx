/**
 * Add / Edit Expense Screen
 *
 * Shared screen for two modes:
 *   Add mode  — no `expenseId` param → POST /api/groups/{id}/expenses
 *   Edit mode — `expenseId` param present, form pre-filled → PUT /api/groups/{id}/expenses/{expenseId}
 *
 * After save, navigating back triggers useFocusEffect on the group detail
 * screen which re-fetches expenses + balances + debts automatically.
 */

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { COLORS, RADIUS, SHADOW } from '../lib/theme';
import { MOCK_USER_NAME } from '../lib/constants';
import { createExpense, updateExpense } from '../lib/api';
import { computeEqualSplits } from '../lib/calculations';
import { formatCurrency } from '../lib/formatting';
import { AvatarCircle } from '../components/AvatarCircle';
import { MemberChip } from '../components/MemberChip';

export default function ExpenseAddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    groupId: string;
    groupName: string;
    members: string;
    expenseId?: string;
    initDescription?: string;
    initAmount?: string;
    initPaidBy?: string;
  }>();

  const groupId    = params.groupId ?? '';
  const groupName  = params.groupName ?? 'Group';
  const members    = JSON.parse(params.members ?? '[]') as string[];
  const expenseId  = params.expenseId ?? '';
  const isEditMode = expenseId !== '';

  const [description, setDescription] = useState(params.initDescription ?? '');
  const [amountText, setAmountText]   = useState(params.initAmount ?? '');
  const [paidBy, setPaidBy]           = useState<string>(
    params.initPaidBy ??
    (members.includes(MOCK_USER_NAME) ? MOCK_USER_NAME : (members[0] ?? ''))
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors]             = useState<{ description?: string; amount?: string }>({});

  const total  = parseFloat(amountText) || 0;
  const splits = computeEqualSplits(total, members);
  const isValid = description.trim().length > 0 && total > 0 && paidBy !== '';

  async function handleSubmit() {
    const newErrors: typeof errors = {};
    if (!description.trim()) newErrors.description = 'Description is required';
    if (total <= 0)           newErrors.amount      = 'Enter a valid amount';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    const payload = {
      description: description.trim(),
      total,
      currency: 'INR',
      paid_by: paidBy,
      splits,
      notes: `Equal split among ${members.length} members`,
    };

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await updateExpense(groupId, expenseId, payload);
      } else {
        await createExpense(groupId, payload);
      }
      router.back();
    } catch (err) {
      const msg   = err instanceof Error ? err.message : 'Something went wrong';
      const title = isEditMode ? 'Could not update expense' : 'Could not add expense';
      Alert.alert(title, msg, [{ text: 'OK' }]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backArrow}>‹</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>
              {isEditMode ? 'Edit Expense' : 'Add Expense'}
            </Text>
            <Text style={styles.headerSub}>{groupName}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>What was it for?</Text>
            <TextInput
              style={[styles.input, errors.description != null && styles.inputError]}
              placeholder="e.g. Dinner at Dhaba, Petrol, Hotel"
              placeholderTextColor={COLORS.text3}
              value={description}
              onChangeText={t => { setDescription(t); setErrors(e => ({ ...e, description: undefined })); }}
              returnKeyType="next"
              autoCapitalize="sentences"
              maxLength={80}
            />
            {errors.description != null && (
              <Text style={styles.errorText}>{errors.description}</Text>
            )}
          </View>

          {/* Amount */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Amount</Text>
            <View style={styles.amountRow}>
              <View style={styles.amountPrefix}>
                <Text style={styles.amountPrefixText}>₹</Text>
              </View>
              <TextInput
                style={[styles.amountInput, errors.amount != null && styles.inputError]}
                placeholder="0"
                placeholderTextColor={COLORS.text3}
                value={amountText}
                onChangeText={t => { setAmountText(t.replace(/[^0-9.]/g, '')); setErrors(e => ({ ...e, amount: undefined })); }}
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>
            {errors.amount != null && (
              <Text style={styles.errorText}>{errors.amount}</Text>
            )}
          </View>

          {/* Paid by — uses MemberChip */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Paid By</Text>
            <View style={styles.chips}>
              {members.map(m => (
                <MemberChip
                  key={m}
                  name={m}
                  label={m === MOCK_USER_NAME ? 'You' : m}
                  selected={paidBy === m}
                  onSelect={() => setPaidBy(m)}
                />
              ))}
            </View>
          </View>

          {/* Live split preview — uses AvatarCircle */}
          {total > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Equal Split</Text>
              {splits.map((s, idx) => (
                <View
                  key={s.person}
                  style={[styles.splitRow, idx < splits.length - 1 && styles.splitRowBorder]}
                >
                  <AvatarCircle name={s.person} size={32} />
                  <Text style={styles.splitName}>
                    {s.person === MOCK_USER_NAME ? 'You' : s.person}
                  </Text>
                  <Text style={styles.splitAmount}>{formatCurrency(s.amount)}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.ctaBtn, (!isValid || isSubmitting) && styles.ctaBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.ctaBtnText}>
                  {isEditMode ? 'Save Changes' : 'Add Expense'}
                </Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20,
    paddingVertical: 14, backgroundColor: COLORS.background,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.card, alignItems: 'center',
    justifyContent: 'center', ...SHADOW.card,
  },
  backArrow:   { fontSize: 26, color: COLORS.text1, lineHeight: 30, marginTop: -2 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text1, textAlign: 'center' },
  headerSub:   { fontSize: 12, color: COLORS.text2, textAlign: 'center', marginTop: 1 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  card: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 20, marginBottom: 16, ...SHADOW.card,
  },
  cardLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.text2,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
  },

  input: {
    fontSize: 16, fontWeight: '500', color: COLORS.text1,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 16, paddingVertical: 13,
  },
  inputError: { borderColor: COLORS.danger },
  errorText:  { fontSize: 12, color: COLORS.danger, fontWeight: '500', marginTop: 6 },

  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  amountPrefix: {
    width: 48, height: 50, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
  },
  amountPrefixText: { fontSize: 20, fontWeight: '700', color: COLORS.primary },
  amountInput: {
    flex: 1, fontSize: 28, fontWeight: '800', color: COLORS.text1,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 16, paddingVertical: 10,
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  splitRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, gap: 12,
  },
  splitRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  splitName:      { flex: 1, fontSize: 14, fontWeight: '500', color: COLORS.text1 },
  splitAmount:    { fontSize: 15, fontWeight: '700', color: COLORS.text1 },

  ctaContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: COLORS.background },
  ctaBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 16, alignItems: 'center', ...SHADOW.elevated,
  },
  ctaBtnDisabled: { backgroundColor: COLORS.text3, ...SHADOW.card },
  ctaBtnText:     { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});
