import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Collection,
  ConflictDecision,
  ExportEnvelope,
  Note,
  Profile,
  ProfileData,
  ProfileExportPayload,
  SCHEMA_VERSION,
  StoredProfileBlob,
  VaultIndex,
} from '../models/domain.models';
import {
  createCollection,
  createDefaultIndex,
  createDefaultProfile,
  createEmptyProfileData,
  createUntitledNote,
  DEFAULT_COLLECTION_COLORS,
  nowIso,
} from '../utils/model.utils';
import { CollectionsStore } from '../stores/collections.store';
import { NotesStore } from '../stores/notes.store';
import { ProfilesStore } from '../stores/profiles.store';
import { SettingsStore } from '../stores/settings.store';
import { UiStore, UtilityModalState, UtilitySection } from '../stores/ui.store';
import { StorageAdapterService } from './storage-adapter.service';
import { CryptoService } from './crypto.service';
import { ConflictResolverService } from './conflict-resolver.service';
import { FileDownloadService } from './file-download.service';
import { ImportExportService } from './import-export.service';

@Injectable({ providedIn: 'root' })
export class VaultService {
  private readonly profilesStore = inject(ProfilesStore);
  private readonly collectionsStore = inject(CollectionsStore);
  private readonly notesStore = inject(NotesStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly uiStore = inject(UiStore);
  private readonly storageAdapter = inject(StorageAdapterService);
  private readonly cryptoService = inject(CryptoService);
  private readonly conflictResolver = inject(ConflictResolverService);
  private readonly fileDownload = inject(FileDownloadService);
  private readonly importExport = inject(ImportExportService);

  private readonly passphrasesState = signal<Record<string, string>>({});
  private readonly busyState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private importPassphraseResolver: ((value: string | null) => void) | null = null;

  readonly profiles = this.profilesStore.profiles;
  readonly activeProfile = this.profilesStore.activeProfile;
  readonly activeProfileId = this.profilesStore.activeProfileId;

  readonly collections = this.collectionsStore.collectionsByName;
  readonly notes = this.notesStore.notes;

  readonly selectedCollectionId = this.uiStore.selectedCollectionId;
  readonly selectedNoteId = this.uiStore.selectedNoteId;
  readonly openCollectionGroupId = this.uiStore.openCollectionGroupId;
  readonly searchQuery = this.uiStore.searchQuery;
  readonly includeArchived = this.uiStore.includeArchived;
  readonly activeMobilePane = this.uiStore.activeMobilePane;
  readonly actionMenuOpen = this.uiStore.actionMenuOpen;
  readonly activeUtilitySection = this.uiStore.activeUtilitySection;
  readonly utilityModal = this.uiStore.utilityModal;

  readonly pendingImport = this.uiStore.pendingImport;
  readonly conflictDecisions = this.uiStore.conflictDecisions;
  readonly showConflictModal = this.uiStore.showConflictModal;

  readonly isBusy = computed(() => this.busyState());
  readonly error = computed(() => this.errorState());

  readonly isActiveProfileLocked = computed(() => {
    const profile = this.profilesStore.activeProfile();
    if (!profile || profile.encryptionState !== 'enabled') {
      return false;
    }

    return !this.profilesStore.isUnlocked(profile.id);
  });

  readonly selectedNote = computed(() => {
    const selectedNoteId = this.uiStore.selectedNoteId();
    if (!selectedNoteId) {
      return null;
    }

    return this.notesStore.notes().find((note) => note.id === selectedNoteId) ?? null;
  });

  readonly searchableNotes = computed(() => {
    const searchQuery = this.uiStore.searchQuery().trim().toLowerCase();
    const includeArchived = this.uiStore.includeArchived();

    return this.notesStore
      .sortedNotes()
      .filter((note) => (includeArchived ? true : !note.archived))
      .filter((note) => {
        if (!searchQuery) {
          return true;
        }

        const bodyText = JSON.stringify(note.tiptapDoc).toLowerCase();
        return note.title.toLowerCase().includes(searchQuery) || bodyText.includes(searchQuery);
      });
  });

  readonly filteredNotes = computed(() => {
    const selectedCollectionId = this.uiStore.selectedCollectionId();
    return this.searchableNotes().filter((note) => (selectedCollectionId ? note.collectionId === selectedCollectionId : true));
  });

  readonly canEditActiveProfile = computed(() => {
    const profile = this.activeProfile();
    if (!profile) {
      return false;
    }

    if (profile.encryptionState === 'none') {
      return true;
    }

    return this.profilesStore.isUnlocked(profile.id);
  });

  constructor() {
    window.addEventListener('beforeunload', () => {
      this.lockAllProfiles();
    });
  }

  async init(): Promise<void> {
    this.setError(null);

    let index = this.storageAdapter.loadIndex();

    if (!index || index.schemaVersion > SCHEMA_VERSION || index.profiles.length === 0) {
      const defaultProfile = createDefaultProfile();
      index = createDefaultIndex(defaultProfile);
      this.storageAdapter.saveIndex(index);
      this.storageAdapter.saveProfileBlob(defaultProfile.id, {
        kind: 'plain',
        schemaVersion: SCHEMA_VERSION,
        data: createEmptyProfileData(),
      });
    }

    this.profilesStore.replaceProfiles(index.profiles, index.activeProfileId ?? index.profiles[0]?.id ?? null);
    this.settingsStore.setSettings(index.settings);

    for (const profile of index.profiles) {
      const existingBlob = this.storageAdapter.loadProfileBlob(profile.id);
      if (!existingBlob) {
        this.storageAdapter.saveProfileBlob(profile.id, {
          kind: 'plain',
          schemaVersion: SCHEMA_VERSION,
          data: createEmptyProfileData(),
        });
      }
    }

    await this.loadActiveProfileData();
  }

  async selectProfile(profileId: string): Promise<void> {
    this.profilesStore.setActiveProfileId(profileId);
    this.uiStore.clearSelections();
    this.persistIndex();
    await this.loadActiveProfileData();
  }

  async createProfile(name: string): Promise<void> {
    const profileName = name.trim() || 'New profile';
    const timestamp = nowIso();
    const profile: Profile = {
      id: crypto.randomUUID(),
      name: profileName,
      encryptionState: 'none',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.profilesStore.upsertProfile(profile);
    this.storageAdapter.saveProfileBlob(profile.id, {
      kind: 'plain',
      schemaVersion: SCHEMA_VERSION,
      data: createEmptyProfileData(),
    });

    this.profilesStore.setActiveProfileId(profile.id);
    this.persistIndex();
    await this.loadActiveProfileData();
  }

  async deleteProfile(profileId: string): Promise<void> {
    const profiles = this.profilesStore.profiles();
    if (profiles.length <= 1) {
      this.setError('At least one profile must remain.');
      return;
    }

    this.profilesStore.removeProfile(profileId);
    this.storageAdapter.removeProfile(profileId);

    const passphrases = { ...this.passphrasesState() };
    delete passphrases[profileId];
    this.passphrasesState.set(passphrases);

    this.persistIndex();
    await this.loadActiveProfileData();
  }

  async renameActiveProfile(name: string): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) {
      return;
    }

    const nextProfile: Profile = {
      ...profile,
      name: name.trim() || profile.name,
      updatedAt: nowIso(),
    };

    this.profilesStore.upsertProfile(nextProfile);
    this.persistIndex();
  }

