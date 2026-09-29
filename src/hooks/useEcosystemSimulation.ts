import { useEffect, useRef } from 'react';
import { useEcosystemStore } from '@/store/useEcosystemStore';
import { simulateStep } from '@/utils/ecosystemSimulator';

export function useEcosystemSimulation() {
  const frameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const isRunningRef = useRef<boolean>(true);

  const commitSimulationStep = useEcosystemStore((s) => s.commitSimulationStep);
  const incrementTime = useEcosystemStore((s) => s.incrementTime);
  const isRunning = useEcosystemStore((s) => s.isRunning);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    const tick = (time: number) => {
      if (isRunningRef.current && time - lastTimeRef.current > 60) {
        lastTimeRef.current = time;

        const organisms = useEcosystemStore.getState().organisms;
        const { updates, toRemove, toAdd } = simulateStep(organisms);

        commitSimulationStep({ updates, toRemove, toAdd });

        incrementTime();
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [commitSimulationStep, incrementTime]);
}
