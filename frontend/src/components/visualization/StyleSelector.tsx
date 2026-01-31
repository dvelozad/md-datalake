import React from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Typography,
  Box,
} from '@mui/material';
import { REPRESENTATION_TYPES } from '@/types/visualization';

interface StyleSelectorProps {
  selectedStyle: string;
  onStyleChange: (style: string) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onStyleChange,
}) => {
  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="subtitle2" gutterBottom>
        Representation Style
      </Typography>
      <FormControl fullWidth size="small">
        <InputLabel>Style</InputLabel>
        <Select
          value={selectedStyle}
          label="Style"
          onChange={(e) => onStyleChange(e.target.value)}
        >
          {REPRESENTATION_TYPES.map((type) => (
            <MenuItem key={type.value} value={type.value}>
              <Box>
                <Typography variant="body2">{type.label}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {type.description}
                </Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Paper>
  );
};
