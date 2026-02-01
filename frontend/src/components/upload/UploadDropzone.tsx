import React, { useRef } from 'react';
import { Paper, Typography } from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

interface UploadDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({ onFilesSelected, disabled }) => {
  const [isDragging, setIsDragging] = React.useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
    }
  };

  return (
    <Paper
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      sx={{
        border: '2px dashed',
        borderColor: isDragging ? 'primary.main' : 'divider',
        backgroundColor: isDragging ? 'action.hover' : 'background.paper',
        p: 4,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.2s ease-in-out',
        '&:hover': !disabled ? {
          borderColor: 'primary.main',
          backgroundColor: 'action.hover',
        } : {},
      }}
    >
      <CloudUpload fontSize="large" color={isDragging ? 'primary' : 'action'} sx={{ mb: 2 }} />
      <Typography variant="h6" gutterBottom>
        {isDragging ? 'Drop files here' : 'Upload Simulation Files'}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Drag and drop files or click to browse
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Supported: LAMMPS (.dump, .lammpstrj, .dcd, .data, in.*, log.*) and GROMACS (.xtc, .trr, .gro, .top, .pdb, .mdp)
      </Typography>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={handleFileInputChange}
        disabled={disabled}
      />
    </Paper>
  );
};
