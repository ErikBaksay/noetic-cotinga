import { Injectable, computed, signal } from '@angular/core';
import { Collection } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class CollectionsStore {
  private readonly collectionsState = signal<Collection[]>([]);

  readonly collections = computed(() => this.collectionsState());
  readonly collectionsByName = computed(() => {
    return [...this.collectionsState()].sort((left, right) => left.name.localeCompare(right.name));
  });

  setCollections(collections: Collection[]): void {
    this.collectionsState.set(collections);
  }

  upsertCollection(nextCollection: Collection): void {
    const collections = this.collectionsState();
    const existingIndex = collections.findIndex((collection) => collection.id === nextCollection.id);

    if (existingIndex >= 0) {
      const updated = [...collections];
      updated[existingIndex] = nextCollection;
      this.collectionsState.set(updated);
      return;
    }

    this.collectionsState.set([...collections, nextCollection]);
  }

  removeCollection(collectionId: string): void {
    this.collectionsState.set(this.collectionsState().filter((collection) => collection.id !== collectionId));
  }

  clear(): void {
    this.collectionsState.set([]);
  }
}
