import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Paper,
  Stack,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipPrevious,
  SkipNext,
  FirstPage,
  LastPage,
} from '@mui/icons-material';
import type { MDservClient } from '@/services/mdserv';

interface FrameControlsProps {
  mdservClient: MDservClient | null;
  frameCount: number;
  currentFrame: number;
  onFrameChange: (frame: number) => void;
  fps?: number;
}

export const FrameControls: React.FC<FrameControlsProps> = ({
  mdservClient,
  frameCount,
  currentFrame,
  onFrameChange,
  fps = 30,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleFirstFrame = () => {
    onFrameChange(0);
    setIsPlaying(false);
  };

  const handlePreviousFrame = () => {
    onFrameChange(Math.max(0, currentFrame - 1));
    setIsPlaying(false);
  };

  const handleNextFrame = () => {
    onFrameChange(Math.min(frameCount - 1, currentFrame + 1));
    setIsPlaying(false);
  };

  const handleLastFrame = () => {
    onFrameChange(frameCount - 1);
    setIsPlaying(false);
  };

  const handleSliderChange = (_event: Event, value: number | number[]) => {
    const frame = Array.isArray(value) ? value[0] : value;
    onFrameChange(frame);
    setIsPlaying(false);
  };

  const handleSpeedChange = (
    _event: React.MouseEvent<HTMLElement>,
    newSpeed: number | null
  ) => {
    if (newSpeed !== null) {
      setPlaybackSpeed(newSpeed);
    }
  };

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !mdservClient) return;

    const interval = setInterval(() => {
      const nextFrame = currentFrame + 1;

      if (nextFrame >= frameCount) {
        setIsPlaying(false);
        return;
      }

      mdservClient.requestFrame(nextFrame);
      onFrameChange(nextFrame);
    }, (1000 / fps) / playbackSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, currentFrame, frameCount, mdservClient, onFrameChange, fps, playbackSpeed]);

  const formatTime = useCallback((frame: number) => {
    // Assuming 1 frame = 1 ps for now (should come from metadata)
    const timePs = frame;
    if (timePs < 1000) {
      return `${timePs.toFixed(1)} ps`;
    } else {
      return `${(timePs / 1000).toFixed(2)} ns`;
    }
  }, []);

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="caption" gutterBottom>
            Timeline
          </Typography>
          <Slider
            value={currentFrame}
            min={0}
            max={Math.max(0, frameCount - 1)}
            onChange={handleSliderChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(value) => `Frame ${value}`}
            sx={{ mt: 1 }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              {formatTime(0)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(currentFrame)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatTime(frameCount - 1)}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handleFirstFrame} size="small" disabled={currentFrame === 0}>
            <FirstPage />
          </IconButton>

          <IconButton onClick={handlePreviousFrame} size="small" disabled={currentFrame === 0}>
            <SkipPrevious />
          </IconButton>

          <IconButton onClick={handlePlayPause} color="primary" size="large">
            {isPlaying ? <Pause /> : <PlayArrow />}
          </IconButton>

          <IconButton
            onClick={handleNextFrame}
            size="small"
            disabled={currentFrame >= frameCount - 1}
          >
            <SkipNext />
          </IconButton>

          <IconButton
            onClick={handleLastFrame}
            size="small"
            disabled={currentFrame >= frameCount - 1}
          >
            <LastPage />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption">Speed:</Typography>
          <ToggleButtonGroup
            value={playbackSpeed}
            exclusive
            onChange={handleSpeedChange}
            size="small"
          >
            <ToggleButton value={0.5}>0.5×</ToggleButton>
            <ToggleButton value={1}>1×</ToggleButton>
            <ToggleButton value={2}>2×</ToggleButton>
            <ToggleButton value={4}>4×</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>
    </Paper>
  );
};
