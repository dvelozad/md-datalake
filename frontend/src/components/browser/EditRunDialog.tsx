import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Alert,
} from '@mui/material';
import type { SimulationRun } from '@/types/visualization';

interface EditRunDialogProps {
  open: boolean;
  run: SimulationRun | null;
  onClose: () => void;
  onSave: (data: { run_name: string; description?: string }) => Promise<void>;
}

export const EditRunDialog: React.FC<EditRunDialogProps> = ({ open, run, onClose, onSave }) => {
  const [runName, setRunName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (run) {
      setRunName(run.run_name || '');
      setDescription(run.description || '');
    }
  }, [run]);

  const handleSave = async () => {
    if (!runName.trim()) {
      setError('Run name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await onSave({
        run_name: runName,
        description: description || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Failed to update run');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setError('');
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Simulation Run</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          <TextField
            label="Run Name"
            required
            fullWidth
            value={runName}
            onChange={(e) => setRunName(e.target.value)}
            disabled={saving}
            helperText="Name of this simulation run"
          />
          <TextField
            label="Description"
            multiline
            rows={4}
            fullWidth
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
            helperText="Optional description of the simulation"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
