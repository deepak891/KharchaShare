import AsyncStorage from '@react-native-async-storage/async-storage';

export async function getItem<T>(key: string): Promise<T | null> {
  const value = await AsyncStorage.getItem(key);
  return value ? (JSON.parse(value) as T) : null;
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function removeItem(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

export async function clearAll(): Promise<void> {
  await AsyncStorage.clear();
}

// Storage keys
export const STORAGE_KEYS = {
  GROUPS: 'groups',
  EXPENSES: 'expenses',
  USER_PROFILE: 'user_profile',
  SETTLEMENTS: 'settlements',
} as const;
