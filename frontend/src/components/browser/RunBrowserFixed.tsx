import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Alert,
  Paper,
  Divider,
  IconButton,
  TextField,
  InputAdornment,
} from '@mui/material';
import { FilterList, Close, Search, HelpOutline } from '@mui/icons-material';
import { RunTable, type TableStyle } from './RunTable';
import { FilterPanel } from './FilterPanel';
import { apiClient } from '@/services/api';
import type { RunFilters } from '@/types/visualization';
import './RunTable.css';

interface RunBrowserProps {
  onRunSelect: (runId: number) => void;
}

export const RunBrowserFixed: React.FC<RunBrowserProps> = ({ onRunSelect }) => {
  const [filters, setFilters] = useState<RunFilters>({
    limit: 20,
    offset: 0,
  });
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [tableStyle, setTableStyle] = useState<TableStyle>('notebook');

  const { data, isLoading, error } = useQuery({
    queryKey: ['runs', filters],
    queryFn: () => apiClient.listRuns(filters),
    placeholderData: (previousData) => previousData,
  });

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

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    setSearchQuery(query);

    // Apply search filter
    setFilters({
      ...filters,
      search: query || undefined,
      offset: 0,
    });
    setPage(0);
  };

  // Calculate active filter count for badge
  const activeFilterCount = Object.keys(filters).filter(
    (key) => key !== 'limit' && key !== 'offset' && filters[key as keyof RunFilters] !== undefined
  ).length;

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden', position: 'relative' }}>
      {/* NOMAD-Style Filter Panel - Full Height Sidebar (Fixed Position) */}
      <Box
        sx={{
          position: 'fixed',
          left: filterOpen ? 0 : -320,
          top: 64, // Start below the header
          height: 'calc(100vh - 64px)', // Full height minus header
          width: 320,
          transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: (theme) => theme.zIndex.drawer,
        }}
      >
        {/* Filter Panel - Main Sidebar */}
        <Paper
          elevation={8}
          sx={{
            width: 320,
            height: '100%',
            borderRight: 'none',
            borderRadius: 0,
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? '#1a1a1a'
                : '#ffffff',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ p: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              <FilterList color="primary" />
              Filters
            </Typography>
            <IconButton onClick={() => setFilterOpen(false)} size="small">
              <Close />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ p: 2, overflow: 'auto', flex: 1 }}>
            <FilterPanel filters={filters} onFiltersChange={handleFiltersChange} />
          </Box>
        </Paper>

        {/* NOMAD-Style Filter Tab - Full Height */}
        <Box
          onClick={() => setFilterOpen(!filterOpen)}
          sx={{
            position: 'absolute',
            right: -42,
            top: 0,
            width: 42,
            height: '100%',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            // Match the panel background
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? '#1a1a1a'
                : '#ffffff',
            borderRight: '1px solid',
            borderRightColor: 'divider',
            boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? '#252525'
                  : '#f5f5f5',
              boxShadow: '3px 0 12px rgba(0,0,0,0.15)',
            },
          }}
        >
          {/* Vertical FILTERS text */}
          <Box
            sx={{
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              fontSize: '0.85rem',
              fontWeight: 700,
              letterSpacing: '3px',
              textTransform: 'uppercase',
              color: 'text.primary',
              userSelect: 'none',
            }}
          >
            Filters
          </Box>

          {/* Filter icon */}
          <FilterList sx={{ fontSize: 22, color: 'primary.main' }} />

          {/* Active filter count badge */}
          {activeFilterCount > 0 && (
            <Box
              sx={{
                backgroundColor: 'error.main',
                color: 'error.contrastText',
                borderRadius: '50%',
                width: 22,
                height: 22,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.7rem',
                fontWeight: 700,
                boxShadow: 2,
              }}
            >
              {activeFilterCount}
            </Box>
          )}
        </Box>
      </Box>

      {/* Main Content - Shifts to avoid overlap */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // Account for filter panel (320px) + tab (42px) when open, just tab (42px) when closed
          marginLeft: filterOpen ? '362px' : '42px',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <Box sx={{ px: 3, py: 2, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          {/* Search Box */}
          <Paper
            elevation={1}
            sx={{
              mb: 1.5,
              borderRadius: 0.5,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <TextField
              fullWidth
              placeholder="Search by name, composition, method, or keywords..."
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ color: 'text.secondary', fontSize: 20 }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" sx={{ color: 'text.secondary', p: 0.5 }}>
                      <HelpOutline fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
                sx: {
                  fontSize: '0.9rem',
                  '& .MuiOutlinedInput-notchedOutline': {
                    border: 'none',
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    border: 'none',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    border: 'none',
                  },
                  py: 0.25,
                  px: 1.5,
                },
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '0.9rem',
                  py: 0.5,
                },
              }}
            />
          </Paper>

          {/* Meta bar: eyebrow + count on left, style switcher on right */}
          <div className="rt-meta-bar">
            <div className="rt-meta-bar__left">
              <span className="t-eyebrow">Datalake</span>
              <span className="rt-meta-bar__count">
                <b>{data?.total ?? 0}</b> runs · <span className="t-numeric">{
                  // Count unique ensembles from current page data
                  new Set(data?.runs?.map(r => r.ensemble).filter(Boolean)).size
                }</span> ensembles
              </span>
            </div>
            <div className="rt-switcher">
              <button
                className={`rt-switcher__btn ${tableStyle === 'notebook' ? 'rt-switcher__btn--active' : ''}`}
                onClick={() => setTableStyle('notebook')}
              >
                Notebook
              </button>
              <button
                className={`rt-switcher__btn ${tableStyle === 'editorial' ? 'rt-switcher__btn--active' : ''}`}
                onClick={() => setTableStyle('editorial')}
              >
                Editorial
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 1.5, borderRadius: 0.5 }}>
              Failed to load simulation runs: {(error as Error).message}
            </Alert>
          )}

          {/* Empty State */}
          {!isLoading && data && data.runs.length === 0 ? (
            <Paper
              elevation={3}
              sx={{
                p: 8,
                textAlign: 'center',
                borderRadius: 0.5,
                background: (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
                    : 'linear-gradient(135deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
              }}
            >
              <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 600 }}>
                No simulation runs found
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Try adjusting your filters or upload a new trajectory
              </Typography>
            </Paper>
          ) : (
            /* Table */
            <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <RunTable
                runs={data?.runs || []}
                isLoading={isLoading}
                page={page}
                pageSize={filters.limit || 20}
                totalRows={data?.total || 0}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                onRunSelect={onRunSelect}
                tableStyle={tableStyle}
              />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
