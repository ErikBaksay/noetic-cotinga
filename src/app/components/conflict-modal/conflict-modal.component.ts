import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConflictItem } from '../../models/domain.models';
import { VaultService } from '../../services/vault.service';

@Component({
  selector: 'app-conflict-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './conflict-modal.component.html',
  styleUrl: './conflict-modal.component.scss',
})
export class ConflictModalComponent {
  constructor(public readonly vault: VaultService) {}

  resolutionFor(conflict: ConflictItem): 'keep_local' | 'keep_imported' | 'duplicate' {
    return (
      this.vault
        .conflictDecisions()
        .find((decision) => decision.entityType === conflict.entityType && decision.entityId === conflict.entityId)
        ?.resolution ?? conflict.suggestedResolution
    );
  }

  setResolution(conflict: ConflictItem, resolution: 'keep_local' | 'keep_imported' | 'duplicate'): void {
    this.vault.setConflictResolution(conflict.entityType, conflict.entityId, resolution);
  }

  describeVersion(value: unknown): string {
    const serialized = JSON.stringify(value);
    return serialized.length > 80 ? `${serialized.slice(0, 80)}...` : serialized;
  }

  async apply(): Promise<void> {
    await this.vault.applyPendingConflictResolutions();
  }
}
