import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Alert,
  Container,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { CloudUpload, Refresh } from '@mui/icons-material';
import { apiClient } from '@/services/api';
import type { RunFilters } from '@/types/visualization';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeContext } from '@/contexts/ThemeContext';

interface RunBrowserSimpleProps {
  onRunSelect: (runId: number) => void;
}

export const RunBrowserSimple: React.FC<RunBrowserSimpleProps> = ({ onRunSelect }) => {
  const navigate = useNavigate();
  const { mode, toggleTheme } = useThemeContext();
  const [filters] = useState<RunFilters>({
    limit: 20,
    offset: 0,
  });

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['runs', filters],
    queryFn: () => apiClient.listRuns(filters),
  });

  const handleRefresh = () => {
    refetch();
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Simulation Runs (Debug)</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title="Refresh runs">
            <IconButton onClick={handleRefresh} disabled={isRefetching} color="primary">
              <Refresh />
            </IconButton>
          </Tooltip>
          <ThemeToggle mode={mode} onToggle={toggleTheme} />
          <Button
            variant="contained"
            startIcon={<CloudUpload />}
            onClick={() => navigate('/upload')}
          >
            Upload Trajectory
          </Button>
        </Box>
      </Box>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error">
          Failed to load simulation runs: {(error as Error).message}
        </Alert>
      )}

      {data && (
        <Box>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Found {data.total} runs
          </Typography>
          <Alert severity="info">
            Debug view - Table component will load here
          </Alert>
        </Box>
      )}
    </Container>
  );
};