  async addCollection(name: string): Promise<void> {
    const profile = this.activeProfile();
    if (!profile || !this.canEditActiveProfile()) {
      return;
    }

    const color = DEFAULT_COLLECTION_COLORS[Math.floor(Math.random() * DEFAULT_COLLECTION_COLORS.length)]!;
    const collection = createCollection(profile.id, name, color);
    this.collectionsStore.upsertCollection(collection);
    this.uiStore.setSelectedCollectionId(collection.id);
    this.uiStore.setOpenCollectionGroupId(collection.id);

    await this.persistActiveProfile();
  }

  async renameCollection(collectionId: string, name: string): Promise<void> {
    const collection = this.collectionsStore.collections().find((candidate) => candidate.id === collectionId);
    if (!collection || !this.canEditActiveProfile()) {
      return;
    }

    this.collectionsStore.upsertCollection({
      ...collection,
      name: name.trim() || collection.name,
      updatedAt: nowIso(),
    });

    await this.persistActiveProfile();
  }

  async removeCollection(collectionId: string): Promise<void> {
    if (!this.canEditActiveProfile()) {
      return;
    }

    this.collectionsStore.removeCollection(collectionId);
    this.notesStore.setNotes(this.notesStore.notes().filter((note) => note.collectionId !== collectionId));

    if (this.uiStore.selectedCollectionId() === collectionId) {
      const nextCollectionId = this.collectionsStore.collections()[0]?.id ?? null;
      this.uiStore.setSelectedCollectionId(nextCollectionId);
      this.uiStore.setOpenCollectionGroupId(nextCollectionId);
    }

    if (this.uiStore.openCollectionGroupId() === collectionId) {
      this.uiStore.setOpenCollectionGroupId(this.collectionsStore.collections()[0]?.id ?? null);
    }

    if (this.selectedNote()?.collectionId === collectionId) {
      this.uiStore.setSelectedNoteId(null);
    }

    await this.persistActiveProfile();
  }

