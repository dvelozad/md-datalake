import React from 'react';
import { LinearProgress, Typography, Box } from '@mui/material';

interface UploadProgressProps {
  progress: number;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ progress }) => {
  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Box sx={{ width: '100%', mr: 1 }}>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
        <Box sx={{ minWidth: 35 }}>
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}%
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary">
        {progress < 100 ? 'Uploading files...' : 'Processing and ingesting data...'}
      </Typography>
    </Box>
  );
};
