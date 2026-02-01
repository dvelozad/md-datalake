import React from 'react';
import { TextField, Stack } from '@mui/material';
import type { UploadMetadata } from '@/types/visualization';

interface UploadMetadataFormProps {
  metadata: UploadMetadata;
  onChange: (metadata: UploadMetadata) => void;
  disabled?: boolean;
}

export const UploadMetadataForm: React.FC<UploadMetadataFormProps> = ({
  metadata,
  onChange,
  disabled,
}) => {
  return (
    <Stack spacing={2}>
      <TextField
        label="Project Name"
        required
        fullWidth
        value={metadata.projectName}
        onChange={(e) => onChange({ ...metadata, projectName: e.target.value })}
        disabled={disabled}
        helperText="Name of the project this simulation belongs to"
      />
      <TextField
        label="Run Name"
        required
        fullWidth
        value={metadata.runName}
        onChange={(e) => onChange({ ...metadata, runName: e.target.value })}
        disabled={disabled}
        helperText="Unique name for this simulation run"
      />
      <TextField
        label="Description"
        multiline
        rows={3}
        fullWidth
        value={metadata.description || ''}
        onChange={(e) => onChange({ ...metadata, description: e.target.value })}
        disabled={disabled}
        helperText="Optional description of the simulation"
      />
    </Stack>
  );
};
