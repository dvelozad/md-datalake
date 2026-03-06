import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import type { SimulationRun } from '@/types/visualization';

interface RunTableSimpleProps {
  runs: SimulationRun[];
  isLoading: boolean;
}

export const RunTableSimple: React.FC<RunTableSimpleProps> = ({ runs, isLoading }) => {
  const columns: MRT_ColumnDef<SimulationRun>[] = [
    {
      accessorKey: 'run_name',
      header: 'Name',
    },
    {
      accessorKey: 'ensemble',
      header: 'Ensemble',
    },
    {
      accessorKey: 'system.n_atoms',
      header: 'Atoms',
    },
  ];

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Simple Table Test
      </Typography>
      <MaterialReactTable
        columns={columns}
        data={runs}
        state={{ isLoading }}
        enablePagination={false}
        enableTopToolbar={false}
        enableBottomToolbar={false}
      />
    </Paper>
  );
};
