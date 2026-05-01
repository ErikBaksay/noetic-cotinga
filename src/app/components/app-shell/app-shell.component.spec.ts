import { CommonModule } from '@angular/common';
import { Component, Input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppShellComponent } from './app-shell.component';
import { VaultService } from '../../services/vault.service';
import { vi } from 'vitest';

@Component({ selector: 'app-note-list', standalone: true, template: '<div>notes</div>' })
class NoteListStub {
  @Input() mode: 'full' | 'collections-only' | 'notes-only' = 'full';
}

@Component({ selector: 'app-note-editor', standalone: true, template: '<div>editor</div>' })
class NoteEditorStub {}

@Component({ selector: 'app-management-modal', standalone: true, template: '' })
class ManagementModalStub {}

@Component({ selector: 'app-conflict-modal', standalone: true, template: '' })
class ConflictModalStub {}

@Component({ selector: 'app-lock-screen', standalone: true, template: '' })
class LockScreenStub {}

@Component({ selector: 'app-mobile-nav', standalone: true, template: '' })
class MobileNavStub {}

class VaultServiceMock {
  readonly activeProfile = signal({ id: 'p1', name: 'Personal', encryptionState: 'none' as const });
  readonly activeProfileId = signal('p1');
  readonly profiles = signal([{ id: 'p1', name: 'Personal', encryptionState: 'none' as const }]);
  readonly error = signal<string | null>(null);
  readonly actionMenuOpen = signal(false);
  readonly activeMobilePane = signal<'collections' | 'notes' | 'editor'>('notes');
  readonly activeUtilitySection = signal<'profiles' | 'collections' | 'transfer' | null>(null);
  readonly selectedCollectionId = signal<string | null>('c1');
  readonly selectedNote = signal<{ id: string } | null>({ id: 'n1' });
  readonly canEditActiveProfile = signal(true);
  readonly isActiveProfileLocked = signal(false);

  toggleActionMenu(): void {
    this.actionMenuOpen.update((current) => !current);
  }

  closeActionMenu(): void {
    this.actionMenuOpen.set(false);
    this.activeUtilitySection.set(null);
  }

  setActiveMobilePane(pane: 'collections' | 'notes' | 'editor'): void {
    this.activeMobilePane.set(pane);
  }

  toggleUtilitySection(section: 'profiles' | 'collections' | 'transfer'): void {
    this.activeUtilitySection.update((current) => (current === section ? null : section));
  }

  clearError(): void {
    this.error.set(null);
  }

  async createNote(): Promise<void> {
    return Promise.resolve();
  }

  async importFile(): Promise<void> {
    return Promise.resolve();
  }

  openProfileSwitchModal(): void {}

  openCreateProfileModal(): void {}

  openRenameActiveProfileModal(): void {}

  openDeleteProfileModal(): void {}

  openEnableLockModal(): void {}

  lockActiveProfile(): void {}

  openCreateCollectionModal(): void {}

  openRenameCollectionModal(): void {}

  openDeleteCollectionModal(): void {}

  async exportSelectedNote(): Promise<void> {
    return Promise.resolve();
  }

  async exportSelectedCollection(): Promise<void> {
    return Promise.resolve();
  }

  async exportActiveProfile(): Promise<void> {
    return Promise.resolve();
  }

  async exportAllProfiles(): Promise<void> {
    return Promise.resolve();
  }
}

describe('AppShellComponent', () => {
  let fixture: ComponentFixture<AppShellComponent>;
  let component: AppShellComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [{ provide: VaultService, useClass: VaultServiceMock }],
    })
      .overrideComponent(AppShellComponent, {
        set: {
          imports: [
            CommonModule,
            NoteListStub,
            NoteEditorStub,
            ManagementModalStub,
            ConflictModalStub,
            LockScreenStub,
            MobileNavStub,
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(AppShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('opens and closes the workspace menu', () => {
    const trigger = fixture.nativeElement.querySelector('.actions-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    let menu = fixture.nativeElement.querySelector('.actions-menu');
    expect(menu).toBeTruthy();

    component.onEscapePressed();
    fixture.detectChanges();

    menu = fixture.nativeElement.querySelector('.actions-menu');
    expect(menu).toBeNull();
  });

  it('traps keyboard tab focus inside menu', () => {
    const trigger = fixture.nativeElement.querySelector('.actions-trigger') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();

    const menuButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.actions-menu button'),
    ) as HTMLButtonElement[];

    const first = menuButtons[0];
    const last = menuButtons[menuButtons.length - 1];

    first.focus();
    const shiftTabEvent = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true });
    component.onActionsMenuKeydown(shiftTabEvent);

    expect(document.activeElement).toBe(last);
  });

  it('shows stage pane when mobile pane switches to editor', () => {
    const vault = TestBed.inject(VaultService) as unknown as VaultServiceMock;
    vault.setActiveMobilePane('editor');
    fixture.detectChanges();

    const stagePane = fixture.nativeElement.querySelector('.stage-pane') as HTMLElement;
    expect(stagePane.classList.contains('mobile-visible')).toBe(true);
  });

  it('routes profile actions to modal-based flows', async () => {
    const vault = TestBed.inject(VaultService) as unknown as VaultServiceMock;
    const createProfileSpy = vi.spyOn(vault, 'openCreateProfileModal');

    await component.runWorkspaceAction('create-profile');

    expect(createProfileSpy).toHaveBeenCalledTimes(1);
  });
});
