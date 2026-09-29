import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';
import * as THREE from 'three';
import type { Organism } from '@/types/ecosystem';
import { useEcosystemStore } from '@/store/useEcosystemStore';

function createTestOrganism(id: string, speciesId = 'fish'): Organism {
  return {
    id,
    speciesId,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    energy: 50,
    age: 1,
    state: 'idle',
    targetId: null,
    rotation: 0,
    scale: 1,
  };
}

describe('commitSimulationStep', () => {
  beforeEach(() => {
    useEcosystemStore.setState({ organisms: [], selectedOrganismId: null });
  });

  it('applies updates, removals and additions in one committed state', () => {
    const survivor = createTestOrganism('survivor');
    const removed = createTestOrganism('removed');
    useEcosystemStore.setState({
      organisms: [survivor, removed],
      selectedOrganismId: removed.id,
    });

    const states: number[] = [];
    const unsubscribe = useEcosystemStore.subscribe((state) => {
      states.push(state.organisms.length);
    });

    useEcosystemStore.getState().commitSimulationStep({
      updates: [{ id: survivor.id, updates: { energy: 25 } }],
      toRemove: [removed.id],
      toAdd: [{ speciesId: 'fish', position: new THREE.Vector3(1, 0, 0) }],
    });
    unsubscribe();

    const organisms = useEcosystemStore.getState().organisms;
    assert.equal(organisms.length, 2);
    assert.deepEqual(states, [2]);
    assert.equal(organisms[0].id, survivor.id);
    assert.equal(organisms[0].energy, 25);
    assert.equal(organisms[1].speciesId, 'fish');
    assert.equal(useEcosystemStore.getState().selectedOrganismId, null);
  });
});
