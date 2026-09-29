import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { simulateStep } from './ecosystemSimulator';
import { getSpeciesById } from '@/data/species';
import type { Organism } from '@/types/ecosystem';

function createOrganism(
  id: string,
  speciesId: string,
  overrides: Partial<Organism> = {},
): Organism {
  const species = getSpeciesById(speciesId);
  if (!species) throw new Error(`Unknown species: ${speciesId}`);

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

function fish(id: string, energy = 55, overrides: Partial<Organism> = {}) {
  return createOrganism(id, 'fish', { energy, ...overrides });
}

function updateFor(
  result: ReturnType<typeof simulateStep>,
  id: string,
): Partial<Organism> | undefined {
  return result.updates.find((update) => update.id === id)?.updates;
}

describe('simulateStep reproduction population limit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('adds one offspring for a single breeder and deducts reproduction energy once', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const breeder = fish('breeder');

    const result = simulateStep([breeder]);

    expect(result.toRemove).toEqual([]);
    expect(result.toAdd).toHaveLength(1);
    expect(result.toAdd[0]).toMatchObject({ speciesId: 'fish' });
    expect(updateFor(result, 'breeder')?.energy).toBeCloseTo(27.47, 5);
  });

  it('counts offspring already queued in the same frame for multiple breeders', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const breeders = Array.from({ length: 11 }, (_, index) => fish(`breeder-${index}`));

    const result = simulateStep(breeders);

    expect(result.toRemove).toEqual([]);
    expect(result.toAdd).toHaveLength(1);
    expect(result.toAdd.filter((offspring) => offspring.speciesId === 'fish')).toHaveLength(1);
    expect(updateFor(result, 'breeder-0')?.energy).toBeCloseTo(27.47, 5);
    expect(updateFor(result, 'breeder-1')?.energy).toBeCloseTo(54.94, 5);
  });

  it('does not let deaths and queued offspring together exceed the post-removal capacity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const organisms = [
      fish('breeder-1'),
      fish('breeder-2'),
      fish('dying-1', 0),
      fish('dying-2', 0),
    ];

    const result = simulateStep(organisms);

    expect(result.toRemove.sort()).toEqual(['dying-1', 'dying-2']);
    expect(result.toAdd).toHaveLength(2);
    expect(result.updates.filter(({ id }) => id.startsWith('breeder-'))).toHaveLength(2);
  });

  it('does not reproduce when the species is already at its population limit', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const turtles = Array.from({ length: 4 }, (_, index) =>
      createOrganism(`turtle-${index}`, 'turtle', { energy: 80 }),
    );
    const turtleEnergyCost = 0.05 + 0.7 * 0.02;

    const result = simulateStep(turtles);

    expect(result.toAdd).toEqual([]);
    turtles.forEach((turtle) => {
      expect(updateFor(result, turtle.id)?.energy).toBeCloseTo(80 - turtleEnergyCost, 5);
    });
  });

  it('does not reproduce or deduct energy for organisms removed during the frame', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const organisms = [fish('alive'), fish('dead', 0)];

    const result = simulateStep(organisms);

    expect(result.toRemove).toEqual(['dead']);
    expect(result.toAdd).toHaveLength(1);
    expect(updateFor(result, 'alive')?.energy).toBeCloseTo(27.47, 5);
    expect(result.updates.find((update) => update.id === 'dead')).toBeUndefined();
  });

  it('keeps predation behavior within the same simulation step', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const prey = fish('prey', 50, { position: new THREE.Vector3(0, 0, 0) });
    const predator = createOrganism('predator', 'bigfish', {
      energy: 60,
      position: new THREE.Vector3(0.1, 0, 0),
    });

    const result = simulateStep([prey, predator]);

    expect(result.toRemove).toEqual(['prey']);
    expect(result.toAdd).toEqual([]);
    expect(updateFor(result, 'predator')).toMatchObject({
      state: 'eating',
      energy: 109.932,
    });
  });
});
