import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VaultService } from '../../services/vault.service';

@Component({
  selector: 'app-lock-screen',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lock-screen.component.html',
  styleUrl: './lock-screen.component.scss',
})
export class LockScreenComponent {
  protected passphrase = '';

  constructor(public readonly vault: VaultService) {}

  async unlock(): Promise<void> {
    await this.vault.unlockActiveProfile(this.passphrase);

    if (!this.vault.isActiveProfileLocked()) {
      this.passphrase = '';
    }
  }
}