  async createNote(): Promise<void> {
    const profile = this.activeProfile();
    if (!profile || !this.canEditActiveProfile()) {
      return;
    }

    let targetCollectionId = this.uiStore.selectedCollectionId();
    const collections = this.collectionsStore.collections();

    if (!targetCollectionId) {
      targetCollectionId = collections[0]?.id ?? null;
    }

    if (!targetCollectionId) {
      await this.addCollection('Inbox');
      targetCollectionId = this.uiStore.selectedCollectionId();
    }

    if (!targetCollectionId) {
      return;
    }

    const note = createUntitledNote(profile.id, targetCollectionId);
    this.notesStore.upsertNote(note);
    this.uiStore.setSelectedCollectionId(targetCollectionId);
    this.uiStore.setOpenCollectionGroupId(targetCollectionId);
    this.uiStore.setSelectedNoteId(note.id);
    this.uiStore.setActiveMobilePane('editor');

    await this.persistActiveProfile();
  }

  async updateNoteTitle(noteId: string, title: string): Promise<void> {
    const note = this.notesStore.notes().find((candidate) => candidate.id === noteId);
    if (!note || !this.canEditActiveProfile()) {
      return;
    }

    this.notesStore.upsertNote({
      ...note,
      title: title.trim() || 'Untitled note',
      updatedAt: nowIso(),
    });

    await this.persistActiveProfile();
  }

  async updateNoteContent(noteId: string, tiptapDoc: Record<string, unknown>): Promise<void> {
    const note = this.notesStore.notes().find((candidate) => candidate.id === noteId);
    if (!note || !this.canEditActiveProfile()) {
      return;
    }

    this.notesStore.upsertNote({
      ...note,
      tiptapDoc,
      updatedAt: nowIso(),
    });

    await this.persistActiveProfile();
  }

  async toggleNotePinned(noteId: string): Promise<void> {
    const note = this.notesStore.notes().find((candidate) => candidate.id === noteId);
    if (!note || !this.canEditActiveProfile()) {
      return;
    }

    this.notesStore.upsertNote({
      ...note,
      pinned: !note.pinned,
      updatedAt: nowIso(),
    });

    await this.persistActiveProfile();
  }

  async toggleNoteArchived(noteId: string): Promise<void> {
    const note = this.notesStore.notes().find((candidate) => candidate.id === noteId);
    if (!note || !this.canEditActiveProfile()) {
      return;
    }

    this.notesStore.upsertNote({
      ...note,
      archived: !note.archived,
      updatedAt: nowIso(),
    });

    await this.persistActiveProfile();
  }

  async deleteNote(noteId: string): Promise<void> {
    if (!this.canEditActiveProfile()) {
      return;
    }

    this.notesStore.removeNote(noteId);

    if (this.uiStore.selectedNoteId() === noteId) {
      this.uiStore.setSelectedNoteId(null);
    }

    await this.persistActiveProfile();
  }

  selectCollection(collectionId: string | null): void {
    this.uiStore.setSelectedCollectionId(collectionId);
    this.uiStore.setOpenCollectionGroupId(collectionId);
    this.uiStore.setActiveMobilePane('notes');
  }

  openCollectionGroup(collectionId: string | null): void {
    this.uiStore.setOpenCollectionGroupId(collectionId);
    this.uiStore.setSelectedCollectionId(collectionId);
  }

  selectNote(noteId: string): void {
    const note = this.notesStore.notes().find((candidate) => candidate.id === noteId);
    if (note) {
      this.uiStore.setSelectedCollectionId(note.collectionId);
      this.uiStore.setOpenCollectionGroupId(note.collectionId);
    }

    this.uiStore.setSelectedNoteId(noteId);
    this.uiStore.setActiveMobilePane('editor');
  }

  setSearchQuery(searchQuery: string): void {
    this.uiStore.setSearchQuery(searchQuery);
  }

  setIncludeArchived(includeArchived: boolean): void {
    this.uiStore.setIncludeArchived(includeArchived);
  }

