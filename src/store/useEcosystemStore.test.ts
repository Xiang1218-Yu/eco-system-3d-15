import { beforeEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { useEcosystemStore } from './useEcosystemStore';
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

describe('useEcosystemStore.commitSimulationStep', () => {
  beforeEach(() => {
    useEcosystemStore.setState({
      organisms: [],
      selectedSpeciesId: null,
      selectedOrganismId: null,
      isRunning: true,
      simulationTime: 0,
      showLabels: true,
    });
  });

  it('commits updates, removals, and additions against the same post-step population', () => {
    const keep = createOrganism('keep', 'fish', { energy: 20 });
    const remove = createOrganism('remove', 'fish');
    useEcosystemStore.setState({ organisms: [keep, remove] });

    useEcosystemStore.getState().commitSimulationStep({
      updates: [{ id: 'keep', updates: { energy: 21 } }],
      toRemove: ['remove'],
      toAdd: [{ speciesId: 'fish', position: new THREE.Vector3(1, 0, 0) }],
    });

    const { organisms } = useEcosystemStore.getState();
    expect(organisms.map(({ id }) => id)).toContain('keep');
    expect(organisms.find((organism) => organism.id === 'keep')?.energy).toBe(21);
    expect(organisms).toHaveLength(2);
    expect(organisms.filter((organism) => organism.speciesId === 'fish')).toHaveLength(2);
  });

  it('rejects queued additions that would exceed the species limit', () => {
    const fish = Array.from({ length: 12 }, (_, index) => createOrganism(`fish-${index}`, 'fish'));
    useEcosystemStore.setState({ organisms: fish });

    useEcosystemStore.getState().commitSimulationStep({
      updates: [],
      toRemove: ['fish-0'],
      toAdd: [
        { speciesId: 'fish' },
        { speciesId: 'fish' },
        { speciesId: 'fish' },
      ],
    });

    expect(
      useEcosystemStore
        .getState()
        .organisms.filter((organism) => organism.speciesId === 'fish'),
    ).toHaveLength(12);
  });
});
