import { TestBed } from '@angular/core/testing';
import { Collection, ConflictDecision, Note } from '../models/domain.models';
import { ConflictResolverService } from './conflict-resolver.service';

function collectionFixture(id: string): Collection {
  return {
    id,
    profileId: 'profile_1',
    name: `Collection ${id}`,
    color: '#8fd3ff',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function noteFixture(id: string, collectionId: string, updatedAt = '2026-01-01T00:00:00.000Z'): Note {
  return {
    id,
    profileId: 'profile_1',
    collectionId,
    title: `Note ${id}`,
    tiptapDoc: { type: 'doc', content: [{ type: 'paragraph' }] },
    pinned: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt,
  };
}

describe('ConflictResolverService', () => {
  let service: ConflictResolverService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ConflictResolverService);
  });

  it('detects conflicts by shared ids with different payload', () => {
    const localNotes = [noteFixture('note_1', 'collection_1', '2026-01-01T10:00:00.000Z')];
    const incomingNotes = [
      {
        ...noteFixture('note_1', 'collection_1', '2026-01-01T11:00:00.000Z'),
        title: 'Updated imported title',
      },
    ];

    const conflicts = service.detectConflicts([], localNotes, [], incomingNotes);

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.entityType).toBe('note');
    expect(conflicts[0]?.suggestedResolution).toBe('keep_imported');
  });

  it('duplicates conflicting notes when requested', () => {
    const collections = [collectionFixture('collection_1')];
    const localNotes = [noteFixture('note_1', 'collection_1')];
    const incomingNotes = [{ ...noteFixture('note_1', 'collection_1'), title: 'Imported' }];
    const decisions: ConflictDecision[] = [
      {
        entityType: 'note',
        entityId: 'note_1',
        resolution: 'duplicate',
      },
    ];

    const merged = service.resolveBatch(collections, localNotes, [], incomingNotes, decisions, 'profile_1');

    expect(merged.notes).toHaveLength(2);
    expect(merged.notes.some((note) => note.id === 'note_1')).toBe(true);
    expect(merged.notes.some((note) => note.title.includes('Imported copy'))).toBe(true);
  });
});
