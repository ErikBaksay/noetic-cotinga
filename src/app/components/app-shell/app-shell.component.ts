import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { UtilitySection } from '../../stores/ui.store';
import { VaultService } from '../../services/vault.service';
import { ConflictModalComponent } from '../conflict-modal/conflict-modal.component';
import { LockScreenComponent } from '../lock-screen/lock-screen.component';
import { ManagementModalComponent } from '../management-modal/management-modal.component';
import { MobileNavComponent } from '../mobile-nav/mobile-nav.component';
import { NoteEditorComponent } from '../note-editor/note-editor.component';
import { NoteListComponent } from '../note-list/note-list.component';

type WorkspaceAction =
  | 'import'
  | 'export-note'
  | 'export-collection'
  | 'export-profile'
  | 'export-all'
  | 'switch-profile'
  | 'create-profile'
  | 'rename-profile'
  | 'delete-profile'
  | 'enable-lock'
  | 'lock-now'
  | 'create-collection'
  | 'rename-collection'
  | 'delete-collection';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    NoteListComponent,
    NoteEditorComponent,
    ManagementModalComponent,
    ConflictModalComponent,
    LockScreenComponent,
    MobileNavComponent,
  ],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  @ViewChild('importFileInput') importFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('actionsMenu') actionsMenu?: ElementRef<HTMLElement>;
  @ViewChild('actionsTrigger') actionsTrigger?: ElementRef<HTMLButtonElement>;

  constructor(public readonly vault: VaultService) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.vault.actionMenuOpen()) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    const menu = this.actionsMenu?.nativeElement;
    const trigger = this.actionsTrigger?.nativeElement;

    if (menu?.contains(target) || trigger?.contains(target)) {
      return;
    }

    this.vault.closeActionMenu();
  }

  @HostListener('document:keydown.escape')
  onEscapePressed(): void {
    if (this.vault.actionMenuOpen()) {
      this.vault.closeActionMenu();
      this.actionsTrigger?.nativeElement.focus();
    }
  }

  toggleActionMenu(event: Event): void {
    event.stopPropagation();
    this.vault.toggleActionMenu();

    if (this.vault.actionMenuOpen()) {
      queueMicrotask(() => {
        this.focusFirstMenuItem();
      });
    }
  }

  toggleUtilitySection(event: Event, section: UtilitySection): void {
    event.stopPropagation();
    this.vault.toggleUtilitySection(section);
  }

  async createNoteQuick(): Promise<void> {
    await this.vault.createNote();
    this.vault.setActiveMobilePane('editor');
  }

  async runWorkspaceAction(action: WorkspaceAction): Promise<void> {
    this.vault.closeActionMenu();

    switch (action) {
      case 'import':
        this.openImportPicker();
        return;
      case 'export-note':
        await this.vault.exportSelectedNote();
        return;
      case 'export-collection':
        await this.vault.exportSelectedCollection();
        return;
      case 'export-profile':
        await this.vault.exportActiveProfile();
        return;
      case 'export-all':
        await this.vault.exportAllProfiles();
        return;
      case 'switch-profile':
        this.vault.openProfileSwitchModal();
        return;
      case 'create-profile':
        this.vault.openCreateProfileModal();
        return;
      case 'rename-profile':
        this.vault.openRenameActiveProfileModal();
        return;
      case 'delete-profile': {
        const activeProfile = this.vault.activeProfile();
        if (!activeProfile) {
          return;
        }

        this.vault.openDeleteProfileModal(activeProfile.id);
        return;
      }
      case 'enable-lock':
        this.vault.openEnableLockModal();
        return;
      case 'lock-now':
        this.vault.lockActiveProfile();
        return;
      case 'create-collection':
        this.vault.openCreateCollectionModal();
        return;
      case 'rename-collection': {
        const selectedCollectionId = this.vault.selectedCollectionId();
        if (!selectedCollectionId) {
          return;
        }

        this.vault.openRenameCollectionModal(selectedCollectionId);
        return;
      }
      case 'delete-collection': {
        const selectedCollectionId = this.vault.selectedCollectionId();
        if (!selectedCollectionId) {
          return;
        }

        this.vault.openDeleteCollectionModal(selectedCollectionId);
        return;
      }
      default:
        return;
    }
  }

  onActionsMenuKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab') {
      return;
    }

    const items = this.menuButtons();
    if (items.length === 0) {
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const activeElement = document.activeElement;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last?.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  openImportPicker(): void {
    this.importFileInput?.nativeElement.click();
  }

  async onImportFileChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    await this.vault.importFile(file);
    input.value = '';
  }

  private menuButtons(): HTMLButtonElement[] {
    const menu = this.actionsMenu?.nativeElement;
    if (!menu) {
      return [];
    }

    return Array.from(menu.querySelectorAll('button:not([disabled])'));
  }

  private focusFirstMenuItem(): void {
    const first = this.menuButtons()[0];
    first?.focus();
  }
}
