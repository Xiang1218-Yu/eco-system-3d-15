import assert from 'node:assert/strict';
import { describe, it, mock } from 'node:test';
import * as THREE from 'three';
import type { Organism } from '@/types/ecosystem';
import { getSpeciesById } from '@/data/species';
import { simulateStep } from '@/utils/ecosystemSimulator';

function createTestOrganism(id: string, speciesId = 'fish', overrides: Partial<Organism> = {}): Organism {
  const species = getSpeciesById(speciesId)!;

  return {
    id,
    speciesId,
    position: new THREE.Vector3(0, 0, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    energy: species.energyValue,
    age: 1,
    state: 'idle',
    targetId: null,
    rotation: 0,
    scale: 1,
    ...overrides,
  };
}

function withRandomValues(values: number[], run: () => void): void {
  let index = 0;
  const nextValue = mock.fn(() => values[Math.min(index++, values.length - 1)]);
  const originalRandom = Math.random;
  Math.random = nextValue;

  try {
    run();
  } finally {
    Math.random = originalRandom;
  }
}

function reproductionRandomValues(moverCount: number, reproductionCount: number): number[] {
  return [
    ...new Array(moverCount).fill(1),
    ...new Array(reproductionCount).fill(0).flatMap(() => [0, 0.5, 0.5, 0.5]),
  ];
}

describe('simulateStep reproduction population consistency', () => {
  it('allows one offspring for a single eligible breeder', () => {
    const breeder = createTestOrganism('breeder');
    const species = getSpeciesById(breeder.speciesId)!;

    withRandomValues([1, 0, 0.5, 0.5, 0.5], () => {
      const result = simulateStep([breeder]);

      assert.equal(result.toAdd.length, 1);
      assert.equal(result.toAdd[0].speciesId, species.id);

      const breederUpdate = result.updates.find((u) => u.id === breeder.id);
      assert.equal(breederUpdate?.updates.energy, breeder.energy * 0.5 * 0.9988);
      assert.equal(result.toRemove.length, 0);
    });
  });

  it('counts offspring already queued in this frame when several breeders reproduce together', () => {
    const species = getSpeciesById('fish')!;
    const organisms = Array.from({ length: 9 }, (_, index) =>
      createTestOrganism(`breeder-${index + 1}`, species.id, {
        position: new THREE.Vector3(index, 0, 0),
      }),
    );
    const expectedOffspring = species.maxPopulation - organisms.length;

    withRandomValues(reproductionRandomValues(organisms.length, expectedOffspring), () => {
      const result = simulateStep(organisms);

      assert.equal(result.toAdd.length, expectedOffspring);
      assert.equal(organisms.length + result.toAdd.length - result.toRemove.length, species.maxPopulation);

      const reproducingIds = new Set(
        result.updates
          .filter((u) => u.updates.energy === organisms[0].energy * 0.5 * 0.9988)
          .map((u) => u.id),
      );
      assert.equal(reproducingIds.size, expectedOffspring);
    });
  });

  it('reuses only capacity vacated by organisms dying in the same step', () => {
    const species = getSpeciesById('fish')!;
    const survivors = Array.from({ length: 10 }, (_, index) =>
      createTestOrganism(`breeder-${index}`, species.id, {
        position: new THREE.Vector3(index, 0, 0),
      }),
    );
    const dying = [
      createTestOrganism('dying-1', species.id, { energy: 0 }),
      createTestOrganism('dying-2', species.id, { energy: 0 }),
    ];
    const initialCount = survivors.length + dying.length;
    const expectedOffspring = species.maxPopulation - survivors.length;

    withRandomValues(reproductionRandomValues(survivors.length, expectedOffspring), () => {
      const result = simulateStep([...survivors, ...dying]);

      assert.deepEqual(result.toRemove.sort(), dying.map((o) => o.id).sort());
      assert.equal(result.toAdd.length, expectedOffspring);
      assert.equal(initialCount + result.toAdd.length - result.toRemove.length, species.maxPopulation);
    });
  });

  it('adds no offspring when the species is already at the population limit', () => {
    const species = getSpeciesById('bigfish')!;
    const organisms = Array.from({ length: species.maxPopulation }, (_, index) =>
      createTestOrganism(`breeder-${index}`, species.id, {
        position: new THREE.Vector3(index, 0, 0),
      }),
    );
    assert.equal(organisms.length, species.maxPopulation);

    withRandomValues(new Array(organisms.length).fill(1), () => {
      const result = simulateStep(organisms);

      assert.equal(result.toAdd.length, 0);
      assert.equal(result.toRemove.length, 0);
      for (const update of result.updates) {
        assert.notEqual(update.updates.energy, organisms[0].energy * 0.5);
      }
    });
  });

  it('keeps existing predation behavior within the same batch', () => {
    const predator = createTestOrganism('predator', 'bigfish', {
      energy: 20,
      position: new THREE.Vector3(0.2, 0, 0),
    });
    const prey = createTestOrganism('prey', 'fish', {
      position: new THREE.Vector3(0, 0, 0),
      energy: 50,
    });

    withRandomValues([1, 1], () => {
      const result = simulateStep([predator, prey]);

      assert.deepEqual(result.toRemove, [prey.id]);
      const predatorUpdate = result.updates.find((u) => u.id === predator.id);
      assert.equal(predatorUpdate?.updates.state, 'eating');
      assert.equal(predatorUpdate?.updates.targetId, prey.id);
      assert.ok((predatorUpdate?.updates.energy as number) > 20);
      assert.equal(result.toAdd.length, 0);
      assert.equal(result.updates.some((u) => u.id === prey.id), false);
    });
  });
});
