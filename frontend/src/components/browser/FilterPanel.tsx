import React, { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Stack,
  Slider,
  FormControlLabel,
  Checkbox,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
} from '@mui/material';
import {
  ExpandMore,
  Science,
  Biotech,
  Assessment,
  Settings,
  Clear,
  Computer,
} from '@mui/icons-material';
import type { RunFilters } from '@/types/visualization';

interface FilterPanelProps {
  filters: RunFilters;
  onFiltersChange: (filters: RunFilters) => void;
}

const ENSEMBLE_TYPES = ['NVE', 'NVT', 'NPT', 'NPH', 'muVT', 'NVT_NVE'];
const ENGINE_NAMES = ['LAMMPS', 'GROMACS'];

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFiltersChange }) => {
  // Accordion expansion state
  const [expanded, setExpanded] = useState({
    simulation: true,
    composition: false,
    quality: true,
    hpc: false,
    display: false,
  });

  const handleChange = (key: keyof RunFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      limit: filters.limit,
      offset: 0,
    });
  };

  // Calculate active filter counts per section
  const filterCounts = useMemo(() => {
    const simulationCount = [
      filters.ensemble,
      filters.engine_name,
      filters.min_temperature,
      filters.max_temperature,
      filters.min_pressure,
      filters.max_pressure,
    ].filter((v) => v !== undefined).length;

    const compositionCount = filters.composition ? 1 : 0;

    const dataQualityCount = [
      filters.min_completeness !== undefined && filters.min_completeness > 0,
      filters.max_completeness !== undefined && filters.max_completeness < 100,
      filters.has_trajectory,
      filters.has_topology,
    ].filter(Boolean).length;

    const hpcCount = filters.slurm_job_id ? 1 : 0;

    const displayOptionsCount = filters.limit && filters.limit !== 20 ? 1 : 0;

    return {
      simulation: simulationCount,
      composition: compositionCount,
      quality: dataQualityCount,
      hpc: hpcCount,
      display: displayOptionsCount,
    };
  }, [filters]);

  const hasActiveFilters = Object.keys(filters).some(
    (key) => key !== 'limit' && key !== 'offset' && filters[key as keyof RunFilters] !== undefined
  );

  const handleAccordionChange = (panel: keyof typeof expanded) => (
    _: React.SyntheticEvent,
    isExpanded: boolean
  ) => {
    setExpanded((prev) => ({ ...prev, [panel]: isExpanded }));
  };

  return (
    <Box>
      <Typography
        variant="subtitle2"
        gutterBottom
        sx={{
          fontWeight: 600,
          mb: 2,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Filter Options
      </Typography>

      <Stack spacing={1}>
        {/* Simulation Parameters Accordion */}
        <Accordion
          expanded={expanded.simulation}
          onChange={handleAccordionChange('simulation')}
          disableGutters
          elevation={0}
          sx={{
            backgroundColor:
              filterCounts.simulation > 0 ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
            borderLeft: filterCounts.simulation > 0 ? '3px solid' : 'none',
            borderLeftColor: 'primary.main',
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:before': { display: 'none' },
            '&:hover': {
              backgroundColor:
                filterCounts.simulation > 0 ? 'rgba(25, 118, 210, 0.12)' : 'action.hover',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                my: 1,
              },
            }}
          >
            <Science sx={{ mr: 1.5, fontSize: 20, color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
              Simulation Parameters
            </Typography>
            {filterCounts.simulation > 0 && (
              <Badge
                badgeContent={filterCounts.simulation}
                color="primary"
                sx={{
                  ml: 'auto',
                  mr: 2,
                  '& .MuiBadge-badge': { fontWeight: 600 },
                }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 2 }}>
            <Stack spacing={2.5}>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel>Ensemble</InputLabel>
                <Select
                  value={filters.ensemble || ''}
                  label="Ensemble"
                  onChange={(e) => handleChange('ensemble', e.target.value)}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">All</MenuItem>
                  {ENSEMBLE_TYPES.map((ensemble) => (
                    <MenuItem key={ensemble} value={ensemble}>
                      {ensemble}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel>Engine</InputLabel>
                <Select
                  value={filters.engine_name || ''}
                  label="Engine"
                  onChange={(e) => handleChange('engine_name', e.target.value)}
                  sx={{ borderRadius: 2 }}
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
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}
                >
                  Temperature (K)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    label="Min"
                    type="number"
                    size="small"
                    value={filters.min_temperature || ''}
                    onChange={(e) =>
                      handleChange(
                        'min_temperature',
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <TextField
                    label="Max"
                    type="number"
                    size="small"
                    value={filters.max_temperature || ''}
                    onChange={(e) =>
                      handleChange(
                        'max_temperature',
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Box>
              </Box>

              <Box>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}
                >
                  Pressure (bar)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    label="Min"
                    type="number"
                    size="small"
                    value={filters.min_pressure || ''}
                    onChange={(e) =>
                      handleChange(
                        'min_pressure',
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                  <TextField
                    label="Max"
                    type="number"
                    size="small"
                    value={filters.max_pressure || ''}
                    onChange={(e) =>
                      handleChange(
                        'max_pressure',
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                  />
                </Box>
              </Box>
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* Composition Accordion */}
        <Accordion
          expanded={expanded.composition}
          onChange={handleAccordionChange('composition')}
          disableGutters
          elevation={0}
          sx={{
            backgroundColor:
              filterCounts.composition > 0 ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
            borderLeft: filterCounts.composition > 0 ? '3px solid' : 'none',
            borderLeftColor: 'primary.main',
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:before': { display: 'none' },
            '&:hover': {
              backgroundColor:
                filterCounts.composition > 0 ? 'rgba(25, 118, 210, 0.12)' : 'action.hover',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                my: 1,
              },
            }}
          >
            <Biotech sx={{ mr: 1.5, fontSize: 20, color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>Composition</Typography>
            {filterCounts.composition > 0 && (
              <Badge
                badgeContent={filterCounts.composition}
                color="primary"
                sx={{
                  ml: 'auto',
                  mr: 2,
                  '& .MuiBadge-badge': { fontWeight: 600 },
                }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 2 }}>
            <TextField
              label="Composition"
              size="small"
              value={filters.composition || ''}
              onChange={(e) => handleChange('composition', e.target.value)}
              placeholder="e.g., water, urea, lysozyme"
              fullWidth
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </AccordionDetails>
        </Accordion>

        {/* Data Quality Accordion */}
        <Accordion
          expanded={expanded.quality}
          onChange={handleAccordionChange('quality')}
          disableGutters
          elevation={0}
          sx={{
            backgroundColor:
              filterCounts.quality > 0 ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
            borderLeft: filterCounts.quality > 0 ? '3px solid' : 'none',
            borderLeftColor: 'primary.main',
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:before': { display: 'none' },
            '&:hover': {
              backgroundColor:
                filterCounts.quality > 0 ? 'rgba(25, 118, 210, 0.12)' : 'action.hover',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                my: 1,
              },
            }}
          >
            <Assessment sx={{ mr: 1.5, fontSize: 20, color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>Data Quality</Typography>
            {filterCounts.quality > 0 && (
              <Badge
                badgeContent={filterCounts.quality}
                color="primary"
                sx={{
                  ml: 'auto',
                  mr: 2,
                  '& .MuiBadge-badge': { fontWeight: 600 },
                }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 2 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography
                  variant="subtitle2"
                  gutterBottom
                  sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.75rem' }}
                >
                  Data Completeness
                </Typography>
                <Box sx={{ px: 1, py: 1 }}>
                  <Slider
                    value={[filters.min_completeness || 0, filters.max_completeness || 100]}
                    onChange={(_, value) => {
                      const [min, max] = value as number[];
                      onFiltersChange({
                        ...filters,
                        min_completeness: min > 0 ? min : undefined,
                        max_completeness: max < 100 ? max : undefined,
                      });
                    }}
                    valueLabelDisplay="auto"
                    min={0}
                    max={100}
                    marks={[
                      { value: 0, label: '0%' },
                      { value: 50, label: '50%' },
                      { value: 100, label: '100%' },
                    ]}
                    sx={{
                      mt: 2,
                      '& .MuiSlider-thumb': {
                        width: 18,
                        height: 18,
                      },
                      '& .MuiSlider-track': {
                        height: 6,
                      },
                      '& .MuiSlider-rail': {
                        height: 6,
                        opacity: 0.3,
                      },
                    }}
                  />
                </Box>
              </Box>

              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.has_trajectory || false}
                    onChange={(e) =>
                      handleChange('has_trajectory', e.target.checked || undefined)
                    }
                    sx={{ '& .MuiSvgIcon-root': { fontSize: 22 } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Has Trajectory
                  </Typography>
                }
                sx={{ ml: 0 }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={filters.has_topology || false}
                    onChange={(e) => handleChange('has_topology', e.target.checked || undefined)}
                    sx={{ '& .MuiSvgIcon-root': { fontSize: 22 } }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Has Topology
                  </Typography>
                }
                sx={{ ml: 0 }}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>

        {/* HPC / SLURM Accordion */}
        <Accordion
          expanded={expanded.hpc}
          onChange={handleAccordionChange('hpc')}
          disableGutters
          elevation={0}
          sx={{
            backgroundColor:
              filterCounts.hpc > 0 ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
            borderLeft: filterCounts.hpc > 0 ? '3px solid' : 'none',
            borderLeftColor: 'primary.main',
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:before': { display: 'none' },
            '&:hover': {
              backgroundColor:
                filterCounts.hpc > 0 ? 'rgba(25, 118, 210, 0.12)' : 'action.hover',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                my: 1,
              },
            }}
          >
            <Computer sx={{ mr: 1.5, fontSize: 20, color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>HPC / SLURM</Typography>
            {filterCounts.hpc > 0 && (
              <Badge
                badgeContent={filterCounts.hpc}
                color="primary"
                sx={{ ml: 'auto', mr: 2, '& .MuiBadge-badge': { fontWeight: 600 } }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 2 }}>
            <TextField
              label="SLURM Job ID"
              size="small"
              fullWidth
              value={filters.slurm_job_id || ''}
              onChange={(e) => handleChange('slurm_job_id', e.target.value)}
              placeholder="e.g. 12345678"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </AccordionDetails>
        </Accordion>

        {/* Display Options Accordion */}
        <Accordion
          expanded={expanded.display}
          onChange={handleAccordionChange('display')}
          disableGutters
          elevation={0}
          sx={{
            backgroundColor:
              filterCounts.display > 0 ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
            borderLeft: filterCounts.display > 0 ? '3px solid' : 'none',
            borderLeftColor: 'primary.main',
            borderRadius: 1,
            transition: 'all 0.2s ease',
            '&:before': { display: 'none' },
            '&:hover': {
              backgroundColor:
                filterCounts.display > 0 ? 'rgba(25, 118, 210, 0.12)' : 'action.hover',
            },
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{
              minHeight: 48,
              '& .MuiAccordionSummary-content': {
                alignItems: 'center',
                my: 1,
              },
            }}
          >
            <Settings sx={{ mr: 1.5, fontSize: 20, color: 'primary.main' }} />
            <Typography sx={{ fontWeight: 500, fontSize: '0.9rem' }}>
              Display Options
            </Typography>
            {filterCounts.display > 0 && (
              <Badge
                badgeContent={filterCounts.display}
                color="primary"
                sx={{
                  ml: 'auto',
                  mr: 2,
                  '& .MuiBadge-badge': { fontWeight: 600 },
                }}
              />
            )}
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 2 }}>
            <TextField
              label="Results per page"
              type="number"
              size="small"
              value={filters.limit || 20}
              onChange={(e) => handleChange('limit', e.target.value ? Number(e.target.value) : 20)}
              fullWidth
              inputProps={{ min: 1, max: 100 }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </AccordionDetails>
        </Accordion>
      </Stack>

      {/* Clear All Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="contained"
          color="error"
          fullWidth
          startIcon={<Clear />}
          onClick={handleClearFilters}
          sx={{
            mt: 3,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            boxShadow: 2,
            '&:hover': {
              boxShadow: 4,
            },
          }}
        >
          Clear All Filters
        </Button>
      )}
    </Box>
  );
};