  setActiveMobilePane(pane: 'collections' | 'notes' | 'editor'): void {
    this.uiStore.setActiveMobilePane(pane);
  }

  openActionMenu(): void {
    this.uiStore.openActionMenu();
  }

  closeActionMenu(): void {
    this.uiStore.closeActionMenu();
  }

  toggleActionMenu(): void {
    this.uiStore.toggleActionMenu();
  }

  toggleUtilitySection(section: UtilitySection): void {
    this.uiStore.toggleUtilitySection(section);
  }

  setUtilitySection(section: UtilitySection | null): void {
    this.uiStore.setActiveUtilitySection(section);
  }

  openUtilityModal(modal: UtilityModalState): void {
    this.uiStore.openUtilityModal(modal);
  }

  closeUtilityModal(): void {
    this.uiStore.closeUtilityModal();
  }

  openProfileSwitchModal(): void {
    this.uiStore.openUtilityModal({ kind: 'switch_profile' });
  }

  openCreateProfileModal(): void {
    this.uiStore.openUtilityModal({ kind: 'create_profile', initialName: 'Personal' });
  }

  openRenameActiveProfileModal(): void {
    const profile = this.activeProfile();
    if (!profile) {
      return;
    }

    this.uiStore.openUtilityModal({
      kind: 'rename_profile',
      profileId: profile.id,
      initialName: profile.name,
    });
  }

  openDeleteProfileModal(profileId: string): void {
    const profile = this.profilesStore.profiles().find((candidate) => candidate.id === profileId);
    if (!profile) {
      return;
    }

    this.uiStore.openUtilityModal({
      kind: 'delete_profile',
      profileId: profile.id,
      profileName: profile.name,
    });
  }

  openCreateCollectionModal(): void {
    if (!this.canEditActiveProfile()) {
      return;
    }

    this.uiStore.openUtilityModal({ kind: 'create_collection', initialName: 'Inbox' });
  }

  openRenameCollectionModal(collectionId: string): void {
    const collection = this.collectionsStore.collections().find((candidate) => candidate.id === collectionId);
    if (!collection || !this.canEditActiveProfile()) {
      return;
    }

    this.uiStore.openUtilityModal({
      kind: 'rename_collection',
      collectionId,
      initialName: collection.name,
    });
  }

  openDeleteCollectionModal(collectionId: string): void {
    const collection = this.collectionsStore.collections().find((candidate) => candidate.id === collectionId);
    if (!collection || !this.canEditActiveProfile()) {
      return;
    }

    this.uiStore.openUtilityModal({
      kind: 'delete_collection',
      collectionId,
      collectionName: collection.name,
    });
  }

  openDeleteNoteModal(noteId: string): void {
    const note = this.notesStore.notes().find((candidate) => candidate.id === noteId);
    if (!note || !this.canEditActiveProfile()) {
      return;
    }

    this.uiStore.openUtilityModal({
      kind: 'delete_note',
      noteId,
      noteTitle: note.title,
    });
  }

  openEnableLockModal(): void {
    const profile = this.activeProfile();
    if (!profile || profile.encryptionState === 'enabled' || !this.canEditActiveProfile()) {
      return;
    }

    this.uiStore.openUtilityModal({
      kind: 'enable_lock',
      profileId: profile.id,
      profileName: profile.name,
    });
  }

  submitImportProfilePassphrase(passphrase: string): void {
    const resolver = this.importPassphraseResolver;
    this.importPassphraseResolver = null;
    this.uiStore.closeUtilityModal();
    resolver?.(passphrase);
  }

  cancelImportProfilePassphrase(): void {
    const resolver = this.importPassphraseResolver;
    this.importPassphraseResolver = null;
    this.uiStore.closeUtilityModal();
    resolver?.(null);
  }

  visibleNotesForCollection(collectionId: string | null): Note[] {
    return this.searchableNotes().filter((note) => (collectionId ? note.collectionId === collectionId : true));
  }

  currentCollectionName(): string {
    const selectedCollectionId = this.selectedCollectionId();
    if (!selectedCollectionId) {
      return 'All notes';
    }

    return this.collectionsStore.collections().find((collection) => collection.id === selectedCollectionId)?.name ?? 'Unknown';
  }

  clearError(): void {
    this.setError(null);
  }

