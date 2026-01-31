import React from 'react';
import {
  Paper,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Divider,
  Stack,
} from '@mui/material';
import type { RunFilters } from '@/types/visualization';

interface FilterPanelProps {
  filters: RunFilters;
  onFiltersChange: (filters: RunFilters) => void;
}

const ENSEMBLE_TYPES = ['NVE', 'NVT', 'NPT', 'NPH', 'muVT', 'NVT_NVE'];
const ENGINE_NAMES = ['LAMMPS', 'GROMACS'];

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFiltersChange }) => {
  const handleChange = (key: keyof RunFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Filters
      </Typography>

      <Divider sx={{ mb: 2 }} />

      <Stack spacing={2}>
        <FormControl fullWidth size="small">
          <InputLabel>Ensemble</InputLabel>
          <Select
            value={filters.ensemble || ''}
            label="Ensemble"
            onChange={(e) => handleChange('ensemble', e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {ENSEMBLE_TYPES.map((ensemble) => (
              <MenuItem key={ensemble} value={ensemble}>
                {ensemble}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth size="small">
          <InputLabel>Engine</InputLabel>
          <Select
            value={filters.engine_name || ''}
            label="Engine"
            onChange={(e) => handleChange('engine_name', e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {ENGINE_NAMES.map((engine) => (
              <MenuItem key={engine} value={engine}>
                {engine}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Temperature (K)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Min"
              type="number"
              size="small"
              value={filters.min_temperature || ''}
              onChange={(e) =>
                handleChange('min_temperature', e.target.value ? Number(e.target.value) : undefined)
              }
              fullWidth
            />
            <TextField
              label="Max"
              type="number"
              size="small"
              value={filters.max_temperature || ''}
              onChange={(e) =>
                handleChange('max_temperature', e.target.value ? Number(e.target.value) : undefined)
              }
              fullWidth
            />
          </Box>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Pressure (bar)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Min"
              type="number"
              size="small"
              value={filters.min_pressure || ''}
              onChange={(e) =>
                handleChange('min_pressure', e.target.value ? Number(e.target.value) : undefined)
              }
              fullWidth
            />
            <TextField
              label="Max"
              type="number"
              size="small"
              value={filters.max_pressure || ''}
              onChange={(e) =>
                handleChange('max_pressure', e.target.value ? Number(e.target.value) : undefined)
              }
              fullWidth
            />
          </Box>
        </Box>

        <TextField
          label="Composition"
          size="small"
          value={filters.composition || ''}
          onChange={(e) => handleChange('composition', e.target.value)}
          placeholder="e.g., water, urea, lysozyme"
          fullWidth
        />

        <TextField
          label="Results per page"
          type="number"
          size="small"
          value={filters.limit || 20}
          onChange={(e) => handleChange('limit', e.target.value ? Number(e.target.value) : 20)}
          fullWidth
          inputProps={{ min: 1, max: 100 }}
        />
      </Stack>
    </Paper>
  );
};
