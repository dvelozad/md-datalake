import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';

interface CompletenessIndicatorProps {
  score: number | null | undefined;
  variant?: 'compact' | 'expanded';
  showLabel?: boolean;
  missingDataCount?: number;
  warningCount?: number;
}

export const CompletenessIndicator: React.FC<CompletenessIndicatorProps> = ({
  score,
  variant = 'compact',
  showLabel = true,
  missingDataCount = 0,
  warningCount = 0,
}) => {
  // Handle null/undefined scores
  if (score === null || score === undefined) {
    return (
      <Chip
        size="small"
        label="N/A"
        sx={{ bgcolor: 'grey.300', color: 'grey.700', fontWeight: 500 }}
      />
    );
  }

  // Determine color and icon based on score
  const getColorAndIcon = () => {
    if (score >= 90) {
      return {
        color: 'success.main',
        bgcolor: 'success.light',
        icon: <CheckCircleIcon sx={{ fontSize: 16 }} />,
        label: 'Complete',
      };
    } else if (score >= 60) {
      return {
        color: 'warning.dark',
        bgcolor: 'warning.light',
        icon: <WarningIcon sx={{ fontSize: 16 }} />,
        label: 'Partial',
      };
    } else {
      return {
        color: 'error.dark',
        bgcolor: 'error.light',
        icon: <ErrorIcon sx={{ fontSize: 16 }} />,
        label: 'Incomplete',
      };
    }
  };

  const { color, bgcolor, icon, label } = getColorAndIcon();

  if (variant === 'compact') {
    const chipLabel = showLabel ? `${score}%` : score.toString();
    const tooltipText = `Data Completeness: ${score}%${
      missingDataCount > 0 ? ` (${missingDataCount} missing)` : ''
    }${warningCount > 0 ? ` (${warningCount} warnings)` : ''}`;

    return (
      <Tooltip title={tooltipText} arrow>
        <Chip
          icon={icon}
          label={chipLabel}
          size="small"
          sx={{
            bgcolor,
            color,
            fontWeight: 600,
            '& .MuiChip-icon': { color },
          }}
        />
      </Tooltip>
    );
  }

  // Expanded variant (for detail views)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {icon}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: color }}>
          {label} ({score}%)
        </div>
        {(missingDataCount > 0 || warningCount > 0) && (
          <div style={{ fontSize: '0.875rem', color: 'text.secondary' }}>
            {missingDataCount > 0 && `${missingDataCount} missing`}
            {missingDataCount > 0 && warningCount > 0 && ' • '}
            {warningCount > 0 && `${warningCount} warnings`}
          </div>
        )}
      </div>
    </div>
  );
};
