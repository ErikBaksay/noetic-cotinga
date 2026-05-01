import { CommonModule } from '@angular/common';
import { Component, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VaultService } from '../../services/vault.service';
import { RichTextEditorComponent } from '../rich-text-editor/rich-text-editor.component';

@Component({
  selector: 'app-note-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RichTextEditorComponent],
  templateUrl: './note-editor.component.html',
  styleUrl: './note-editor.component.scss',
})
export class NoteEditorComponent implements OnDestroy {
  private saveContentTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(public readonly vault: VaultService) {}

  ngOnDestroy(): void {
    if (this.saveContentTimer) {
      clearTimeout(this.saveContentTimer);
    }
  }

  async onTitleChange(noteId: string, title: string): Promise<void> {
    await this.vault.updateNoteTitle(noteId, title);
  }

  onContentChange(noteId: string, doc: Record<string, unknown>): void {
    if (this.saveContentTimer) {
      clearTimeout(this.saveContentTimer);
    }

    this.saveContentTimer = setTimeout(() => {
      void this.vault.updateNoteContent(noteId, doc);
    }, 250);
  }

  async exportSelectedNote(): Promise<void> {
    await this.vault.exportSelectedNote();
  }
}
