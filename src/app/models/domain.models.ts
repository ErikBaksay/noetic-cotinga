export const SCHEMA_VERSION = 1;

export type EntityId = string;
export type IsoTimestamp = string;

export type ExportType = 'note' | 'collection' | 'profile' | 'all';
export type ProfileEncryptionState = 'none' | 'enabled';
export type EntityType = 'collection' | 'note';
export type ConflictResolution = 'keep_local' | 'keep_imported' | 'duplicate';

export interface Profile {
  id: EntityId;
  name: string;
  encryptionState: ProfileEncryptionState;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface Collection {
  id: EntityId;
  profileId: EntityId;
  name: string;
  color: string;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface Note {
  id: EntityId;
  profileId: EntityId;
  collectionId: EntityId;
  title: string;
  tiptapDoc: Record<string, unknown>;
  pinned: boolean;
  archived: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface AppSettings {
  motionEnabled: boolean;
}

export interface VaultIndex {
  schemaVersion: number;
  activeProfileId: EntityId | null;
  profiles: Profile[];
  settings: AppSettings;
}

export interface ProfileData {
  collections: Collection[];
  notes: Note[];
  updatedAt: IsoTimestamp;
}

export interface EncryptedPayload {
  cipherText: string;
  iv: string;
  salt: string;
  iterations: number;
  algorithm: 'AES-GCM';
}

export interface PlainProfileBlob {
  kind: 'plain';
  schemaVersion: number;
  data: ProfileData;
}

export interface EncryptedProfileBlob {
  kind: 'encrypted';
  schemaVersion: number;
  payload: EncryptedPayload;
}

export type StoredProfileBlob = PlainProfileBlob | EncryptedProfileBlob;

export interface ExportEnvelope {
  schemaVersion: number;
  exportType: ExportType;
  createdAt: IsoTimestamp;
  sourceProfileIds: EntityId[];
  payload: ExportPayload;
}

export type ExportPayload =
  | NoteExportPayload
  | CollectionExportPayload
  | ProfileExportPayload
  | AllProfilesExportPayload;

export interface NoteExportPayload {
  type: 'note';
  profile: Profile;
  collection: Collection | null;
  note: Note;
}

export interface CollectionExportPayload {
  type: 'collection';
  profile: Profile;
  collection: Collection;
  notes: Note[];
}

export interface ProfileExportPayload {
  type: 'profile';
  profile: Profile;
  blob: StoredProfileBlob;
}

export interface AllProfilesExportPayload {
  type: 'all';
  index: VaultIndex;
  profileBlobs: Record<EntityId, StoredProfileBlob | null>;
}

export interface ConflictEntityVersion<T> {
  local: T;
  imported: T;
}

export interface ConflictItem {
  entityType: EntityType;
  entityId: EntityId;
  displayName: string;
  suggestedResolution: ConflictResolution;
  versions: ConflictEntityVersion<Collection | Note>;
}

export interface ConflictDecision {
  entityType: EntityType;
  entityId: EntityId;
  resolution: ConflictResolution;
}

export interface PendingImportMerge {
  incomingCollections: Collection[];
  incomingNotes: Note[];
  conflicts: ConflictItem[];
}

export interface ImportResult {
  applied: boolean;
  mergedCollections: Collection[];
  mergedNotes: Note[];
}

export interface RuntimeLockState {
  profileId: EntityId;
  isLocked: boolean;
}

export interface PersistedStorageSnapshot {
  index: VaultIndex;
  profileBlobs: Record<EntityId, StoredProfileBlob | null>;
}
