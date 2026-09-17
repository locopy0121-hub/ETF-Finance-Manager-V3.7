import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MonitorPersistedSettings } from '../types/monitor';

export const MONITOR_STORAGE_KEY = 'monitor_settings_v3';

export class MonitorStorageAdapter {
  public async load(): Promise<MonitorPersistedSettings | null> {
    const raw = await AsyncStorage.getItem(MONITOR_STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<MonitorPersistedSettings>;
      if (parsed.schemaVersion !== 3 || !parsed.instance || !Array.isArray(parsed.templates)) return null;
      return parsed as MonitorPersistedSettings;
    } catch {
      return null;
    }
  }

  public async save(settings: MonitorPersistedSettings): Promise<void> {
    await AsyncStorage.setItem(MONITOR_STORAGE_KEY, JSON.stringify(settings));
  }

  public async clear(): Promise<void> {
    await AsyncStorage.removeItem(MONITOR_STORAGE_KEY);
  }
}

export const monitorStorageAdapter = new MonitorStorageAdapter();
