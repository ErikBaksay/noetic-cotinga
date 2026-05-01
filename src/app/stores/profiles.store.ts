import { Injectable, computed, signal } from '@angular/core';
import { Profile } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ProfilesStore {
  private readonly profilesState = signal<Profile[]>([]);
  private readonly activeProfileIdState = signal<string | null>(null);
  private readonly unlockedProfileIdsState = signal<Record<string, true>>({});

  readonly profiles = computed(() => this.profilesState());
  readonly activeProfileId = computed(() => this.activeProfileIdState());
  readonly activeProfile = computed(() => {
    const activeProfileId = this.activeProfileIdState();
    if (!activeProfileId) {
      return null;
    }

    return this.profilesState().find((profile) => profile.id === activeProfileId) ?? null;
  });

  setProfiles(profiles: Profile[]): void {
    this.profilesState.set(profiles);
  }

  setActiveProfileId(profileId: string | null): void {
    this.activeProfileIdState.set(profileId);
  }

  upsertProfile(nextProfile: Profile): void {
    const profiles = this.profilesState();
    const existingIndex = profiles.findIndex((profile) => profile.id === nextProfile.id);

    if (existingIndex >= 0) {
      const updated = [...profiles];
      updated[existingIndex] = nextProfile;
      this.profilesState.set(updated);
      return;
    }

    this.profilesState.set([...profiles, nextProfile]);
  }

  removeProfile(profileId: string): void {
    const filtered = this.profilesState().filter((profile) => profile.id !== profileId);
    this.profilesState.set(filtered);

    if (this.activeProfileIdState() === profileId) {
      this.activeProfileIdState.set(filtered[0]?.id ?? null);
    }

    this.lockProfile(profileId);
  }

  lockProfile(profileId: string): void {
    const unlocked = { ...this.unlockedProfileIdsState() };
    delete unlocked[profileId];
    this.unlockedProfileIdsState.set(unlocked);
  }

  unlockProfile(profileId: string): void {
    this.unlockedProfileIdsState.set({
      ...this.unlockedProfileIdsState(),
      [profileId]: true,
    });
  }

  lockAllProfiles(): void {
    this.unlockedProfileIdsState.set({});
  }

  isUnlocked(profileId: string): boolean {
    return Boolean(this.unlockedProfileIdsState()[profileId]);
  }

  replaceProfiles(profiles: Profile[], activeProfileId: string | null): void {
    this.profilesState.set(profiles);
    this.activeProfileIdState.set(activeProfileId);
    this.unlockedProfileIdsState.set({});
  }
}
