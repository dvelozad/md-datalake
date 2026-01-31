import { useEffect, useRef, useState, useCallback } from 'react';
import * as NGL from 'ngl';

export interface NGLStageOptions {
  backgroundColor?: string;
  quality?: 'auto' | 'low' | 'medium' | 'high';
  sampleLevel?: number;
}

export function useNGLStage(
  containerRef: React.RefObject<HTMLDivElement>,
  options: NGLStageOptions = {}
) {
  const [stage, setStage] = useState<NGL.Stage | null>(null);
  const [structureComponent, setStructureComponent] = useState<NGL.StructureComponent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initRef = useRef(false);

  // Initialize NGL Stage
  useEffect(() => {
    if (!containerRef.current || initRef.current) return;

    try {
      const nglStage = new NGL.Stage(containerRef.current, {
        backgroundColor: options.backgroundColor || 'white',
        quality: options.quality || 'medium',
        sampleLevel: options.sampleLevel || 1,
      });

      // Handle window resize
      const handleResize = () => {
        nglStage.handleResize();
      };

      window.addEventListener('resize', handleResize);

      setStage(nglStage);
      initRef.current = true;

      return () => {
        window.removeEventListener('resize', handleResize);
        nglStage.dispose();
      };
    } catch (err) {
      setError(err as Error);
    }
  }, [containerRef, options.backgroundColor, options.quality, options.sampleLevel]);

  const loadStructure = useCallback(
    async (url: string, format?: string) => {
      if (!stage) return;

      try {
        setIsLoading(true);
        setError(null);

        const structure = await stage.loadFile(url, { ext: format });
        setStructureComponent(structure);

        // Auto-center and zoom
        structure.autoView();

        return structure;
      } catch (err) {
        setError(err as Error);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [stage]
  );

  const addRepresentation = useCallback(
    (type: string, params?: any) => {
      if (!structureComponent) return;

      try {
        const representation = structureComponent.addRepresentation(type, params);
        return representation;
      } catch (err) {
        setError(err as Error);
        throw err;
      }
    },
    [structureComponent]
  );

  const removeAllRepresentations = useCallback(() => {
    if (!structureComponent) return;
    structureComponent.removeAllRepresentations();
  }, [structureComponent]);

  const setRepresentation = useCallback(
    (type: string, params?: any) => {
      if (!structureComponent) return;

      removeAllRepresentations();
      return addRepresentation(type, params);
    },
    [structureComponent, removeAllRepresentations, addRepresentation]
  );

  const centerView = useCallback(() => {
    if (!structureComponent) return;
    structureComponent.autoView();
  }, [structureComponent]);

  const setFrame = useCallback(
    (frameIndex: number) => {
      if (!structureComponent) return;

      const trajectory = structureComponent.structure.trajectory;
      if (trajectory) {
        trajectory.setFrame(frameIndex);
        stage?.viewer.requestRender();
      }
    },
    [structureComponent, stage]
  );

  const getFrameCount = useCallback(() => {
    if (!structureComponent) return 0;

    const trajectory = structureComponent.structure.trajectory;
    return trajectory ? trajectory.numframes : 1;
  }, [structureComponent]);

  const getCurrentFrame = useCallback(() => {
    if (!structureComponent) return 0;

    const trajectory = structureComponent.structure.trajectory;
    return trajectory ? trajectory.frame : 0;
  }, [structureComponent]);

  return {
    stage,
    structureComponent,
    isLoading,
    error,
    loadStructure,
    addRepresentation,
    removeAllRepresentations,
    setRepresentation,
    centerView,
    setFrame,
    getFrameCount,
    getCurrentFrame,
  };
}
