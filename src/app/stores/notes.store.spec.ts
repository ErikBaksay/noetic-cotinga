import { TestBed } from '@angular/core/testing';
import { Note } from '../models/domain.models';
import { NotesStore } from './notes.store';

function noteFixture(id: string, updatedAt: string, pinned = false): Note {
  return {
    id,
    profileId: 'profile_1',
    collectionId: 'collection_1',
    title: id,
    tiptapDoc: { type: 'doc', content: [{ type: 'paragraph' }] },
    pinned,
    archived: false,
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('NotesStore', () => {
  let store: NotesStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(NotesStore);
  });

  it('upserts notes', () => {
    store.upsertNote(noteFixture('note_1', '2026-01-01T00:00:00.000Z'));
    store.upsertNote({ ...noteFixture('note_1', '2026-01-01T01:00:00.000Z'), title: 'updated' });

    expect(store.notes()).toHaveLength(1);
    expect(store.notes()[0]?.title).toBe('updated');
  });

  it('sorts pinned first and newest first', () => {
    store.setNotes([
      noteFixture('note_1', '2026-01-01T01:00:00.000Z', false),
      noteFixture('note_2', '2026-01-01T00:00:00.000Z', true),
      noteFixture('note_3', '2026-01-01T03:00:00.000Z', false),
    ]);

    const sorted = store.sortedNotes();

    expect(sorted[0]?.id).toBe('note_2');
    expect(sorted[1]?.id).toBe('note_3');
  });
});
