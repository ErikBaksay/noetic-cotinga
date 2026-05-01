import { Injectable, computed, signal } from '@angular/core';
import { ConflictDecision, ConflictItem, PendingImportMerge } from '../models/domain.models';

export type MobilePane = 'collections' | 'notes' | 'editor';
export type UtilitySection = 'profiles' | 'collections' | 'transfer';

export type UtilityModalState =
  | { kind: 'switch_profile' }
  | { kind: 'create_profile'; initialName: string }
  | { kind: 'rename_profile'; profileId: string; initialName: string }
  | { kind: 'delete_profile'; profileId: string; profileName: string }
  | { kind: 'create_collection'; initialName: string }
  | { kind: 'rename_collection'; collectionId: string; initialName: string }
  | { kind: 'delete_collection'; collectionId: string; collectionName: string }
  | { kind: 'delete_note'; noteId: string; noteTitle: string }
  | { kind: 'enable_lock'; profileId: string; profileName: string }
  | { kind: 'import_profile_passphrase'; profileName: string };

const MOBILE_PANE_STORAGE_KEY = 'noetic-cotinga:ui:mobile-pane';

@Injectable({ providedIn: 'root' })
export class UiStore {
  private readonly selectedCollectionIdState = signal<string | null>(null);
  private readonly selectedNoteIdState = signal<string | null>(null);
  private readonly openCollectionGroupIdState = signal<string | null>(null);
  private readonly searchQueryState = signal('');
  private readonly includeArchivedState = signal(false);
  private readonly activeMobilePaneState = signal<MobilePane>(this.loadStoredMobilePane());

  private readonly actionMenuOpenState = signal(false);
  private readonly activeUtilitySectionState = signal<UtilitySection | null>(null);
  private readonly utilityModalState = signal<UtilityModalState | null>(null);

  private readonly pendingImportState = signal<PendingImportMerge | null>(null);
  private readonly conflictDecisionsState = signal<ConflictDecision[]>([]);
  private readonly showConflictModalState = signal(false);

  readonly selectedCollectionId = computed(() => this.selectedCollectionIdState());
  readonly selectedNoteId = computed(() => this.selectedNoteIdState());
  readonly openCollectionGroupId = computed(() => this.openCollectionGroupIdState());
  readonly searchQuery = computed(() => this.searchQueryState());
  readonly includeArchived = computed(() => this.includeArchivedState());
  readonly activeMobilePane = computed(() => this.activeMobilePaneState());

  readonly actionMenuOpen = computed(() => this.actionMenuOpenState());
  readonly activeUtilitySection = computed(() => this.activeUtilitySectionState());
  readonly utilityModal = computed(() => this.utilityModalState());

  readonly pendingImport = computed(() => this.pendingImportState());
  readonly showConflictModal = computed(() => this.showConflictModalState());
  readonly conflictDecisions = computed(() => this.conflictDecisionsState());

  setSelectedCollectionId(collectionId: string | null): void {
    this.selectedCollectionIdState.set(collectionId);
  }

  setSelectedNoteId(noteId: string | null): void {
    this.selectedNoteIdState.set(noteId);
  }

  setOpenCollectionGroupId(collectionId: string | null): void {
    this.openCollectionGroupIdState.set(collectionId);
  }

  setSearchQuery(value: string): void {
    this.searchQueryState.set(value);
  }

  setIncludeArchived(includeArchived: boolean): void {
    this.includeArchivedState.set(includeArchived);
  }

  setActiveMobilePane(pane: MobilePane): void {
    this.activeMobilePaneState.set(pane);
    localStorage.setItem(MOBILE_PANE_STORAGE_KEY, pane);
  }

  openActionMenu(): void {
    this.actionMenuOpenState.set(true);
  }

  closeActionMenu(): void {
    this.actionMenuOpenState.set(false);
    this.activeUtilitySectionState.set(null);
  }

  toggleActionMenu(): void {
    if (this.actionMenuOpenState()) {
      this.closeActionMenu();
      return;
    }

    this.openActionMenu();
  }

  setActiveUtilitySection(section: UtilitySection | null): void {
    this.activeUtilitySectionState.set(section);
  }

  toggleUtilitySection(section: UtilitySection): void {
    this.activeUtilitySectionState.update((current) => (current === section ? null : section));
  }

  openUtilityModal(modal: UtilityModalState): void {
    this.utilityModalState.set(modal);
  }

  closeUtilityModal(): void {
    this.utilityModalState.set(null);
  }

  clearSelections(): void {
    this.selectedCollectionIdState.set(null);
    this.selectedNoteIdState.set(null);
    this.openCollectionGroupIdState.set(null);
  }

  openConflictModal(pendingImport: PendingImportMerge, defaultDecisions: ConflictDecision[]): void {
    this.pendingImportState.set(pendingImport);
    this.conflictDecisionsState.set(defaultDecisions);
    this.showConflictModalState.set(true);
  }

  setConflictDecision(entityType: 'collection' | 'note', entityId: string, resolution: 'keep_local' | 'keep_imported' | 'duplicate'): void {
    const decisions = this.conflictDecisionsState();
    const existingIndex = decisions.findIndex(
      (decision) => decision.entityType === entityType && decision.entityId === entityId,
    );

    if (existingIndex >= 0) {
      const updated = [...decisions];
      updated[existingIndex] = { entityType, entityId, resolution };
      this.conflictDecisionsState.set(updated);
      return;
    }

    this.conflictDecisionsState.set([
      ...decisions,
      {
        entityType,
        entityId,
        resolution,
      },
    ]);
  }

  closeConflictModal(): void {
    this.pendingImportState.set(null);
    this.conflictDecisionsState.set([]);
    this.showConflictModalState.set(false);
  }

  setConflictDefaults(conflicts: ConflictItem[]): void {
    this.conflictDecisionsState.set(
      conflicts.map((conflict) => ({
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        resolution: conflict.suggestedResolution,
      })),
    );
  }

  private loadStoredMobilePane(): MobilePane {
    const stored = localStorage.getItem(MOBILE_PANE_STORAGE_KEY);
    if (stored === 'collections' || stored === 'notes' || stored === 'editor') {
      return stored;
    }

    return 'notes';
  }
}
