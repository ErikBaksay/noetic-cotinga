import { TestBed } from '@angular/core/testing';
import { UiStore } from './ui.store';

describe('UiStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads persisted mobile pane from localStorage', () => {
    localStorage.setItem('noetic-cotinga:ui:mobile-pane', 'editor');

    TestBed.configureTestingModule({});
    const store = TestBed.inject(UiStore);

    expect(store.activeMobilePane()).toBe('editor');
  });

  it('persists mobile pane changes', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(UiStore);

    store.setActiveMobilePane('collections');

    expect(store.activeMobilePane()).toBe('collections');
    expect(localStorage.getItem('noetic-cotinga:ui:mobile-pane')).toBe('collections');
  });

  it('manages workspace menu and submenu state', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(UiStore);

    expect(store.actionMenuOpen()).toBe(false);
    expect(store.activeUtilitySection()).toBeNull();

    store.openActionMenu();
    store.toggleUtilitySection('profiles');

    expect(store.actionMenuOpen()).toBe(true);
    expect(store.activeUtilitySection()).toBe('profiles');

    store.closeActionMenu();

    expect(store.actionMenuOpen()).toBe(false);
    expect(store.activeUtilitySection()).toBeNull();
  });

  it('tracks utility modal state transitions', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(UiStore);

    store.openUtilityModal({ kind: 'create_collection', initialName: 'Inbox' });

    expect(store.utilityModal()).toEqual({ kind: 'create_collection', initialName: 'Inbox' });

    store.closeUtilityModal();
    expect(store.utilityModal()).toBeNull();
  });

  it('keeps one collection group open at a time', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(UiStore);

    store.setOpenCollectionGroupId('collection-1');
    expect(store.openCollectionGroupId()).toBe('collection-1');

    store.setOpenCollectionGroupId('collection-2');
    expect(store.openCollectionGroupId()).toBe('collection-2');

    store.setOpenCollectionGroupId(null);
    expect(store.openCollectionGroupId()).toBeNull();
  });
});
