import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { VaultService } from '../../services/vault.service';

@Component({
  selector: 'app-profile-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './profile-sidebar.component.html',
  styleUrl: './profile-sidebar.component.scss',
})
export class ProfileSidebarComponent {
  constructor(public readonly vault: VaultService) {}

  createProfile(): void {
    this.vault.openCreateProfileModal();
  }

  renameProfile(): void {
    const activeProfile = this.vault.activeProfile();
    if (!activeProfile) {
      return;
    }

    this.vault.openRenameActiveProfileModal();
  }

  deleteProfile(profileId: string): void {
    this.vault.openDeleteProfileModal(profileId);
  }

  addCollection(): void {
    this.vault.openCreateCollectionModal();
  }

  renameCollection(collectionId: string): void {
    this.vault.openRenameCollectionModal(collectionId);
  }

  deleteCollection(collectionId: string): void {
    this.vault.openDeleteCollectionModal(collectionId);
  }

  enableLock(): void {
    this.vault.openEnableLockModal();
  }
}
