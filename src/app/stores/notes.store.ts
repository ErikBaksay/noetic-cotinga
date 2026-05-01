import { Injectable, computed, signal } from '@angular/core';
import { Note } from '../models/domain.models';
import { compareByUpdatedAtDesc } from '../utils/model.utils';

@Injectable({ providedIn: 'root' })
export class NotesStore {
  private readonly notesState = signal<Note[]>([]);

  readonly notes = computed(() => this.notesState());

  setNotes(notes: Note[]): void {
    this.notesState.set(notes);
  }

  upsertNote(nextNote: Note): void {
    const notes = this.notesState();
    const existingIndex = notes.findIndex((note) => note.id === nextNote.id);

    if (existingIndex >= 0) {
      const updated = [...notes];
      updated[existingIndex] = nextNote;
      this.notesState.set(updated);
      return;
    }

    this.notesState.set([...notes, nextNote]);
  }

  removeNote(noteId: string): void {
    this.notesState.set(this.notesState().filter((note) => note.id !== noteId));
  }

  sortedNotes(): Note[] {
    return [...this.notesState()].sort(compareByUpdatedAtDesc);
  }

  clear(): void {
    this.notesState.set([]);
  }
}
