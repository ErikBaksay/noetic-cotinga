import {
  Collection,
  ConflictResolution,
  Note,
  Profile,
  ProfileData,
  StoredProfileBlob,
  VaultIndex,
} from '../models/domain.models';

export const STORAGE_KEY_INDEX = 'noetic-cotinga:index';
export const STORAGE_KEY_PROFILE_PREFIX = 'noetic-cotinga:profile:';

export const DEFAULT_COLLECTION_COLORS = [
  '#8fd3ff',
  '#9ee4b4',
  '#f7d49a',
  '#f1b6d9',
  '#c7b8ff',
  '#a6dce8',
];

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function safeParseJson<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function createEmptyProfileData(): ProfileData {
  return {
    collections: [],
    notes: [],
    updatedAt: nowIso(),
  };
}

export function createDefaultProfile(): Profile {
  const timestamp = nowIso();
  return {
    id: createId('profile'),
    name: 'Personal',
    encryptionState: 'none',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createDefaultIndex(profile: Profile): VaultIndex {
  return {
    schemaVersion: 1,
    activeProfileId: profile.id,
    profiles: [profile],
    settings: {
      motionEnabled: true,
    },
  };
}

export function duplicateName(name: string, suffix: string): string {
  const trimmed = name.trim() || 'Untitled';
  return `${trimmed} (${suffix})`;
}

export function createUntitledNote(profileId: string, collectionId: string): Note {
  const timestamp = nowIso();
  return {
    id: createId('note'),
    profileId,
    collectionId,
    title: 'Untitled note',
    tiptapDoc: {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    pinned: false,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createCollection(profileId: string, name: string, color: string): Collection {
  const timestamp = nowIso();
  return {
    id: createId('collection'),
    profileId,
    name: name.trim() || 'New collection',
    color,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function profileStorageKey(profileId: string): string {
  return `${STORAGE_KEY_PROFILE_PREFIX}${profileId}`;
}

export function compareByUpdatedAtDesc<T extends { pinned?: boolean; updatedAt: string }>(left: T, right: T): number {
  const leftPinned = Boolean(left.pinned);
  const rightPinned = Boolean(right.pinned);

  if (leftPinned !== rightPinned) {
    return leftPinned ? -1 : 1;
  }

  return right.updatedAt.localeCompare(left.updatedAt);
}

export function resolveByUpdatedAt(localUpdatedAt: string, importedUpdatedAt: string): ConflictResolution {
  return importedUpdatedAt.localeCompare(localUpdatedAt) >= 0 ? 'keep_imported' : 'keep_local';
}

export function isEncryptedBlob(blob: StoredProfileBlob | null): blob is Extract<StoredProfileBlob, { kind: 'encrypted' }> {
  return Boolean(blob && blob.kind === 'encrypted');
}

export function toFileSafeTimestamp(timestamp: string): string {
  return timestamp.replace(/[.:]/g, '-');
}
