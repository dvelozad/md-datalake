import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Container,
  Grid,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Button,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { NGLViewerWrapper } from '@/components/visualization/NGLViewerWrapper';
import { FrameControls } from '@/components/visualization/FrameControls';
import { StyleSelector } from '@/components/visualization/StyleSelector';
import { SessionStatus } from '@/components/visualization/SessionStatus';
import { PropertyPlot } from '@/components/properties/PropertyPlot';
import { useMDservSession } from '@/hooks/useMDservSession';
import { apiClient } from '@/services/api';

export const VisualizationPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [currentFrame, setCurrentFrame] = useState(0);
  const [representationType, setRepresentationType] = useState('ball+stick');

  const runIdNum = runId ? parseInt(runId, 10) : 0;

  const { data: run } = useQuery({
    queryKey: ['run', runIdNum],
    queryFn: () => apiClient.getRun(runIdNum),
    enabled: runIdNum > 0,
  });

  const { data: artifacts } = useQuery({
    queryKey: ['artifacts', runIdNum],
    queryFn: () => apiClient.getRunArtifacts(runIdNum),
    enabled: runIdNum > 0,
  });

  const { data: observables } = useQuery({
    queryKey: ['observables', runIdNum],
    queryFn: () => apiClient.getRunObservables(runIdNum),
    enabled: runIdNum > 0,
  });

  const {
    session,
    client: mdservClient,
    status,
    timeRemaining,
    reconnect,
  } = useMDservSession({
    runId: runIdNum,
    autoConnect: true,
  });

  const trajectoryArtifact = artifacts?.find((a) =>
    ['trajectory', 'xtc', 'trr', 'dcd'].includes(a.artifact_type)
  );

  const topologyArtifact = artifacts?.find((a) =>
    ['topology', 'gro', 'pdb', 'top'].includes(a.artifact_type)
  );

  const trajectoryUrl = trajectoryArtifact
    ? `/api/v1/artifacts/${trajectoryArtifact.id}/download`
    : undefined;

  const topologyUrl = topologyArtifact
    ? `/api/v1/artifacts/${topologyArtifact.id}/download`
    : undefined;

  const frameCount = trajectoryArtifact?.frame_count || 0;

  const handleFrameChange = (frame: number) => {
    setCurrentFrame(frame);
    if (mdservClient) {
      mdservClient.requestFrame(frame);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/')}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {run?.run_name || 'Visualization'}
          </Typography>
          {run && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Typography variant="body2">
                {run.ensemble} | {run.engine.name} {run.engine.version}
              </Typography>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ flexGrow: 1, py: 3, overflow: 'auto' }}>
        <Grid container spacing={3}>
          {/* Left panel - Controls */}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <SessionStatus
                status={status}
                timeRemaining={timeRemaining}
                onReconnect={reconnect}
              />

              <StyleSelector
                selectedStyle={representationType}
                onStyleChange={setRepresentationType}
              />

              {session && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Session ID: {session.session_id.substring(0, 8)}...
                  </Typography>
                </Box>
              )}
            </Box>
          </Grid>

          {/* Center panel - Visualization */}
          <Grid item xs={12} md={9}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ height: 500 }}>
                <NGLViewerWrapper
                  mdservClient={mdservClient}
                  trajectoryUrl={trajectoryUrl}
                  topologyUrl={topologyUrl}
                  currentFrame={currentFrame}
                  representationType={representationType}
                  onFrameChange={setCurrentFrame}
                />
              </Box>

              <FrameControls
                mdservClient={mdservClient}
                frameCount={frameCount}
                currentFrame={currentFrame}
                onFrameChange={handleFrameChange}
              />

              {observables && observables.length > 0 && (
                <PropertyPlot
                  observables={observables}
                  currentFrame={currentFrame}
                  onFrameClick={handleFrameChange}
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
