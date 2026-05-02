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
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { COLORS, RADIUS, SHADOW } from '../lib/theme';
import { EMOJI_OPTIONS, COLOR_OPTIONS } from '../lib/constants';
import { createGroup } from '../lib/api';

export default function GroupCreateScreen() {
  const router = useRouter();

  const [groupName, setGroupName]         = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string>(EMOJI_OPTIONS[0].emoji);
  const [selectedColor, setSelectedColor] = useState<string>(COLOR_OPTIONS[0].hex);
  const [memberInput, setMemberInput]     = useState('');
  const [members, setMembers]             = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [errors, setErrors]               = useState<{ name?: string; members?: string }>({});

  const isValid = groupName.trim().length > 0 && members.length >= 1;

  function handleAddMember() {
    const name = memberInput.trim();
    if (!name) return;
    if (!members.includes(name)) {
      setMembers(prev => [...prev, name]);
      setErrors(e => ({ ...e, members: undefined }));
    }
    setMemberInput('');
  }

  function handleRemoveMember(name: string) {
    setMembers(prev => prev.filter(m => m !== name));
  }

  async function handleSubmit() {
    const newErrors: typeof errors = {};
    if (!groupName.trim()) newErrors.name = 'Group name is required';
    if (members.length === 0) newErrors.members = 'Add at least one member';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await createGroup({ name: groupName.trim(), emoji: selectedEmoji, color: selectedColor, members });
      router.back();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Could not create group', msg, [{ text: 'OK' }]);
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
          <Text style={styles.headerTitle}>New Group</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Live preview */}
          <View style={styles.previewRow}>
            <View style={[styles.previewBubble, { backgroundColor: selectedColor }]}>
              <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
            </View>
            <Text style={styles.previewName} numberOfLines={1}>
              {groupName.trim() || 'My Group'}
            </Text>
          </View>

          {/* Group name */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Group Name</Text>
            <TextInput
              style={[styles.nameInput, errors.name != null && styles.inputError]}
              placeholder="e.g. Goa Trip 2026"
              placeholderTextColor={COLORS.text3}
              value={groupName}
              onChangeText={t => { setGroupName(t); setErrors(e => ({ ...e, name: undefined })); }}
              returnKeyType="done"
              maxLength={40}
            />
            {errors.name != null && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Emoji picker */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Pick an Emoji</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              {EMOJI_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.emoji}
                  style={[styles.emojiOption, selectedEmoji === opt.emoji && styles.emojiOptionSelected]}
                  onPress={() => setSelectedEmoji(opt.emoji)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.emojiOptionText}>{opt.emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Color picker */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Emoji Background</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
              {COLOR_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.hex}
                  style={[styles.colorSwatch, { backgroundColor: opt.hex }, selectedColor === opt.hex && styles.colorSwatchSelected]}
                  onPress={() => setSelectedColor(opt.hex)}
                  activeOpacity={0.8}
                >
                  {selectedColor === opt.hex && <Text style={styles.colorSwatchCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Members */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>Members</Text>
            <View style={styles.memberInputRow}>
              <TextInput
                style={[styles.memberTextInput, errors.members != null && styles.inputError]}
                placeholder="Add a name…"
                placeholderTextColor={COLORS.text3}
                value={memberInput}
                onChangeText={setMemberInput}
                onSubmitEditing={handleAddMember}
                returnKeyType="done"
                autoCapitalize="words"
              />
              <TouchableOpacity
                style={[styles.addMemberBtn, !memberInput.trim() && styles.addMemberBtnDisabled]}
                onPress={handleAddMember}
                disabled={!memberInput.trim()}
                activeOpacity={0.7}
              >
                <Text style={styles.addMemberBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {errors.members != null && <Text style={styles.errorText}>{errors.members}</Text>}

            {members.length > 0 && (
              <View style={styles.chipsWrap}>
                {members.map(name => (
                  <View key={name} style={styles.chip}>
                    <View style={styles.chipAvatar}>
                      <Text style={styles.chipAvatarText}>{name[0].toUpperCase()}</Text>
                    </View>
                    <Text style={styles.chipName}>{name}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveMember(name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.chipRemove}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* Sticky CTA */}
        <View style={styles.ctaContainer}>
          <TouchableOpacity
            style={[styles.ctaBtn, (!isValid || isSubmitting) && styles.ctaBtnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Text style={styles.ctaBtnText}>Create Group</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text1 },

  scrollContent: { paddingHorizontal: 20, paddingTop: 8 },

  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 16, marginBottom: 16, ...SHADOW.card,
  },
  previewBubble: { width: 56, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  previewEmoji:  { fontSize: 26 },
  previewName:   { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.text1 },

  sectionCard: {
    backgroundColor: COLORS.card, borderRadius: RADIUS.lg,
    padding: 20, marginBottom: 16, ...SHADOW.card,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700', color: COLORS.text2,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14,
  },

  nameInput: {
    fontSize: 16, fontWeight: '500', color: COLORS.text1,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 16, paddingVertical: 13,
  },
  inputError: { borderColor: COLORS.danger },
  errorText:  { fontSize: 12, color: COLORS.danger, fontWeight: '500', marginTop: 6 },

  pickerRow: { gap: 10, paddingVertical: 4 },
  emojiOption: {
    width: 54, height: 54, borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background, alignItems: 'center',
    justifyContent: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  emojiOptionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  emojiOptionText:     { fontSize: 24 },
  colorSwatch: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: 'transparent',
  },
  colorSwatchSelected: { borderColor: COLORS.text1 },
  colorSwatchCheck:    { fontSize: 16, color: COLORS.text1, fontWeight: '800' },

  memberInputRow:       { flexDirection: 'row', gap: 10, alignItems: 'center' },
  memberTextInput: {
    flex: 1, fontSize: 15, color: COLORS.text1,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 14, paddingVertical: 12,
  },
  addMemberBtn:         { backgroundColor: COLORS.primary, borderRadius: RADIUS.sm, paddingHorizontal: 18, paddingVertical: 13 },
  addMemberBtnDisabled: { backgroundColor: COLORS.border },
  addMemberBtnText:     { fontSize: 14, fontWeight: '700', color: '#FFF' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.primaryLight, borderRadius: 20,
    paddingLeft: 6, paddingRight: 10, paddingVertical: 6, gap: 6,
  },
  chipAvatar: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  chipAvatarText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  chipName:       { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  chipRemove:     { fontSize: 18, color: COLORS.primary, lineHeight: 20 },

  ctaContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, backgroundColor: COLORS.background },
  ctaBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    paddingVertical: 16, alignItems: 'center', ...SHADOW.elevated,
  },
  ctaBtnDisabled: { backgroundColor: COLORS.text3, ...SHADOW.card },
  ctaBtnText:     { fontSize: 16, fontWeight: '800', color: '#FFF', letterSpacing: 0.3 },
});
