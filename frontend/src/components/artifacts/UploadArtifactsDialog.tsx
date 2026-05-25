import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';

interface UploadArtifactsDialogProps {
  open: boolean;
  runId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadArtifactsDialog: React.FC<UploadArtifactsDialogProps> = ({
  open,
  runId,
  onClose,
}) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload artifacts</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          Upload additional artifacts for run #{runId}. This feature is under development.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
