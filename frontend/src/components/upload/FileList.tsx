import React from 'react';
import {
  List,
  ListItem,
  ListItemText,
  IconButton,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  SelectChangeEvent,
  Chip,
} from '@mui/material';
import { Delete, InsertDriveFile } from '@mui/icons-material';

interface FileListProps {
  files: File[];
  artifactTypes: Record<string, string>; // filename -> artifact type
  onRemove: (index: number) => void;
  onArtifactTypeChange: (filename: string, artifactType: string) => void;
  disabled?: boolean;
}

const getFileType = (filename: string): string => {
  const ext = filename.toLowerCase().split('.').pop() || '';

  // Trajectory files
  if (['dump', 'lammpstrj', 'dcd', 'xtc', 'trr'].includes(ext)) {
    return 'trajectory';
  }

  // Topology files
  if (['data', 'lmp', 'gro', 'pdb', 'top', 'psf'].includes(ext)) {
    return 'topology';
  }

  // Input scripts
  if (['in', 'lammps', 'mdp'].includes(ext) || filename.startsWith('in.')) {
    return 'input';
  }

  // Log files
  if (['log', 'out', 'txt'].includes(ext) || filename.startsWith('log.')) {
    return 'log';
  }

  // Energy files
  if (['tpr', 'edr'].includes(ext)) {
    return 'energy';
  }

  // Atom type mapping files (stored as 'other' but displayed with special label)
  const name = filename.toLowerCase();
  if (name === 'atom_types.json' || name === 'atom_dict.json') {
    return 'other';  // Backend handles these specially, not stored as artifacts
  }

  return 'other';
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const isAtomMappingFile = (filename: string): boolean => {
  const name = filename.toLowerCase();
  return name === 'atom_types.json' || name === 'atom_dict.json';
};

export const FileList: React.FC<FileListProps> = ({
  files,
  artifactTypes,
  onRemove,
  onArtifactTypeChange,
  disabled
}) => {
  if (files.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No files selected yet
        </Typography>
      </Box>
    );
  }

  const handleArtifactTypeChange = (filename: string, event: SelectChangeEvent) => {
    onArtifactTypeChange(filename, event.target.value);
  };

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
            primary={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{file.name}</span>
                {isAtomMappingFile(file.name) && (
                  <Chip
                    label="Atom Dictionary"
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Box>
            }
            secondary={formatFileSize(file.size)}
          />
          <FormControl size="small" sx={{ ml: 1, minWidth: 120 }}>
            <Select
              value={artifactTypes[file.name] || getFileType(file.name).toLowerCase()}
              onChange={(e) => handleArtifactTypeChange(file.name, e)}
              disabled={disabled}
            >
              <MenuItem value="trajectory">Trajectory</MenuItem>
              <MenuItem value="topology">Topology</MenuItem>
              <MenuItem value="input">Input</MenuItem>
              <MenuItem value="log">Log</MenuItem>
              <MenuItem value="checkpoint">Checkpoint</MenuItem>
              <MenuItem value="energy">Energy</MenuItem>
              <MenuItem value="analysis">Analysis</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
        </ListItem>
      ))}
    </List>
  );
};
