import { Injectable, computed, signal } from '@angular/core';
import { AppSettings } from '../models/domain.models';

const DEFAULT_SETTINGS: AppSettings = {
  motionEnabled: true,
};

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly settingsState = signal<AppSettings>(DEFAULT_SETTINGS);

  readonly settings = computed(() => this.settingsState());

  setSettings(settings: AppSettings): void {
    this.settingsState.set(settings);
  }

  updateSettings(patch: Partial<AppSettings>): void {
    this.settingsState.set({
      ...this.settingsState(),
      ...patch,
    });
  }

  reset(): void {
    this.settingsState.set(DEFAULT_SETTINGS);
  }
}
