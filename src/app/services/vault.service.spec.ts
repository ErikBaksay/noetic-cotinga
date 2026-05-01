import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ExportEnvelope } from '../models/domain.models';
import { FileDownloadService } from './file-download.service';
import { VaultService } from './vault.service';

function makeImportFile(payload: ExportEnvelope): File {
  return new File([JSON.stringify(payload)], 'import.json', { type: 'application/json' });
}

describe('VaultService flows', () => {
  let vault: VaultService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    vault = TestBed.inject(VaultService);
    await vault.init();
  });

  it('creates collection and note, then persists across re-init', async () => {
    await vault.addCollection('Inbox');
    await vault.createNote();

    const createdNote = vault.notes()[0];
    expect(createdNote).toBeTruthy();

    await vault.updateNoteTitle(createdNote!.id, 'Persistent note');

    const persisted = localStorage.getItem('noetic-cotinga:index');
    expect(persisted).toBeTruthy();

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});

    const reloadedVault = TestBed.inject(VaultService);
    await reloadedVault.init();

    expect(reloadedVault.notes().some((note) => note.title === 'Persistent note')).toBe(true);
  });

  it('imports conflicting note and applies keep_imported decision', async () => {
    await vault.addCollection('Inbox');
    await vault.createNote();

    const activeProfile = vault.activeProfile();
    const selectedNote = vault.selectedNote();
    const selectedCollection = vault.collections()[0];
    expect(activeProfile && selectedNote && selectedCollection).toBeTruthy();

    const importedEnvelope: ExportEnvelope = {
      schemaVersion: 1,
      exportType: 'note',
      createdAt: '2026-05-01T00:00:00.000Z',
      sourceProfileIds: [activeProfile!.id],
      payload: {
        type: 'note',
        profile: activeProfile!,
        collection: selectedCollection!,
        note: {
          ...selectedNote!,
          title: 'Imported title wins',
          updatedAt: '2026-05-02T00:00:00.000Z',
        },
      },
    };

    await vault.importFile(makeImportFile(importedEnvelope));
    expect(vault.showConflictModal()).toBe(true);

    vault.setConflictResolution('note', selectedNote!.id, 'keep_imported');
    await vault.applyPendingConflictResolutions();

    const updated = vault.notes().find((note) => note.id === selectedNote!.id);
    expect(updated?.title).toBe('Imported title wins');
  });

  it('exports a selected note into JSON envelope', async () => {
    await vault.addCollection('Inbox');
    await vault.createNote();

    const download = TestBed.inject(FileDownloadService);
    const spy = vi.spyOn(download, 'downloadJson');

    await vault.exportSelectedNote();

    expect(spy).toHaveBeenCalledTimes(1);
    const exportedPayload = spy.mock.calls[0]?.[1] as ExportEnvelope;
    expect(exportedPayload.exportType).toBe('note');

    spy.mockRestore();
  });

  it('enables lock, locks, and unlocks active profile', async () => {
    await vault.addCollection('Private');
    await vault.enableActiveProfileLock('secret-passphrase');

    expect(vault.activeProfile()?.encryptionState).toBe('enabled');

    vault.lockActiveProfile();
    expect(vault.isActiveProfileLocked()).toBe(true);

    await vault.unlockActiveProfile('secret-passphrase');
    expect(vault.isActiveProfileLocked()).toBe(false);
  });
});
