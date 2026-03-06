import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Alert,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Lightbulb as LightbulbIcon,
} from '@mui/icons-material';
import type { CompletenessInfo } from '@/types/visualization';

interface CompletenessCardProps {
  completeness: CompletenessInfo;
}

export const CompletenessCard: React.FC<CompletenessCardProps> = ({ completeness }) => {
  const [expandedMissing, setExpandedMissing] = useState(false);
  const [expandedWarnings, setExpandedWarnings] = useState(false);

  const score = completeness.completeness_score ?? 0;
  const flags = completeness.data_quality_flags;

  // Determine progress bar color
  const getProgressColor = () => {
    if (score >= 90) return 'success';
    if (score >= 60) return 'warning';
    return 'error';
  };

  // Data availability items
  const dataItems = [
    { key: 'has_trajectory', label: 'Trajectory', available: flags.has_trajectory },
    { key: 'has_topology', label: 'Topology', available: flags.has_topology },
    { key: 'has_log_file', label: 'Log File', available: flags.has_log_file },
    { key: 'has_input_script', label: 'Input Script', available: flags.has_input_script },
    { key: 'has_molecule_ids', label: 'Molecule IDs', available: flags.has_molecule_ids },
    { key: 'has_bonds_angles', label: 'Bonds/Angles', available: flags.has_bonds_angles },
  ];

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Data Completeness
        </Typography>

        {/* Progress Bar */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Completeness Score
            </Typography>
            <Typography variant="body2" fontWeight={600}>
              {score}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={score}
            color={getProgressColor()}
            sx={{ height: 8, borderRadius: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Scenario: {flags.scenario_type}
          </Typography>
        </Box>

        {/* Data Availability Chips */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Data Availability
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {dataItems.map((item) => (
              <Chip
                key={item.key}
                icon={item.available ? <CheckCircleIcon /> : <CancelIcon />}
                label={item.label}
                size="small"
                color={item.available ? 'success' : 'default'}
                variant={item.available ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        </Box>

        {/* Missing Data Accordion */}
        {completeness.missing_data && completeness.missing_data.length > 0 && (
          <Accordion
            expanded={expandedMissing}
            onChange={() => setExpandedMissing(!expandedMissing)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CancelIcon color="error" fontSize="small" />
                <Typography variant="body2" fontWeight={500}>
                  Missing Data ({completeness.missing_data.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {completeness.missing_data.map((item, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <CancelIcon color="error" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={item.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Warnings Accordion */}
        {completeness.warnings && completeness.warnings.length > 0 && (
          <Accordion
            expanded={expandedWarnings}
            onChange={() => setExpandedWarnings(!expandedWarnings)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="warning" fontSize="small" />
                <Typography variant="body2" fontWeight={500}>
                  Warnings ({completeness.warnings.length})
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {completeness.warnings.map((warning, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <WarningIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary={warning} />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>
        )}

        {/* Recommendations */}
        {completeness.recommendations && completeness.recommendations.length > 0 && (
          <Alert
            severity="info"
            icon={<LightbulbIcon />}
            sx={{ mt: 2 }}
          >
            <Typography variant="subtitle2" gutterBottom>
              Recommendations
            </Typography>
            <List dense>
              {completeness.recommendations.map((rec, index) => (
                <ListItem key={index} sx={{ py: 0.5 }}>
                  <ListItemText
                    primary={rec}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItem>
              ))}
            </List>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
