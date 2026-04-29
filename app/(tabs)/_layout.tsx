import { StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { COLORS, SHADOW } from '../../lib/theme';
import { TabIcon } from '../../components/TabIcon';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.text3,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopWidth: 0,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          ...SHADOW.elevated,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Groups',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: 'Expenses',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💸" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settle"
        options={{
          title: 'Settle',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🤝" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}

// StyleSheet kept here only because TabLayout owns no other files that would
// hold it, and the only style it needs is the shared tab-icon shape (now in
// TabIcon.tsx).  This file is intentionally style-free.
const _styles = StyleSheet.create({});
void _styles; // suppress unused-var warning
