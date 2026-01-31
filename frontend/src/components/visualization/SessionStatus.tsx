import React from 'react';
import { Box, Paper, Typography, Chip, Button, Alert, LinearProgress } from '@mui/material';
import { WifiOff, Wifi, Error as ErrorIcon, Timer } from '@mui/icons-material';

interface SessionStatusProps {
  status: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  timeRemaining: number;
  onReconnect?: () => void;
}

export const SessionStatus: React.FC<SessionStatusProps> = ({
  status,
  timeRemaining,
  onReconnect,
}) => {
  const formatTimeRemaining = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'connected':
        return <Wifi />;
      case 'disconnected':
        return <WifiOff />;
      case 'error':
        return <ErrorIcon />;
      default:
        return <Timer />;
    }
  };

  const getStatusColor = ():
    | 'default'
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning' => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'disconnected':
        return 'warning';
      case 'error':
        return 'error';
      case 'connecting':
        return 'info';
      default:
        return 'default';
    }
  };

  const sessionProgress = timeRemaining > 0 ? (timeRemaining / (60 * 60 * 1000)) * 100 : 0;

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Chip
          icon={getStatusIcon()}
          label={status.charAt(0).toUpperCase() + status.slice(1)}
          color={getStatusColor()}
          size="small"
        />

        {status === 'connected' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
            <Timer fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {formatTimeRemaining(timeRemaining)}
            </Typography>
          </Box>
        )}
      </Box>

      {status === 'connected' && (
        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={sessionProgress}
            sx={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Session expires in {formatTimeRemaining(timeRemaining)}
          </Typography>
        </Box>
      )}

      {status === 'disconnected' && (
        <Alert severity="warning" sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2">Connection lost</Typography>
            {onReconnect && (
              <Button size="small" onClick={onReconnect} variant="outlined">
                Reconnect
              </Button>
            )}
          </Box>
        </Alert>
      )}

      {status === 'error' && (
        <Alert severity="error" sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="body2">Session error</Typography>
            {onReconnect && (
              <Button size="small" onClick={onReconnect} variant="outlined" color="error">
                Retry
              </Button>
            )}
          </Box>
        </Alert>
      )}

      {status === 'connecting' && (
        <Box sx={{ mt: 1 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Connecting to visualization server...
          </Typography>
        </Box>
      )}

      {timeRemaining === 0 && status === 'connected' && (
        <Alert severity="info" sx={{ mt: 1 }}>
          <Typography variant="body2">Session expired. Please refresh to create a new session.</Typography>
        </Alert>
      )}
    </Paper>
  );
};
