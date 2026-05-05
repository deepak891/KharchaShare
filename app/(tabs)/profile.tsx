import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SHADOW } from '../../lib/theme';
import { MOCK_USER_NAME } from '../../lib/constants';

// ── Screen-local data ─────────────────────────────────────────────────────────

const MOCK_PROFILE = {
  name: `${MOCK_USER_NAME} Kumar`,
  email: 'deepak@example.com',
  initial: MOCK_USER_NAME[0],
  upiId: 'deepak@okaxis',
};

const MOCK_STATS = [
  { id: 'groups',   label: 'Groups',   value: '3',  emoji: '👥' },
  { id: 'expenses', label: 'Expenses', value: '12', emoji: '💸' },
  { id: 'settled',  label: 'Settled',  value: '8',  emoji: '✅' },
];

interface SettingsItem {
  id: string;
  emoji: string;
  label: string;
  sublabel?: string;
  danger?: boolean;
}

const SETTINGS_ITEMS: SettingsItem[] = [
  { id: 'account',       emoji: '👤', label: 'Account',        sublabel: 'Edit profile & UPI ID'  },
  { id: 'notifications', emoji: '🔔', label: 'Notifications',  sublabel: 'Reminders & alerts'     },
  { id: 'darkmode',      emoji: '🌙', label: 'Dark Mode',      sublabel: 'Coming soon'            },
  { id: 'invite',        emoji: '🎁', label: 'Invite Friends', sublabel: 'Share the love'         },
  { id: 'help',          emoji: '💬', label: 'Help & Support'                                     },
  { id: 'signout',       emoji: '🚪', label: 'Sign Out',       danger: true                       },
];

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarOuter}>
            <View style={styles.avatarInner}>
              <Text style={styles.avatarInitial}>{MOCK_PROFILE.initial}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{MOCK_PROFILE.name}</Text>
          <Text style={styles.profileEmail}>{MOCK_PROFILE.email}</Text>
          <View style={styles.upiTag}>
            <Text style={styles.upiTagText}>📱 {MOCK_PROFILE.upiId}</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          {MOCK_STATS.map((stat, idx) => (
            <React.Fragment key={stat.id}>
              <View style={styles.statItem}>
                <Text style={styles.statEmoji}>{stat.emoji}</Text>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
              {idx < MOCK_STATS.length - 1 && <View style={styles.statDivider} />}
            </React.Fragment>
          ))}
        </View>

        {/* Settings */}
        <View style={styles.settingsList}>
          {SETTINGS_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.settingsItem,
                idx === SETTINGS_ITEMS.length - 1 && styles.settingsItemLast,
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.settingsEmojiBox}>
                <Text style={styles.settingsEmoji}>{item.emoji}</Text>
              </View>
              <View style={styles.settingsTextBox}>
                <Text style={[styles.settingsLabel, item.danger && styles.dangerText]}>
                  {item.label}
                </Text>
                {item.sublabel != null && (
                  <Text style={styles.settingsSublabel}>{item.sublabel}</Text>
                )}
              </View>
              {!item.danger && <Text style={styles.settingsChevron}>›</Text>}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.versionText}>KharchaShare v1.0.0</Text>
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:      { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { paddingTop: 16 },

  avatarSection: { alignItems: 'center', paddingTop: 16, paddingBottom: 28 },
  avatarOuter: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14, ...SHADOW.elevated,
  },
  avatarInner: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: '#FFFFFF' },
  profileName:   { fontSize: 22, fontWeight: '700', color: COLORS.text1, marginBottom: 4 },
  profileEmail:  { fontSize: 14, color: COLORS.text2, marginBottom: 10 },
  upiTag:        { backgroundColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  upiTagText:    { fontSize: 13, color: COLORS.text2, fontWeight: '500' },

  statsCard: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, marginHorizontal: 20,
    marginBottom: 24, padding: 20, ...SHADOW.card,
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statEmoji:  { fontSize: 20, marginBottom: 4 },
  statValue:  { fontSize: 24, fontWeight: '800', color: COLORS.text1, marginBottom: 2 },
  statLabel:  { fontSize: 12, color: COLORS.text2, fontWeight: '500' },
  statDivider:{ width: 1, backgroundColor: COLORS.border, marginVertical: 4 },

  settingsList: {
    marginHorizontal: 20, backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg, overflow: 'hidden',
    marginBottom: 20, ...SHADOW.card,
  },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  settingsItemLast:  { borderBottomWidth: 0 },
  settingsEmojiBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  settingsEmoji:    { fontSize: 17 },
  settingsTextBox:  { flex: 1 },
  settingsLabel:    { fontSize: 15, fontWeight: '600', color: COLORS.text1 },
  settingsSublabel: { fontSize: 12, color: COLORS.text3, marginTop: 2 },
  settingsChevron:  { fontSize: 22, color: COLORS.border, lineHeight: 24 },
  dangerText:       { color: COLORS.danger },

  versionText: { textAlign: 'center', fontSize: 12, color: COLORS.text3, marginBottom: 4 },
});
