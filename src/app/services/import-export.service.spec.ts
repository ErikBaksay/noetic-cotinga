import { TestBed } from '@angular/core/testing';
import {
  Collection,
  Note,
  Profile,
  SCHEMA_VERSION,
  StoredProfileBlob,
} from '../models/domain.models';
import { ImportExportService } from './import-export.service';

const profile: Profile = {
  id: 'profile_1',
  name: 'Personal',
  encryptionState: 'none',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const collection: Collection = {
  id: 'collection_1',
  profileId: profile.id,
  name: 'Inbox',
  color: '#8fd3ff',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const note: Note = {
  id: 'note_1',
  profileId: profile.id,
  collectionId: collection.id,
  title: 'Hello',
  tiptapDoc: { type: 'doc', content: [{ type: 'paragraph' }] },
  pinned: false,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('ImportExportService', () => {
  let service: ImportExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ImportExportService);
  });

  it('creates note export with schema version', () => {
    const envelope = service.createNoteExport(profile, note, collection);

    expect(envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(envelope.exportType).toBe('note');
    expect(envelope.payload.type).toBe('note');
  });

  it('parses valid envelope', () => {
    const raw = JSON.stringify(service.createCollectionExport(profile, collection, [note]));
    const parsed = service.parseEnvelope(raw);

    expect(parsed.exportType).toBe('collection');
  });

  it('extracts data only from plain blobs', () => {
    const plainBlob: StoredProfileBlob = {
      kind: 'plain',
      schemaVersion: 1,
      data: {
        collections: [collection],
        notes: [note],
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    };

    const encryptedBlob: StoredProfileBlob = {
      kind: 'encrypted',
      schemaVersion: 1,
      payload: {
        algorithm: 'AES-GCM',
        cipherText: 'abc',
        iv: 'abc',
        salt: 'abc',
        iterations: 10,
      },
    };

    expect(service.extractProfileDataFromPlainBlob(plainBlob)?.collections).toHaveLength(1);
    expect(service.extractProfileDataFromPlainBlob(encryptedBlob)).toBeNull();
  });
});
