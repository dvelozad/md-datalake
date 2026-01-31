import React from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Chip,
  CardActionArea,
} from '@mui/material';
import type { SimulationRun } from '@/types/visualization';

interface RunCardProps {
  run: SimulationRun;
  onClick: (runId: number) => void;
  thumbnailUrl?: string;
}

export const RunCard: React.FC<RunCardProps> = ({ run, onClick, thumbnailUrl }) => {
  const formatTime = (ns: number) => {
    if (ns < 1) {
      return `${(ns * 1000).toFixed(0)} ps`;
    } else if (ns < 1000) {
      return `${ns.toFixed(1)} ns`;
    } else {
      return `${(ns / 1000).toFixed(2)} μs`;
    }
  };

  const defaultThumbnail = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='200'%3E%3Crect fill='%23f5f5f5' width='300' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='monospace' font-size='14' fill='%23999'%3ENo Preview%3C/text%3E%3C/svg%3E`;

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea onClick={() => onClick(run.id)} sx={{ flexGrow: 1 }}>
        <CardMedia
          component="img"
          height="140"
          image={thumbnailUrl || defaultThumbnail}
          alt={run.run_name}
          sx={{ objectFit: 'cover', bgcolor: 'grey.100' }}
        />
        <CardContent sx={{ flexGrow: 1 }}>
          <Typography
            gutterBottom
            variant="h6"
            component="div"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {run.run_name}
          </Typography>

          <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
            <Chip label={run.ensemble} size="small" color="primary" />
            <Chip label={run.engine.name} size="small" variant="outlined" />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {run.temperature_target && (
              <Typography variant="body2" color="text.secondary">
                T: {run.temperature_target} K
              </Typography>
            )}

            {run.pressure_target && (
              <Typography variant="body2" color="text.secondary">
                P: {run.pressure_target} bar
              </Typography>
            )}

            <Typography variant="body2" color="text.secondary">
              {run.system.n_atoms.toLocaleString()} atoms
            </Typography>

            <Typography variant="body2" color="text.secondary">
              {formatTime(run.total_time)}
            </Typography>
          </Box>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mt: 1,
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {run.system.composition}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
};
