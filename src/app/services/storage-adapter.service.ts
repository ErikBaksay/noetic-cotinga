import { Injectable } from '@angular/core';
import { PersistedStorageSnapshot, StoredProfileBlob, VaultIndex } from '../models/domain.models';
import { STORAGE_KEY_INDEX, profileStorageKey, safeParseJson } from '../utils/model.utils';

@Injectable({ providedIn: 'root' })
export class StorageAdapterService {
  loadIndex(): VaultIndex | null {
    return safeParseJson<VaultIndex>(localStorage.getItem(STORAGE_KEY_INDEX));
  }

  saveIndex(index: VaultIndex): void {
    localStorage.setItem(STORAGE_KEY_INDEX, JSON.stringify(index));
  }

  loadProfileBlob(profileId: string): StoredProfileBlob | null {
    return safeParseJson<StoredProfileBlob>(localStorage.getItem(profileStorageKey(profileId)));
  }

  saveProfileBlob(profileId: string, blob: StoredProfileBlob): void {
    localStorage.setItem(profileStorageKey(profileId), JSON.stringify(blob));
  }

  removeProfile(profileId: string): void {
    localStorage.removeItem(profileStorageKey(profileId));
  }

  loadSnapshot(index: VaultIndex): PersistedStorageSnapshot {
    const blobs = index.profiles.reduce<Record<string, StoredProfileBlob | null>>((accumulator, profile) => {
      accumulator[profile.id] = this.loadProfileBlob(profile.id);
      return accumulator;
    }, {});

    return {
      index,
      profileBlobs: blobs,
    };
  }

  restoreSnapshot(snapshot: PersistedStorageSnapshot): void {
    this.saveIndex(snapshot.index);

    Object.entries(snapshot.profileBlobs).forEach(([profileId, blob]) => {
      if (blob) {
        this.saveProfileBlob(profileId, blob);
      }
    });
  }
}
