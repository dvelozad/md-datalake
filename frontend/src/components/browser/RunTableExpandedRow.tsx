import React from 'react';
import { Box, Grid, Typography, Chip, LinearProgress, Link } from '@mui/material';
import { CheckCircle, Warning, OpenInNew } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import type { SimulationRun } from '@/types/visualization';

interface RunTableExpandedRowProps {
  run: SimulationRun;
}

export const RunTableExpandedRow: React.FC<RunTableExpandedRowProps> = ({ run }) => {
  const navigate = useNavigate();

  const formatTime = (ns: number) => {
    if (ns < 1) {
      return `${(ns * 1000).toFixed(0)} ps`;
    } else if (ns < 1000) {
      return `${ns.toFixed(1)} ns`;
    } else {
      return `${(ns / 1000).toFixed(2)} μs`;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box
      sx={{
        px: 4,
        py: 2.5,
        backgroundColor: 'background.paper',
        color: 'text.primary',
        width: '100%',
        '& .MuiTypography-root': {
          color: 'inherit !important',
        },
      }}
    >
      <Grid container spacing={4}>
        {/* Left Column */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetadataItem
              label="Composition"
              value={run.system?.composition || 'N/A'}
            />
            <MetadataItem
              label="Method name"
              value={run.simulation_method
                ? (run.simulation_method === 'H_ADRESS' ? 'H-AdResS' : run.simulation_method)
                : 'N/A'
              }
            />
            <MetadataItem
              label="Engine version"
              value={run.engine?.version || 'N/A'}
            />
            <MetadataItem
              label="Ensemble"
              value={run.ensemble || 'N/A'}
            />
            <MetadataItem
              label="Atom style"
              value={run.atom_style || 'N/A'}
            />
            <MetadataItem
              label="Entry type"
              value="MD Simulation"
            />
          </Box>
        </Grid>

        {/* Middle Column */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetadataItem
              label="Number of atoms"
              value={run.system?.n_atoms?.toLocaleString() || 'N/A'}
            />
            <MetadataItem
              label="Temperature"
              value={run.temperature_target ? `${run.temperature_target.toFixed(1)} K` : 'N/A'}
            />
            <MetadataItem
              label="Pressure"
              value={run.pressure_target ? `${run.pressure_target.toFixed(2)} bar` : 'N/A'}
            />
            <MetadataItem
              label="Timestep"
              value={run.timestep ? `${run.timestep} fs` : 'N/A'}
            />
            <MetadataItem
              label="N steps"
              value={run.n_steps?.toLocaleString() || 'N/A'}
            />
            <MetadataItem
              label="Duration"
              value={formatTime(run.total_time)}
            />
            {run.simulation_method === 'H_ADRESS' &&
             run.particle_insertion !== null &&
             run.particle_insertion !== undefined && (
              <MetadataItem
                label="Particle insertion"
                value={run.particle_insertion ? 'Yes' : 'No'}
              />
            )}
          </Box>
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <MetadataItem
              label="Entry ID"
              value={run.id.toString()}
            />
            <MetadataItem
              label="Engine"
              value={run.engine?.name || 'N/A'}
            />
            <MetadataItem
              label="Upload date"
              value={formatDate(run.created_at)}
            />
            <MetadataItem
              label="Run name"
              value={run.run_name}
            />

            {/* Data Quality Indicators */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.8rem' }}>
                Available data
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {run.data_quality_flags?.has_trajectory && (
                  <Chip
                    size="small"
                    icon={<CheckCircle sx={{ fontSize: '1rem' }} />}
                    label="Trajectory"
                    color="success"
                    sx={{ height: '22px', fontSize: '0.75rem' }}
                  />
                )}
                {run.data_quality_flags?.has_topology && (
                  <Chip
                    size="small"
                    icon={<CheckCircle sx={{ fontSize: '1rem' }} />}
                    label="Topology"
                    color="success"
                    sx={{ height: '22px', fontSize: '0.75rem' }}
                  />
                )}
                {run.data_quality_flags?.has_log_file && (
                  <Chip
                    size="small"
                    icon={<CheckCircle sx={{ fontSize: '1rem' }} />}
                    label="Log"
                    color="success"
                    sx={{ height: '22px', fontSize: '0.75rem' }}
                  />
                )}
                {run.data_quality_flags?.has_input_script && (
                  <Chip
                    size="small"
                    icon={<CheckCircle sx={{ fontSize: '1rem' }} />}
                    label="Input"
                    color="success"
                    sx={{ height: '22px', fontSize: '0.75rem' }}
                  />
                )}
              </Box>
            </Box>

            {/* Completeness */}
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem', mb: 0.25, display: 'block' }}>
                Completeness: {run.completeness_score?.toFixed(0) || 0}%
              </Typography>
              <LinearProgress
                variant="determinate"
                value={run.completeness_score || 0}
                color={
                  (run.completeness_score || 0) >= 80
                    ? 'success'
                    : (run.completeness_score || 0) >= 50
                    ? 'warning'
                    : 'error'
                }
                sx={{ height: 4, borderRadius: 1 }}
              />
            </Box>
          </Box>
        </Grid>
      </Grid>

      {/* Bottom Link - NOMAD Style */}
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Link
          component="button"
          onClick={() => navigate(`/runs/${run.id}`)}
          sx={{
            fontSize: '0.85rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'primary.main',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          }}
        >
          Go to the entry page
          <OpenInNew sx={{ fontSize: '1rem' }} />
        </Link>
      </Box>
    </Box>
  );
};

// Helper component for metadata items - NOMAD style
const MetadataItem: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
    <Typography
      variant="caption"
      sx={{
        color: 'text.secondary !important',
        fontSize: '0.85rem',
        fontWeight: 500,
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="body2"
      sx={{
        color: 'text.primary !important',
        fontSize: '0.95rem',
        wordBreak: 'break-word',
      }}
    >
      {value}
    </Typography>
  </Box>
);
