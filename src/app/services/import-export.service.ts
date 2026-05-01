import { Injectable } from '@angular/core';
import {
  AllProfilesExportPayload,
  Collection,
  CollectionExportPayload,
  ExportEnvelope,
  Note,
  NoteExportPayload,
  Profile,
  ProfileData,
  ProfileExportPayload,
  SCHEMA_VERSION,
  StoredProfileBlob,
  VaultIndex,
} from '../models/domain.models';
import { toFileSafeTimestamp } from '../utils/model.utils';

@Injectable({ providedIn: 'root' })
export class ImportExportService {
  createNoteExport(profile: Profile, note: Note, collection: Collection | null): ExportEnvelope {
    const payload: NoteExportPayload = {
      type: 'note',
      profile,
      note,
      collection,
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      exportType: 'note',
      createdAt: new Date().toISOString(),
      sourceProfileIds: [profile.id],
      payload,
    };
  }

  createCollectionExport(profile: Profile, collection: Collection, notes: Note[]): ExportEnvelope {
    const payload: CollectionExportPayload = {
      type: 'collection',
      profile,
      collection,
      notes,
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      exportType: 'collection',
      createdAt: new Date().toISOString(),
      sourceProfileIds: [profile.id],
      payload,
    };
  }

  createProfileExport(profile: Profile, blob: StoredProfileBlob): ExportEnvelope {
    const payload: ProfileExportPayload = {
      type: 'profile',
      profile,
      blob,
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      exportType: 'profile',
      createdAt: new Date().toISOString(),
      sourceProfileIds: [profile.id],
      payload,
    };
  }

  createAllProfilesExport(index: VaultIndex, profileBlobs: Record<string, StoredProfileBlob | null>): ExportEnvelope {
    const payload: AllProfilesExportPayload = {
      type: 'all',
      index,
      profileBlobs,
    };

    return {
      schemaVersion: SCHEMA_VERSION,
      exportType: 'all',
      createdAt: new Date().toISOString(),
      sourceProfileIds: index.profiles.map((profile) => profile.id),
      payload,
    };
  }

  parseEnvelope(rawJson: string): ExportEnvelope {
    const parsed = JSON.parse(rawJson) as ExportEnvelope;

    if (parsed.schemaVersion > SCHEMA_VERSION) {
      throw new Error(`Unsupported schemaVersion ${parsed.schemaVersion}.`);
    }

    if (!parsed.exportType || !parsed.payload) {
      throw new Error('Invalid import format.');
    }

    return parsed;
  }

  buildFileName(type: 'note' | 'collection' | 'profile' | 'all', name: string): string {
    const timestamp = toFileSafeTimestamp(new Date().toISOString());
    const safeName = name.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '');

    return `${safeName || 'export'}-${type}-${timestamp}.json`;
  }

  async fileToText(file: File): Promise<string> {
    return file.text();
  }

  extractProfileDataFromPlainBlob(blob: StoredProfileBlob): ProfileData | null {
    if (blob.kind !== 'plain') {
      return null;
    }

    return blob.data;
  }
}
