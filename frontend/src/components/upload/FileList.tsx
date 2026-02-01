import React from 'react';
import { List, ListItem, ListItemText, IconButton, Chip, Box, Typography } from '@mui/material';
import { Delete, InsertDriveFile } from '@mui/icons-material';

interface FileListProps {
  files: File[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

const getFileType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || '';

  // Trajectory files
  if (['dump', 'lammpstrj', 'dcd', 'xtc', 'trr'].includes(ext)) {
    return 'Trajectory';
  }

  // Topology files
  if (['data', 'gro', 'pdb', 'top', 'psf'].includes(ext)) {
    return 'Topology';
  }

  // Input scripts
  if (['in', 'lammps', 'mdp'].includes(ext) || filename.startsWith('in.')) {
    return 'Input';
  }

  // Log files
  if (['log', 'out', 'txt'].includes(ext) || filename.startsWith('log.')) {
    return 'Log';
  }

  // Other
  if (['tpr', 'edr'].includes(ext)) {
    return 'Data';
  }

  return 'Other';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const FileList: React.FC<FileListProps> = ({ files, onRemove, disabled }) => {
  if (files.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No files selected yet
        </Typography>
      </Box>
    );
  }

  return (
    <List>
      {files.map((file, index) => (
        <ListItem
          key={index}
          secondaryAction={
            <IconButton
              edge="end"
              onClick={() => onRemove(index)}
              disabled={disabled}
            >
              <Delete />
            </IconButton>
          }
        >
          <InsertDriveFile sx={{ mr: 2, color: 'text.secondary' }} />
          <ListItemText
            primary={file.name}
            secondary={formatFileSize(file.size)}
          />
          <Chip
            label={getFileType(file.name)}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ ml: 1 }}
          />
        </ListItem>
      ))}
    </List>
  );
};
