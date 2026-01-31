import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Grid,
  Typography,
  CircularProgress,
  Alert,
  Pagination,
  Container,
} from '@mui/material';
import { RunCard } from './RunCard';
import { FilterPanel } from './FilterPanel';
import { apiClient } from '@/services/api';
import type { RunFilters } from '@/types/visualization';

interface RunBrowserProps {
  onRunSelect: (runId: number) => void;
}

export const RunBrowser: React.FC<RunBrowserProps> = ({ onRunSelect }) => {
  const [filters, setFilters] = useState<RunFilters>({
    limit: 20,
    offset: 0,
  });

  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['runs', filters],
    queryFn: () => apiClient.listRuns(filters),
    keepPreviousData: true,
  });

  const handlePageChange = (_event: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
    setFilters({
      ...filters,
      offset: (value - 1) * (filters.limit || 20),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFiltersChange = (newFilters: RunFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.total / (filters.limit || 20)) : 0;

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Typography variant="h4" gutterBottom>
        Simulation Runs
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <FilterPanel filters={filters} onFiltersChange={handleFiltersChange} />
        </Grid>

        <Grid item xs={12} md={9}>
          {isLoading && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 400,
              }}
            >
              <CircularProgress />
            </Box>
          )}

          {error && (
            <Alert severity="error">
              Failed to load simulation runs: {(error as Error).message}
            </Alert>
          )}

          {data && data.runs.length === 0 && (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 400,
              }}
            >
              <Typography variant="body1" color="text.secondary">
                No simulation runs found matching the filters
              </Typography>
            </Box>
          )}

          {data && data.runs.length > 0 && (
            <>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Showing {data.runs.length} of {data.total} runs
                </Typography>
              </Box>

              <Grid container spacing={2}>
                {data.runs.map((run) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={run.id}>
                    <RunCard run={run} onClick={onRunSelect} />
                  </Grid>
                ))}
              </Grid>

              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={handlePageChange}
                    color="primary"
                    size="large"
                  />
                </Box>
              )}
            </>
          )}
        </Grid>
      </Grid>
    </Container>
  );
};
