import React, { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { Paper, Typography, Box } from '@mui/material';
import type { Observable } from '@/types/visualization';

interface PropertyPlotProps {
  observables: Observable[];
  currentFrame: number;
  onFrameClick?: (frameIndex: number) => void;
  height?: number;
}

export const PropertyPlot: React.FC<PropertyPlotProps> = ({
  observables,
  currentFrame,
  onFrameClick,
  height = 300,
}) => {
  const plotData = useMemo(() => {
    const traces = observables.map((obs) => ({
      x: obs.time_series,
      y: obs.values,
      type: 'scatter' as const,
      mode: 'lines' as const,
      name: `${obs.observable_type} (${obs.units})`,
      line: {
        width: 2,
      },
    }));

    return traces;
  }, [observables]);

  const currentTimeMarker = useMemo(() => {
    if (observables.length === 0 || currentFrame === undefined) return null;

    const currentTime = observables[0]?.time_series[currentFrame];
    if (currentTime === undefined) return null;

    return {
      type: 'line' as const,
      x0: currentTime,
      x1: currentTime,
      y0: 0,
      y1: 1,
      yref: 'paper' as const,
      line: {
        color: 'red',
        width: 2,
        dash: 'dash' as const,
      },
    };
  }, [observables, currentFrame]);

  const layout = useMemo(() => {
    const baseLayout: any = {
      height,
      margin: { l: 60, r: 20, t: 40, b: 50 },
      xaxis: {
        title: 'Time',
        showgrid: true,
        zeroline: false,
      },
      yaxis: {
        title: 'Value',
        showgrid: true,
        zeroline: false,
      },
      hovermode: 'closest' as const,
      showlegend: true,
      legend: {
        x: 1.02,
        y: 1,
        xanchor: 'left' as const,
      },
    };

    if (currentTimeMarker) {
      baseLayout.shapes = [currentTimeMarker];
    }

    return baseLayout;
  }, [height, currentTimeMarker]);

  const handleClick = (event: any) => {
    if (!onFrameClick || !event.points || event.points.length === 0) return;

    const clickedTime = event.points[0].x;

    // Find closest frame index
    if (observables.length > 0) {
      const timeSeries = observables[0].time_series;
      const closestIndex = timeSeries.reduce(
        (closest, time, index) => {
          const diff = Math.abs(time - clickedTime);
          return diff < closest.diff ? { index, diff } : closest;
        },
        { index: 0, diff: Infinity }
      );

      onFrameClick(closestIndex.index);
    }
  };

  if (observables.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 2, height }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No observable data available
          </Typography>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={2}>
      <Plot
        data={plotData}
        layout={layout}
        config={{
          responsive: true,
          displayModeBar: true,
          displaylogo: false,
          modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        }}
        onClick={handleClick}
        style={{ width: '100%' }}
      />
    </Paper>
  );
};
