import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Button,
  Stack,
  SelectChangeEvent,
  useTheme,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import Plot from 'react-plotly.js';
import { apiClient } from '@/services/api';

interface ObservablePlotsProps {
  runId: number;
}

export const ObservablePlots: React.FC<ObservablePlotsProps> = ({ runId }) => {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [availableColumns, setAvailableColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [plotData, setPlotData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingPlot, setLoadingPlot] = useState(false);
  const [error, setError] = useState<string>('');
  const [engine, setEngine] = useState<string>('');

  // Load available observables
  useEffect(() => {
    const loadAvailableObservables = async () => {
      setLoading(true);
      setError('');

      try {
        const data = await apiClient.getAvailableObservables(runId);

        if (!data.available) {
          setError(data.message || 'No observables available for this run');
          setLoading(false);
          return;
        }

        setAvailableColumns(data.columns);
        setEngine(data.engine || '');

        // Auto-select common observables if they exist
        const defaultColumns = ['Temp', 'Press', 'TotEng', 'Volume'].filter((col) =>
          data.columns.includes(col)
        );
        if (defaultColumns.length > 0) {
          setSelectedColumns(defaultColumns);
        } else if (data.columns.length > 0) {
          // Select first few columns (excluding Step)
          const cols = data.columns.filter((c) => c !== 'Step').slice(0, 4);
          setSelectedColumns(cols);
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to load observables');
      } finally {
        setLoading(false);
      }
    };

    loadAvailableObservables();
  }, [runId]);

  // Load plot data when selected columns change
  useEffect(() => {
    if (selectedColumns.length === 0) {
      setPlotData(null);
      return;
    }

    const loadPlotData = async () => {
      setLoadingPlot(true);
      setError('');

      try {
        // Always include 'Step' for x-axis
        const columnsToFetch = ['Step', ...selectedColumns.filter((c) => c !== 'Step')];
        const data = await apiClient.getPlotData(runId, columnsToFetch);
        setPlotData(data);
      } catch (err: any) {
        setError(err.response?.data?.detail || err.message || 'Failed to load plot data');
        setPlotData(null);
      } finally {
        setLoadingPlot(false);
      }
    };

    loadPlotData();
  }, [runId, selectedColumns]);

  const handleColumnChange = (event: SelectChangeEvent<typeof selectedColumns>) => {
    const value = event.target.value;
    setSelectedColumns(typeof value === 'string' ? value.split(',') : value);
  };

  const handleRefresh = () => {
    // Trigger reload by changing state
    setSelectedColumns([...selectedColumns]);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && availableColumns.length === 0) {
    return <Alert severity="warning">{error}</Alert>;
  }

  return (
    <Stack spacing={2}>
      {/* Controls */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControl sx={{ flex: 1, minWidth: 200 }}>
            <InputLabel>Select Observables</InputLabel>
            <Select
              multiple
              value={selectedColumns}
              onChange={handleColumnChange}
              renderValue={(selected) => (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {selected.map((value) => (
                    <Chip key={value} label={value} size="small" />
                  ))}
                </Box>
              )}
            >
              {availableColumns
                .filter((col) => col !== 'Step')
                .map((column) => (
                  <MenuItem key={column} value={column}>
                    {column}
                    {plotData?.units?.[column] && ` (${plotData.units[column]})`}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          <Button startIcon={<RefreshIcon />} onClick={handleRefresh} variant="outlined">
            Refresh
          </Button>
        </Stack>

        {engine && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Engine: {engine} • {plotData?.n_points || 0} data points
          </Typography>
        )}
      </Paper>

      {/* Error Display */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Loading */}
      {loadingPlot && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Loading plot data...</Typography>
        </Box>
      )}

      {/* Plots */}
      {!loadingPlot && plotData && selectedColumns.length > 0 && (
        <Stack spacing={2}>
          {selectedColumns.map((column) => {
            if (!plotData.data[column] || !plotData.data.Step) {
              return null;
            }

            const xData = plotData.data.Step;
            const yData = plotData.data[column];

            // Calculate average
            const average = yData.reduce((sum, val) => sum + val, 0) / yData.length;

            return (
              <Paper key={column} sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  {column}
                  {plotData.units[column] && ` (${plotData.units[column]})`}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Average: {average.toFixed(3)} {plotData.units[column]}
                </Typography>
                <Plot
                  data={[
                    {
                      x: xData,
                      y: yData,
                      type: 'scatter',
                      mode: 'lines',
                      name: column,
                      line: {
                        width: 2,
                        color: isDarkMode ? '#90caf9' : '#1976d2'
                      },
                    },
                    {
                      x: [xData[0], xData[xData.length - 1]],
                      y: [average, average],
                      type: 'scatter',
                      mode: 'lines',
                      name: 'Average',
                      line: {
                        width: 2,
                        color: isDarkMode ? '#f48fb1' : '#d32f2f',
                        dash: 'dash',
                      },
                    },
                  ]}
                  layout={{
                    autosize: true,
                    height: 400,
                    margin: { l: 60, r: 30, t: 30, b: 60 },
                    paper_bgcolor: isDarkMode ? '#1e1e1e' : '#ffffff',
                    plot_bgcolor: isDarkMode ? '#1e1e1e' : '#ffffff',
                    font: {
                      color: isDarkMode ? '#ffffff' : '#000000',
                    },
                    xaxis: {
                      title: 'Step',
                      showgrid: true,
                      zeroline: false,
                      gridcolor: isDarkMode ? '#404040' : '#e0e0e0',
                      color: isDarkMode ? '#ffffff' : '#000000',
                    },
                    yaxis: {
                      title: plotData.units[column]
                        ? `${column} (${plotData.units[column]})`
                        : column,
                      showgrid: true,
                      zeroline: false,
                      gridcolor: isDarkMode ? '#404040' : '#e0e0e0',
                      color: isDarkMode ? '#ffffff' : '#000000',
                    },
                    hovermode: 'closest',
                    showlegend: true,
                    legend: {
                      x: 1,
                      xanchor: 'right',
                      y: 1,
                      yanchor: 'top',
                      bgcolor: isDarkMode ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)',
                      font: {
                        color: isDarkMode ? '#ffffff' : '#000000',
                      },
                    },
                  }}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
                  }}
                  style={{ width: '100%' }}
                />
              </Paper>
            );
          })}
        </Stack>
      )}

      {/* No selection */}
      {!loadingPlot && selectedColumns.length === 0 && (
        <Alert severity="info">
          Select observables from the dropdown above to display plots
        </Alert>
      )}
    </Stack>
  );
};
