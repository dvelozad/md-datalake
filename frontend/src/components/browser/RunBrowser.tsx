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
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { CloudUpload, Refresh, FilterList } from '@mui/icons-material';
import { RunTable } from './RunTable';
import { FilterPanel } from './FilterPanel';
import { apiClient } from '@/services/api';
import type { RunFilters } from '@/types/visualization';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeContext } from '@/contexts/ThemeContext';

interface RunBrowserProps {
  onRunSelect: (runId: number) => void;
}

export const RunBrowser: React.FC<RunBrowserProps> = ({ onRunSelect }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { mode, toggleTheme } = useThemeContext();
  const [filters, setFilters] = useState<RunFilters>({
    limit: 20,
    offset: 0,
  });
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(!isMobile);

  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['runs', filters],
    queryFn: () => apiClient.listRuns(filters),
    placeholderData: (previousData) => previousData,
  });

  const handleRefresh = () => {
    refetch();
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setFilters({
      ...filters,
      offset: newPage * (filters.limit || 20),
    });
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setFilters({
      ...filters,
      limit: newPageSize,
      offset: 0,
    });
    setPage(0);
  };

  const handleFiltersChange = (newFilters: RunFilters) => {
    setFilters(newFilters);
    setPage(0);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4">Simulation Runs</Typography>
          <Typography variant="body2" color="text.secondary">
            {data ? `${data.total.toLocaleString()} total` : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Tooltip title={filterDrawerOpen ? 'Hide filters' : 'Show filters'}>
            <IconButton
              onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
              color={filterDrawerOpen ? 'primary' : 'default'}
            >
              <FilterList />
            </IconButton>
          </Tooltip>
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

      {/* Main Content with Filter Drawer */}
      <Box sx={{ display: 'flex', gap: 3, position: 'relative' }}>
        {/* Filter Drawer */}
        <Drawer
          variant={isMobile ? 'temporary' : 'persistent'}
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
          sx={{
            width: 280,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: 280,
              position: isMobile ? 'fixed' : 'relative',
              height: isMobile ? '100vh' : 'auto',
              boxSizing: 'border-box',
              border: 'none',
            },
          }}
        >
          <FilterPanel filters={filters} onFiltersChange={handleFiltersChange} />
        </Drawer>

        {/* Table */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Failed to load simulation runs: {(error as Error).message}
            </Alert>
          )}

          {data && data.runs.length === 0 && !isLoading ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 400,
                gap: 2,
              }}
            >
              <Typography variant="h6" color="text.secondary">
                No simulation runs found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try adjusting your filters or upload a new trajectory
              </Typography>
            </Box>
          ) : (
            <RunTable
              runs={data?.runs || []}
              isLoading={isLoading}
              page={page}
              pageSize={filters.limit || 20}
              totalRows={data?.total || 0}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              onRunSelect={onRunSelect}
            />
          )}
        </Box>
      </Box>
    </Container>
  );
};
