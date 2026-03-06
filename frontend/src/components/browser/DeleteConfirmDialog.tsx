import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  Box,
} from '@mui/material';
import { Warning } from '@mui/icons-material';
import type { SimulationRun } from '@/types/visualization';

interface DeleteConfirmDialogProps {
  open: boolean;
  run: SimulationRun | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  run,
  onClose,
  onConfirm,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string>('');

  const handleConfirm = async () => {
    setDeleting(true);
    setError('');

    try {
      await onConfirm();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to delete run');
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    if (!deleting) {
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="error" />
          Delete Simulation Run
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 2 }}>
          This action cannot be undone!
        </Alert>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        <Typography variant="body1" gutterBottom>
          Are you sure you want to delete this simulation run?
        </Typography>
        {run && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Run:</strong> {run.run_name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>ID:</strong> {run.id}
            </Typography>
          </Box>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          This will permanently delete:
        </Typography>
        <Box component="ul" sx={{ mt: 1, pl: 2 }}>
          <Typography component="li" variant="body2" color="text.secondary">
            All trajectory and topology files
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            All observables (temperature, pressure, energy)
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            All visualization sessions
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            All metadata and analysis results
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button onClick={handleConfirm} color="error" variant="contained" disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete Permanently'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
