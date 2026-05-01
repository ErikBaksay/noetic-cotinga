import { TestBed } from '@angular/core/testing';
import { Profile } from '../models/domain.models';
import { ProfilesStore } from './profiles.store';

function profileFixture(id: string): Profile {
  return {
    id,
    name: `Profile ${id}`,
    encryptionState: 'none',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('ProfilesStore', () => {
  let store: ProfilesStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(ProfilesStore);
  });

  it('tracks active profile', () => {
    const one = profileFixture('p1');
    const two = profileFixture('p2');
    store.setProfiles([one, two]);
    store.setActiveProfileId(two.id);

    expect(store.activeProfile()?.id).toBe('p2');
  });

  it('locks and unlocks profiles', () => {
    store.unlockProfile('p1');
    expect(store.isUnlocked('p1')).toBe(true);

    store.lockProfile('p1');
    expect(store.isUnlocked('p1')).toBe(false);
  });
});
