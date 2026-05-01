import { Injectable } from '@angular/core';
import {
  Collection,
  ConflictDecision,
  ConflictItem,
  Note,
} from '../models/domain.models';
import { createId, duplicateName, nowIso, resolveByUpdatedAt } from '../utils/model.utils';

@Injectable({ providedIn: 'root' })
export class ConflictResolverService {
  detectConflicts(
    localCollections: Collection[],
    localNotes: Note[],
    incomingCollections: Collection[],
    incomingNotes: Note[],
  ): ConflictItem[] {
    const conflicts: ConflictItem[] = [];

    const localCollectionsById = new Map(localCollections.map((collection) => [collection.id, collection]));
    const localNotesById = new Map(localNotes.map((note) => [note.id, note]));

    incomingCollections.forEach((incomingCollection) => {
      const localCollection = localCollectionsById.get(incomingCollection.id);
      if (!localCollection) {
        return;
      }

      if (JSON.stringify(localCollection) === JSON.stringify(incomingCollection)) {
        return;
      }

      conflicts.push({
        entityType: 'collection',
        entityId: incomingCollection.id,
        displayName: incomingCollection.name,
        suggestedResolution: resolveByUpdatedAt(localCollection.updatedAt, incomingCollection.updatedAt),
        versions: {
          local: localCollection,
          imported: incomingCollection,
        },
      });
    });

    incomingNotes.forEach((incomingNote) => {
      const localNote = localNotesById.get(incomingNote.id);
      if (!localNote) {
        return;
      }

      if (JSON.stringify(localNote) === JSON.stringify(incomingNote)) {
        return;
      }

      conflicts.push({
        entityType: 'note',
        entityId: incomingNote.id,
        displayName: incomingNote.title,
        suggestedResolution: resolveByUpdatedAt(localNote.updatedAt, incomingNote.updatedAt),
        versions: {
          local: localNote,
          imported: incomingNote,
        },
      });
    });

    return conflicts;
  }

  resolveBatch(
    localCollections: Collection[],
    localNotes: Note[],
    incomingCollections: Collection[],
    incomingNotes: Note[],
    decisions: ConflictDecision[],
    profileId: string,
  ): { collections: Collection[]; notes: Note[] } {
    const collectionDecisionMap = new Map(
      decisions
        .filter((decision) => decision.entityType === 'collection')
        .map((decision) => [decision.entityId, decision.resolution]),
    );

    const noteDecisionMap = new Map(
      decisions
        .filter((decision) => decision.entityType === 'note')
        .map((decision) => [decision.entityId, decision.resolution]),
    );

    const localCollectionsById = new Map(localCollections.map((collection) => [collection.id, collection]));
    const mergedCollectionsById = new Map(localCollections.map((collection) => [collection.id, collection]));
    const collectionIdRemap = new Map<string, string>();

    incomingCollections.forEach((incomingCollection) => {
      const existing = localCollectionsById.get(incomingCollection.id);
      if (!existing) {
        mergedCollectionsById.set(incomingCollection.id, incomingCollection);
        return;
      }

      const decision = collectionDecisionMap.get(incomingCollection.id) ?? 'keep_imported';
      if (decision === 'keep_local') {
        return;
      }

      if (decision === 'duplicate') {
        const timestamp = nowIso();
        const duplicatedCollection: Collection = {
          ...incomingCollection,
          id: createId('collection'),
          profileId,
          name: duplicateName(incomingCollection.name, 'Imported copy'),
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        mergedCollectionsById.set(duplicatedCollection.id, duplicatedCollection);
        collectionIdRemap.set(incomingCollection.id, duplicatedCollection.id);
        return;
      }

      mergedCollectionsById.set(incomingCollection.id, {
        ...incomingCollection,
        profileId,
      });
    });

    const mergedNotesById = new Map(localNotes.map((note) => [note.id, note]));
    const localNotesById = new Map(localNotes.map((note) => [note.id, note]));

    incomingNotes.forEach((incomingNote) => {
      const remappedCollectionId = collectionIdRemap.get(incomingNote.collectionId) ?? incomingNote.collectionId;
      const existing = localNotesById.get(incomingNote.id);

      if (!existing) {
        mergedNotesById.set(incomingNote.id, {
          ...incomingNote,
          profileId,
          collectionId: remappedCollectionId,
        });
        return;
      }

      const decision = noteDecisionMap.get(incomingNote.id) ?? 'keep_imported';
      if (decision === 'keep_local') {
        return;
      }

      if (decision === 'duplicate') {
        const timestamp = nowIso();
        const duplicate: Note = {
          ...incomingNote,
          id: createId('note'),
          profileId,
          collectionId: remappedCollectionId,
          title: duplicateName(incomingNote.title, 'Imported copy'),
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        mergedNotesById.set(duplicate.id, duplicate);
        return;
      }

      mergedNotesById.set(incomingNote.id, {
        ...incomingNote,
        profileId,
        collectionId: remappedCollectionId,
      });
    });

    return {
      collections: Array.from(mergedCollectionsById.values()),
      notes: Array.from(mergedNotesById.values()),
    };
  }
}
