import React, { useRef, useEffect, useState } from 'react';
import { Box, Paper, CircularProgress, Alert } from '@mui/material';
import { useNGLStage } from '@/hooks/useNGLStage';
import type { MDservClient } from '@/services/mdserv';

interface NGLViewerWrapperProps {
  mdservClient: MDservClient | null;
  trajectoryUrl?: string;
  topologyUrl?: string;
  currentFrame?: number;
  representationType?: string;
  onFrameChange?: (frameIndex: number) => void;
}

export const NGLViewerWrapper: React.FC<NGLViewerWrapperProps> = ({
  mdservClient,
  trajectoryUrl,
  topologyUrl,
  currentFrame = 0,
  representationType = 'ball+stick',
  onFrameChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameCount, setFrameCount] = useState(0);

  const {
    stage,
    structureComponent,
    isLoading,
    error,
    loadStructure,
    setRepresentation,
    setFrame,
    getFrameCount,
  } = useNGLStage(containerRef, {
    backgroundColor: '#f5f5f5',
    quality: 'medium',
  });

  // Load initial structure
  useEffect(() => {
    if (!stage || !topologyUrl) return;

    loadStructure(topologyUrl)
      .then(() => {
        const count = getFrameCount();
        setFrameCount(count);
      })
      .catch((err) => {
        console.error('Failed to load structure:', err);
      });
  }, [stage, topologyUrl, loadStructure, getFrameCount]);

  // Update representation when type changes
  useEffect(() => {
    if (!structureComponent) return;

    setRepresentation(representationType, {
      colorScheme: 'element',
      radiusScale: 0.5,
    });
  }, [representationType, structureComponent, setRepresentation]);

  // Update frame when currentFrame changes
  useEffect(() => {
    if (structureComponent && currentFrame !== undefined) {
      setFrame(currentFrame);
    }
  }, [currentFrame, structureComponent, setFrame]);

  // Listen to MDsrv frame updates
  useEffect(() => {
    if (!mdservClient) return;

    const unsubscribe = mdservClient.onFrame((frameData) => {
      if (structureComponent) {
        // Update coordinates from MDsrv
        const structure = structureComponent.structure;
        const coords = structure.getCoords();

        // Copy new coordinates
        coords.set(frameData.coordinates);

        // Trigger render
        structure.refreshPosition();
        stage?.viewer.requestRender();

        if (onFrameChange) {
          onFrameChange(frameData.frameIndex);
        }
      }
    });

    return unsubscribe;
  }, [mdservClient, structureComponent, stage, onFrameChange]);

  return (
    <Paper
      elevation={2}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
      />

      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
          }}
        >
          <Alert severity="error">Failed to load structure: {error.message}</Alert>
        </Box>
      )}

      {frameCount > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            px: 2,
            py: 1,
            bgcolor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 1,
            fontSize: '0.875rem',
            fontFamily: 'monospace',
          }}
        >
          Frame {currentFrame + 1} / {frameCount}
        </Box>
      )}
    </Paper>
  );
};
