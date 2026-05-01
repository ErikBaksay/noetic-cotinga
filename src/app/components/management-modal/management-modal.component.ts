import { CommonModule } from '@angular/common';
import { Component, HostListener, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UtilityModalState } from '../../stores/ui.store';
import { VaultService } from '../../services/vault.service';

@Component({
  selector: 'app-management-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './management-modal.component.html',
  styleUrl: './management-modal.component.scss',
})
export class ManagementModalComponent {
  protected draftText = '';
  protected draftPassphrase = '';

  constructor(public readonly vault: VaultService) {
    effect(() => {
      const modal = this.vault.utilityModal();
      this.populateDrafts(modal);
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.vault.utilityModal()) {
      return;
    }

    this.cancel();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }

    this.cancel();
  }

  cancel(): void {
    const modal = this.vault.utilityModal();
    if (!modal) {
      return;
    }

    if (modal.kind === 'import_profile_passphrase') {
      this.vault.cancelImportProfilePassphrase();
      return;
    }

    this.vault.closeUtilityModal();
  }

  async switchProfile(profileId: string): Promise<void> {
    await this.vault.selectProfile(profileId);
    this.vault.closeUtilityModal();
  }

  async submitPrimary(): Promise<void> {
    const modal = this.vault.utilityModal();
    if (!modal) {
      return;
    }

    switch (modal.kind) {
      case 'create_profile':
        await this.vault.createProfile(this.draftText);
        this.vault.closeUtilityModal();
        return;
      case 'rename_profile':
        await this.vault.renameActiveProfile(this.draftText);
        this.vault.closeUtilityModal();
        return;
      case 'delete_profile':
        await this.vault.deleteProfile(modal.profileId);
        this.vault.closeUtilityModal();
        return;
      case 'create_collection':
        await this.vault.addCollection(this.draftText);
        this.vault.closeUtilityModal();
        return;
      case 'rename_collection':
        await this.vault.renameCollection(modal.collectionId, this.draftText);
        this.vault.closeUtilityModal();
        return;
      case 'delete_collection':
        await this.vault.removeCollection(modal.collectionId);
        this.vault.closeUtilityModal();
        return;
      case 'delete_note':
        await this.vault.deleteNote(modal.noteId);
        this.vault.closeUtilityModal();
        return;
      case 'enable_lock':
        await this.vault.enableActiveProfileLock(this.draftPassphrase);
        this.vault.closeUtilityModal();
        return;
      case 'import_profile_passphrase':
        this.vault.submitImportProfilePassphrase(this.draftPassphrase);
        return;
      case 'switch_profile':
        return;
      default:
        return;
    }
  }

  submitLabel(modal: UtilityModalState): string {
    switch (modal.kind) {
      case 'create_profile':
        return 'Create profile';
      case 'rename_profile':
        return 'Rename profile';
      case 'delete_profile':
        return 'Delete profile';
      case 'create_collection':
        return 'Create collection';
      case 'rename_collection':
        return 'Rename collection';
      case 'delete_collection':
        return 'Delete collection';
      case 'delete_note':
        return 'Delete note';
      case 'enable_lock':
        return 'Enable lock';
      case 'import_profile_passphrase':
        return 'Continue import';
      default:
        return 'Confirm';
    }
  }

  heading(modal: UtilityModalState): string {
    switch (modal.kind) {
      case 'switch_profile':
        return 'Switch profile';
      case 'create_profile':
        return 'Create profile';
      case 'rename_profile':
        return 'Rename profile';
      case 'delete_profile':
        return 'Delete profile';
      case 'create_collection':
        return 'Create collection';
      case 'rename_collection':
        return 'Rename collection';
      case 'delete_collection':
        return 'Delete collection';
      case 'delete_note':
        return 'Delete note';
      case 'enable_lock':
        return 'Enable profile lock';
      case 'import_profile_passphrase':
        return 'Encrypted import';
      default:
        return 'Dialog';
    }
  }

  description(modal: UtilityModalState): string {
    switch (modal.kind) {
      case 'switch_profile':
        return 'Pick the local profile you want to open.';
      case 'create_profile':
        return 'Create a local vault profile for notes and collections.';
      case 'rename_profile':
        return 'Update the current profile display name.';
      case 'delete_profile':
        return `Delete ${modal.profileName} and all related notes. This action cannot be undone.`;
      case 'create_collection':
        return 'Add a new collection in the current profile.';
      case 'rename_collection':
        return 'Change the selected collection name.';
      case 'delete_collection':
        return `Delete collection ${modal.collectionName} and all notes in it.`;
      case 'delete_note':
        return `Delete note ${modal.noteTitle}.`;
      case 'enable_lock':
        return `Set a passphrase to encrypt ${modal.profileName}.`;
      case 'import_profile_passphrase':
        return 'Provide the passphrase to decrypt this imported profile payload.';
      default:
        return '';
    }
  }

  isPrimaryDisabled(modal: UtilityModalState): boolean {
    if (modal.kind === 'enable_lock' || modal.kind === 'import_profile_passphrase') {
      return !this.draftPassphrase.trim() || this.vault.isBusy();
    }

    if (
      modal.kind === 'create_profile' ||
      modal.kind === 'rename_profile' ||
      modal.kind === 'create_collection' ||
      modal.kind === 'rename_collection'
    ) {
      return !this.draftText.trim() || this.vault.isBusy();
    }

    return this.vault.isBusy();
  }

  private populateDrafts(modal: UtilityModalState | null): void {
    if (!modal) {
      this.draftText = '';
      this.draftPassphrase = '';
      return;
    }

    this.draftPassphrase = '';

    if (
      modal.kind === 'create_profile' ||
      modal.kind === 'rename_profile' ||
      modal.kind === 'create_collection' ||
      modal.kind === 'rename_collection'
    ) {
      this.draftText = modal.initialName;
      return;
    }

    this.draftText = '';
  }
}
