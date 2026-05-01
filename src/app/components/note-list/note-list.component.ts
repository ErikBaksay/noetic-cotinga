import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Collection, Note } from '../../models/domain.models';
import { VaultService } from '../../services/vault.service';

export type NoteRailMode = 'full' | 'collections-only' | 'notes-only';

@Component({
  selector: 'app-note-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './note-list.component.html',
  styleUrl: './note-list.component.scss',
})
export class NoteListComponent {
  @Input() mode: NoteRailMode = 'full';

  constructor(public readonly vault: VaultService) {}

  async createNote(): Promise<void> {
    await this.vault.createNote();
  }

  openCollectionGroup(collectionId: string | null): void {
    this.vault.openCollectionGroup(collectionId);

    if (this.mode === 'collections-only') {
      this.vault.setActiveMobilePane('notes');
    }
  }

  isOpen(collectionId: string | null): boolean {
    return this.vault.openCollectionGroupId() === collectionId;
  }

  notesFor(collectionId: string | null): Note[] {
    return this.vault.visibleNotesForCollection(collectionId);
  }

  collectionLabel(collectionId: string | null, collectionName: string): string {
    if (collectionId === this.vault.selectedCollectionId()) {
      return `${collectionName} (Selected)`;
    }

    return collectionName;
  }

  openRenameCollectionModal(collectionId: string): void {
    this.vault.openRenameCollectionModal(collectionId);
  }

  openDeleteCollectionModal(collectionId: string): void {
    this.vault.openDeleteCollectionModal(collectionId);
  }

  async togglePin(noteId: string): Promise<void> {
    await this.vault.toggleNotePinned(noteId);
  }

  async toggleArchive(noteId: string): Promise<void> {
    await this.vault.toggleNoteArchived(noteId);
  }

  deleteNote(noteId: string): void {
    this.vault.openDeleteNoteModal(noteId);
  }

  showCollections(): boolean {
    return this.mode !== 'notes-only';
  }

  showNotes(): boolean {
    return this.mode !== 'collections-only';
  }

  collectionCount(collection: Collection): number {
    return this.vault.collectionNoteCount(collection.id);
  }
}