  async enableActiveProfileLock(passphrase: string): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) {
      return;
    }

    if (profile.encryptionState === 'enabled') {
      this.setError('Vault lock is already enabled for this profile.');
      return;
    }

    if (!passphrase.trim()) {
      this.setError('Passphrase cannot be empty.');
      return;
    }

    this.busyState.set(true);

    try {
      const data = this.collectActiveProfileData();
      const payload = await this.cryptoService.encrypt(data, passphrase);
      const encryptedBlob: StoredProfileBlob = {
        kind: 'encrypted',
        schemaVersion: SCHEMA_VERSION,
        payload,
      };

      this.storageAdapter.saveProfileBlob(profile.id, encryptedBlob);
      this.passphrasesState.set({
        ...this.passphrasesState(),
        [profile.id]: passphrase,
      });
      this.profilesStore.unlockProfile(profile.id);

      this.profilesStore.upsertProfile({
        ...profile,
        encryptionState: 'enabled',
        updatedAt: nowIso(),
      });

      this.persistIndex();
      this.setError(null);
    } catch {
      this.setError('Unable to enable encryption for this profile.');
    } finally {
      this.busyState.set(false);
    }
  }

  async unlockActiveProfile(passphrase: string): Promise<void> {
    const profile = this.activeProfile();
    if (!profile || profile.encryptionState !== 'enabled') {
      return;
    }

    if (!passphrase.trim()) {
      this.setError('Passphrase is required to unlock this profile.');
      return;
    }

    const blob = this.storageAdapter.loadProfileBlob(profile.id);
    if (!blob || blob.kind !== 'encrypted') {
      this.setError('Encrypted profile data is missing or invalid.');
      return;
    }

    this.busyState.set(true);

    try {
      const decrypted = await this.cryptoService.decrypt<ProfileData>(blob.payload, passphrase);
      this.collectionsStore.setCollections(decrypted.collections);
      this.notesStore.setNotes(decrypted.notes);
      this.passphrasesState.set({
        ...this.passphrasesState(),
        [profile.id]: passphrase,
      });
      this.profilesStore.unlockProfile(profile.id);
      this.setError(null);
    } catch {
      this.setError('Incorrect passphrase or corrupted encrypted profile.');
    } finally {
      this.busyState.set(false);
    }
  }

  lockActiveProfile(): void {
    const profile = this.activeProfile();
    if (!profile || profile.encryptionState !== 'enabled') {
      return;
    }

    const passphrases = { ...this.passphrasesState() };
    delete passphrases[profile.id];
    this.passphrasesState.set(passphrases);

    this.profilesStore.lockProfile(profile.id);
    this.collectionsStore.clear();
    this.notesStore.clear();
    this.uiStore.clearSelections();
  }

  async exportSelectedNote(): Promise<void> {
    const profile = this.activeProfile();
    const note = this.selectedNote();

    if (!profile || !note) {
      this.setError('Select a note to export.');
      return;
    }

    const collection = this.collectionsStore.collections().find((candidate) => candidate.id === note.collectionId) ?? null;
    const envelope = this.importExport.createNoteExport(profile, note, collection);
    const fileName = this.importExport.buildFileName('note', note.title);
    this.fileDownload.downloadJson(fileName, envelope);
  }

  async exportSelectedCollection(): Promise<void> {
    const profile = this.activeProfile();
    const selectedCollectionId = this.uiStore.selectedCollectionId();

    if (!profile || !selectedCollectionId) {
      this.setError('Select a collection to export.');
      return;
    }

    const collection = this.collectionsStore.collections().find((candidate) => candidate.id === selectedCollectionId);
    if (!collection) {
      this.setError('Collection not found.');
      return;
    }

    const notes = this.notesStore.notes().filter((note) => note.collectionId === collection.id);
    const envelope = this.importExport.createCollectionExport(profile, collection, notes);
    const fileName = this.importExport.buildFileName('collection', collection.name);
    this.fileDownload.downloadJson(fileName, envelope);
  }

  async exportActiveProfile(): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) {
      return;
    }

    const blob = this.storageAdapter.loadProfileBlob(profile.id);
    if (!blob) {
      this.setError('Profile data is missing.');
      return;
    }

    const envelope = this.importExport.createProfileExport(profile, blob);
    const fileName = this.importExport.buildFileName('profile', profile.name);
    this.fileDownload.downloadJson(fileName, envelope);
  }

  async exportAllProfiles(): Promise<void> {
    const index = this.collectIndex();
    const snapshot = this.storageAdapter.loadSnapshot(index);
    const envelope = this.importExport.createAllProfilesExport(snapshot.index, snapshot.profileBlobs);
    const fileName = this.importExport.buildFileName('all', 'all-profiles');
    this.fileDownload.downloadJson(fileName, envelope);
  }

  async importFile(file: File): Promise<void> {
    this.setError(null);

    try {
      const text = await this.importExport.fileToText(file);
      const envelope = this.importExport.parseEnvelope(text);
      await this.handleImportEnvelope(envelope);
    } catch {
      this.setError('Import failed. Verify the JSON file format.');
    }
  }

  applyPendingConflictResolutions(): Promise<void> {
    const pendingImport = this.uiStore.pendingImport();
    const profile = this.activeProfile();

    if (!pendingImport || !profile) {
      return Promise.resolve();
    }

    const resolution = this.conflictResolver.resolveBatch(
      this.collectionsStore.collections(),
      this.notesStore.notes(),
      pendingImport.incomingCollections,
      pendingImport.incomingNotes,
      this.uiStore.conflictDecisions(),
      profile.id,
    );

    this.collectionsStore.setCollections(resolution.collections);
    this.notesStore.setNotes(resolution.notes);
    this.uiStore.closeConflictModal();

    return this.persistActiveProfile();
  }

  cancelPendingImportResolutions(): void {
    this.uiStore.closeConflictModal();
  }

  setConflictResolution(entityType: 'collection' | 'note', entityId: string, resolution: 'keep_local' | 'keep_imported' | 'duplicate'): void {
    this.uiStore.setConflictDecision(entityType, entityId, resolution);
  }

  collectionNoteCount(collectionId: string): number {
    return this.notesStore.notes().filter((note) => note.collectionId === collectionId).length;
  }

  private async handleImportEnvelope(envelope: ExportEnvelope): Promise<void> {
    if (!this.canEditActiveProfile()) {
      this.setError('Unlock the active profile before importing data.');
      return;
    }

    switch (envelope.exportType) {
      case 'note': {
        if (envelope.payload.type !== 'note') {
          throw new Error('Invalid note import payload.');
        }

        const notePayload = envelope.payload;
        await this.mergeIntoActiveProfile(
          notePayload.collection ? [this.bindCollectionToActiveProfile(notePayload.collection)] : [],
          [this.bindNoteToActiveProfile(notePayload.note)],
        );
        return;
      }

      case 'collection': {
        if (envelope.payload.type !== 'collection') {
          throw new Error('Invalid collection import payload.');
        }

        const payload = envelope.payload;
        const incomingCollection = this.bindCollectionToActiveProfile(payload.collection);
        const incomingNotes = payload.notes.map((note) => this.bindNoteToActiveProfile(note, incomingCollection.id));

        await this.mergeIntoActiveProfile([incomingCollection], incomingNotes);
        return;
      }

      case 'profile': {
        if (envelope.payload.type !== 'profile') {
          throw new Error('Invalid profile import payload.');
        }

        await this.mergeProfilePayload(envelope.payload);
        return;
      }

      case 'all': {
        if (envelope.payload.type !== 'all') {
          throw new Error('Invalid global import payload.');
        }

        await this.mergeAllProfilesPayload(envelope.payload.index, envelope.payload.profileBlobs);
        return;
      }

      default:
        throw new Error('Unsupported import type.');
    }
  }

  private async mergeProfilePayload(payload: ProfileExportPayload): Promise<void> {
    let incomingData: ProfileData | null = this.importExport.extractProfileDataFromPlainBlob(payload.blob);

    if (!incomingData && payload.blob.kind === 'encrypted') {
      const passphrase = await this.requestImportPassphrase();
      if (!passphrase.trim()) {
        this.setError('Import canceled because no passphrase was provided.');
        return;
      }

      incomingData = await this.cryptoService.decrypt<ProfileData>(payload.blob.payload, passphrase);
    }

    if (!incomingData) {
      this.setError('Unable to read profile export payload.');
      return;
    }

    const incomingCollections = incomingData.collections.map((collection) => this.bindCollectionToActiveProfile(collection));
    const incomingNotes = incomingData.notes.map((note) => this.bindNoteToActiveProfile(note));

    await this.mergeIntoActiveProfile(incomingCollections, incomingNotes);
  }

  private async mergeAllProfilesPayload(index: VaultIndex, importedProfileBlobs: Record<string, StoredProfileBlob | null>): Promise<void> {
    const localProfiles = this.profilesStore.profiles();
    const localProfilesById = new Map(localProfiles.map((profile) => [profile.id, profile]));
    const mergedProfilesById = new Map(localProfilesById);
    const mergedBlobs: Record<string, StoredProfileBlob | null> = {};

    localProfiles.forEach((profile) => {
      mergedBlobs[profile.id] = this.storageAdapter.loadProfileBlob(profile.id);
    });

    index.profiles.forEach((importedProfile) => {
      const local = mergedProfilesById.get(importedProfile.id);
      if (!local) {
        mergedProfilesById.set(importedProfile.id, importedProfile);
        mergedBlobs[importedProfile.id] = importedProfileBlobs[importedProfile.id] ?? null;
        return;
      }

      const shouldUseImported = importedProfile.updatedAt.localeCompare(local.updatedAt) >= 0;
      mergedProfilesById.set(importedProfile.id, shouldUseImported ? importedProfile : local);

      if (shouldUseImported && importedProfileBlobs[importedProfile.id]) {
        mergedBlobs[importedProfile.id] = importedProfileBlobs[importedProfile.id];
      }
    });

    const mergedProfiles = Array.from(mergedProfilesById.values());
    const activeProfileId = this.activeProfileId() && mergedProfilesById.has(this.activeProfileId()!)
      ? this.activeProfileId()
      : mergedProfiles[0]?.id ?? null;

    const mergedIndex: VaultIndex = {
      schemaVersion: SCHEMA_VERSION,
      activeProfileId,
      profiles: mergedProfiles,
      settings: this.settingsStore.settings(),
    };

    this.storageAdapter.saveIndex(mergedIndex);

    Object.entries(mergedBlobs).forEach(([profileId, blob]) => {
      if (blob) {
        this.storageAdapter.saveProfileBlob(profileId, blob);
      }
    });

    this.profilesStore.replaceProfiles(mergedProfiles, activeProfileId);
    this.lockAllProfiles();
    await this.loadActiveProfileData();
  }

  private async mergeIntoActiveProfile(incomingCollections: Collection[], incomingNotes: Note[]): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) {
      return;
    }

    const conflicts = this.conflictResolver.detectConflicts(
      this.collectionsStore.collections(),
      this.notesStore.notes(),
      incomingCollections,
      incomingNotes,
    );

    if (conflicts.length > 0) {
      const decisions: ConflictDecision[] = conflicts.map((conflict) => ({
        entityType: conflict.entityType,
        entityId: conflict.entityId,
        resolution: conflict.suggestedResolution,
      }));

      this.uiStore.openConflictModal(
        {
          incomingCollections,
          incomingNotes,
          conflicts,
        },
        decisions,
      );
      return;
    }

    const merged = this.conflictResolver.resolveBatch(
      this.collectionsStore.collections(),
      this.notesStore.notes(),
      incomingCollections,
      incomingNotes,
      [],
      profile.id,
    );

    this.collectionsStore.setCollections(merged.collections);
    this.notesStore.setNotes(merged.notes);
    this.syncCollectionSelection(merged.collections);
    this.syncSelectedNote();

    await this.persistActiveProfile();
  }

  private bindCollectionToActiveProfile(collection: Collection): Collection {
    const profile = this.activeProfile();

    return {
      ...collection,
      profileId: profile?.id ?? collection.profileId,
    };
  }

  private bindNoteToActiveProfile(note: Note, collectionIdOverride?: string): Note {
    const profile = this.activeProfile();

    return {
      ...note,
      profileId: profile?.id ?? note.profileId,
      collectionId: collectionIdOverride ?? note.collectionId,
    };
  }

  private async loadActiveProfileData(): Promise<void> {
    this.collectionsStore.clear();
    this.notesStore.clear();

    const profile = this.activeProfile();
    if (!profile) {
      return;
    }

    const blob = this.storageAdapter.loadProfileBlob(profile.id);
    if (!blob) {
      const emptyBlob: StoredProfileBlob = {
        kind: 'plain',
        schemaVersion: SCHEMA_VERSION,
        data: createEmptyProfileData(),
      };
      this.storageAdapter.saveProfileBlob(profile.id, emptyBlob);
      this.collectionsStore.setCollections([]);
      this.notesStore.setNotes([]);
      this.syncCollectionSelection([]);
      this.syncSelectedNote();
      return;
    }

    if (profile.encryptionState === 'enabled') {
      const passphrase = this.passphrasesState()[profile.id];
      if (!passphrase) {
        this.profilesStore.lockProfile(profile.id);
        return;
      }

      if (blob.kind !== 'encrypted') {
        this.setError('Profile expects encrypted data but found plain payload.');
        return;
      }

      try {
        const data = await this.cryptoService.decrypt<ProfileData>(blob.payload, passphrase);
        this.collectionsStore.setCollections(data.collections);
        this.notesStore.setNotes(data.notes);
        this.syncCollectionSelection(data.collections);
        this.syncSelectedNote();
        this.profilesStore.unlockProfile(profile.id);
      } catch {
        this.profilesStore.lockProfile(profile.id);
        this.setError('Failed to decrypt active profile with current passphrase.');
      }

      return;
    }

    if (blob.kind !== 'plain') {
      this.setError('Profile expects plain data but found encrypted payload.');
      return;
    }

    this.collectionsStore.setCollections(blob.data.collections);
    this.notesStore.setNotes(blob.data.notes);
    this.syncCollectionSelection(blob.data.collections);
    this.syncSelectedNote();
    this.profilesStore.unlockProfile(profile.id);
  }

  private syncCollectionSelection(collections: Collection[]): void {
    const collectionIds = new Set(collections.map((collection) => collection.id));
    let selectedCollectionId = this.uiStore.selectedCollectionId();
    if (selectedCollectionId && !collectionIds.has(selectedCollectionId)) {
      selectedCollectionId = null;
    }

    if (!selectedCollectionId && collections[0]) {
      selectedCollectionId = collections[0].id;
    }

    this.uiStore.setSelectedCollectionId(selectedCollectionId);

    let openGroupId = this.uiStore.openCollectionGroupId();
    if (openGroupId && !collectionIds.has(openGroupId)) {
      openGroupId = null;
    }

    if (!openGroupId && selectedCollectionId) {
      openGroupId = selectedCollectionId;
    }

    this.uiStore.setOpenCollectionGroupId(openGroupId);
  }

  private syncSelectedNote(): void {
    const selectedNoteId = this.uiStore.selectedNoteId();
    if (!selectedNoteId) {
      return;
    }

    const noteExists = this.notesStore.notes().some((note) => note.id === selectedNoteId);
    if (!noteExists) {
      this.uiStore.setSelectedNoteId(null);
    }
  }

  private requestImportPassphrase(): Promise<string> {
    if (this.importPassphraseResolver) {
      this.importPassphraseResolver(null);
    }

    this.uiStore.openUtilityModal({
      kind: 'import_profile_passphrase',
      profileName: this.activeProfile()?.name ?? 'Current profile',
    });

    return new Promise((resolve) => {
      this.importPassphraseResolver = (value) => {
        resolve(value ?? '');
      };
    });
  }

  private collectActiveProfileData(): ProfileData {
    return {
      collections: this.collectionsStore.collections(),
      notes: this.notesStore.notes(),
      updatedAt: nowIso(),
    };
  }

  private collectIndex(): VaultIndex {
    return {
      schemaVersion: SCHEMA_VERSION,
      activeProfileId: this.profilesStore.activeProfileId(),
      profiles: this.profilesStore.profiles(),
      settings: this.settingsStore.settings(),
    };
  }

  private async persistActiveProfile(): Promise<void> {
    const profile = this.activeProfile();
    if (!profile) {
      return;
    }

    const data = this.collectActiveProfileData();

    if (profile.encryptionState === 'enabled') {
      const passphrase = this.passphrasesState()[profile.id];
      if (!passphrase) {
        this.setError('Unlock the profile before editing encrypted data.');
        return;
      }

      const payload = await this.cryptoService.encrypt(data, passphrase);
      this.storageAdapter.saveProfileBlob(profile.id, {
        kind: 'encrypted',
        schemaVersion: SCHEMA_VERSION,
        payload,
      });
    } else {
      this.storageAdapter.saveProfileBlob(profile.id, {
        kind: 'plain',
        schemaVersion: SCHEMA_VERSION,
        data,
      });
    }

    this.profilesStore.upsertProfile({
      ...profile,
      updatedAt: nowIso(),
    });

    this.persistIndex();
  }

  private persistIndex(): void {
    this.storageAdapter.saveIndex(this.collectIndex());
  }

  private lockAllProfiles(): void {
    this.passphrasesState.set({});
    this.profilesStore.lockAllProfiles();
  }

  private setError(message: string | null): void {
    this.errorState.set(message);
  }
}
