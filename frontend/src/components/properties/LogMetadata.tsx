import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
} from '@mui/material';
import { Refresh as RefreshIcon, CheckCircle as CheckIcon } from '@mui/icons-material';
import { apiClient } from '@/services/api';

interface LogMetadataProps {
  runId: number;
  onUpdate?: () => void;
}

export const LogMetadata: React.FC<LogMetadataProps> = ({ runId, onUpdate }) => {
  const [metadata, setMetadata] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string>('');
  const [updateSuccess, setUpdateSuccess] = useState(false);

  const loadMetadata = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiClient.getLogMetadata(runId);
      setMetadata(data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('No log file available for this run');
      } else {
        setError(err.response?.data?.detail || err.message || 'Failed to load metadata');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, [runId]);

  const handleUpdate = async () => {
    setUpdating(true);
    setError('');
    setUpdateSuccess(false);

    try {
      await apiClient.updateRunFromLog(runId);
      setUpdateSuccess(true);

      // Reload metadata to show updated values
      await loadMetadata();

      // Notify parent to refresh run data
      if (onUpdate) {
        onUpdate();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to update run metadata');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={20} />
          <Typography variant="body2">Loading log metadata...</Typography>
        </Box>
      </Paper>
    );
  }

  if (error && !metadata) {
    return null; // Don't show anything if no log file
  }

  if (!metadata?.can_update_run) {
    return null; // Don't show for non-LAMMPS runs
  }

  const meta = metadata.extracted_metadata;

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Log File Metadata</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadMetadata}
            size="small"
            disabled={updating}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            onClick={handleUpdate}
            size="small"
            disabled={updating}
          >
            {updating ? 'Updating...' : 'Update Run Metadata'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {updateSuccess && (
        <Alert severity="success" icon={<CheckIcon />} sx={{ mb: 2 }}>
          Run metadata successfully updated from log file!
        </Alert>
      )}

      <Table size="small">
        <TableBody>
          {meta.units && (
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>Units Style</strong>
              </TableCell>
              <TableCell>
                <Chip label={meta.units} size="small" color="primary" />
              </TableCell>
            </TableRow>
          )}
          {meta.timestep !== null && (
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>Timestep</strong>
              </TableCell>
              <TableCell>
                {meta.timestep} {meta.units === 'real' ? 'fs' : meta.units === 'metal' ? 'ps' : 'time units'}
              </TableCell>
            </TableRow>
          )}
          {meta.first_step !== null && (
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>First Step</strong>
              </TableCell>
              <TableCell>{meta.first_step.toLocaleString()}</TableCell>
            </TableRow>
          )}
          {meta.last_step !== null && (
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>Last Step</strong>
              </TableCell>
              <TableCell>{meta.last_step.toLocaleString()}</TableCell>
            </TableRow>
          )}
          {meta.n_steps !== null && (
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>Total Steps</strong>
              </TableCell>
              <TableCell>{meta.n_steps.toLocaleString()}</TableCell>
            </TableRow>
          )}
          {meta.simulation_time !== null && (
            <TableRow>
              <TableCell component="th" scope="row">
                <strong>Simulation Time</strong>
              </TableCell>
              <TableCell>
                {meta.units === 'real'
                  ? `${(meta.simulation_time * 1e-6).toFixed(3)} ns`
                  : meta.units === 'metal'
                  ? `${(meta.simulation_time * 1e-3).toFixed(3)} ns`
                  : `${meta.simulation_time} time units`}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
        Click "Update Run Metadata" to apply these values to the simulation run record
      </Typography>
    </Paper>
  );
};
