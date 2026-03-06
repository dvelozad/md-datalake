import React, { useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Chip, LinearProgress, IconButton, Tooltip } from '@mui/material';
import { ArrowForward } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { MaterialReactTable, type MRT_ColumnDef } from 'material-react-table';
import type { SimulationRun } from '@/types/visualization';
import { RunTableExpandedRow } from './RunTableExpandedRow';

interface RunTableProps {
  runs: SimulationRun[];
  isLoading: boolean;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRunSelect?: (runId: number) => void;
}

export const RunTable: React.FC<RunTableProps> = ({
  runs,
  isLoading,
  page,
  pageSize,
  totalRows,
  onPageChange,
  onPageSizeChange,
}) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const expandedRowRefs = useRef<Record<string, HTMLElement | null>>({});

  // Auto-scroll to expanded row
  useEffect(() => {
    const expandedKeys = Object.keys(expanded).filter((key) => expanded[key]);
    if (expandedKeys.length > 0) {
      const lastExpandedKey = expandedKeys[expandedKeys.length - 1];
      const rowElement = expandedRowRefs.current[lastExpandedKey];
      if (rowElement) {
        // Wait a bit for the expansion animation to start
        setTimeout(() => {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
  }, [expanded]);

  const columns = useMemo<MRT_ColumnDef<SimulationRun>[]>(
    () => [
      {
        accessorKey: 'run_name',
        header: 'Name',
        size: 250,
        filterVariant: 'text',
        Cell: ({ cell }) => (
          <Typography variant="body2" fontWeight={600}>
            {cell.getValue<string>()}
          </Typography>
        ),
      },
      {
        accessorFn: (row) => row.system?.composition || `${row.system?.n_atoms || 0} atoms`,
        id: 'composition',
        header: 'Composition',
        size: 200,
        filterVariant: 'text',
        Cell: ({ row }) => (
          <Typography variant="body2" color="text.secondary">
            {row.original.system?.composition || `${row.original.system?.n_atoms || 0} atoms`}
          </Typography>
        ),
      },
      {
        accessorKey: 'simulation_method',
        header: 'Type',
        size: 180,
        filterVariant: 'select',
        filterSelectOptions: [
          { text: 'All', value: '' },
          { text: 'ATOMISTIC', value: 'ATOMISTIC' },
          { text: 'H-AdResS', value: 'H_ADRESS' },
          { text: 'COARSE_GRAINED', value: 'COARSE_GRAINED' },
          { text: 'UNITED_ATOM', value: 'UNITED_ATOM' },
        ],
        Cell: ({ cell, row }) => {
          const method = cell.getValue<string>() || 'Unknown';
          const displayMethod = method === 'H_ADRESS' ? 'H-AdResS' : method;

          return (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <Chip
                label={displayMethod}
                size="small"
                variant="outlined"
                color="primary"
              />
              {method === 'H_ADRESS' &&
               row.original.particle_insertion !== null &&
               row.original.particle_insertion !== undefined && (
                <Chip
                  label={row.original.particle_insertion ? 'PI' : 'Non-PI'}
                  size="small"
                  color="warning"
                  variant="outlined"
                />
              )}
            </Box>
          );
        },
      },
      {
        accessorKey: 'created_at',
        header: 'Upload Date',
        size: 180,
        filterVariant: 'date-range',
        Cell: ({ cell }) => {
          const date = new Date(cell.getValue<string>());
          return (
            <Typography variant="body2" color="text.secondary">
              {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          );
        },
      },
      {
        accessorKey: 'completeness_score',
        header: 'Quality',
        size: 150,
        filterVariant: 'range-slider',
        muiFilterSliderProps: {
          marks: true,
          min: 0,
          max: 100,
          step: 10,
        },
        Cell: ({ cell }) => {
          const score = cell.getValue<number>() || 0;
          const color = score >= 80 ? 'success' : score >= 50 ? 'warning' : 'error';
          return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress
                variant="determinate"
                value={score}
                color={color}
                sx={{ flex: 1, height: 4, borderRadius: 1 }}
              />
              <Typography variant="body2" fontWeight={600} color={`${color}.main`}>
                {score.toFixed(0)}%
              </Typography>
            </Box>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 60,
        enableColumnActions: false,
        enableSorting: false,
        enableColumnFilter: false,
        Cell: ({ row }) => (
          <Tooltip title="View Full Details" placement="left">
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/runs/${row.original.id}`);
              }}
              sx={{
                color: 'primary.main',
                '&:hover': {
                  backgroundColor: 'rgba(46, 100, 235, 0.1)',
                  transform: 'translateX(4px)',
                },
                transition: 'all 0.2s ease',
              }}
            >
              <ArrowForward fontSize="small" />
            </IconButton>
          </Tooltip>
        ),
      },
    ],
    [navigate]
  );

  return (
    <MaterialReactTable
      columns={columns}
      data={runs}
      enableExpanding
      renderDetailPanel={({ row }) => (
        <div ref={(el) => { expandedRowRefs.current[row.id] = el; }}>
          <RunTableExpandedRow run={row.original} />
        </div>
      )}

      // Pagination
      manualPagination
      rowCount={totalRows}
      onPaginationChange={(updater) => {
        const newState = typeof updater === 'function'
          ? updater({ pageIndex: page, pageSize })
          : updater;
        onPageChange(newState.pageIndex);
        onPageSizeChange(newState.pageSize);
      }}
      state={{
        isLoading,
        pagination: { pageIndex: page, pageSize },
        expanded,
      }}
      onExpandedChange={setExpanded}

      // Styling
      muiTablePaperProps={{
        elevation: 2,
        sx: {
          borderRadius: 0.5,
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: 'none',
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'linear-gradient(180deg, rgba(30,30,30,1) 0%, rgba(20,20,20,1) 100%)'
              : 'linear-gradient(180deg, #ffffff 0%, #fafbfc 100%)',
          // Hide all scrollbars within the table
          '& *': {
            scrollbarWidth: 'none !important',
            msOverflowStyle: 'none !important',
            '&::-webkit-scrollbar': {
              display: 'none !important',
              width: '0 !important',
              height: '0 !important',
            },
          },
          // Specifically target table cells
          '& td, & th': {
            overflow: 'hidden !important',
            scrollbarWidth: 'none !important',
            msOverflowStyle: 'none !important',
            '&::-webkit-scrollbar': {
              display: 'none !important',
            },
          },
        },
      }}
      muiTableContainerProps={{
        sx: {
          flex: 1,
          width: '100%',
          overflow: 'auto',
          // Custom scrollbar styling
          scrollbarWidth: 'thin',
          scrollbarColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1)'
              : 'rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0.1)',
          '&::-webkit-scrollbar': {
            width: '10px',
            height: '10px',
          },
          '&::-webkit-scrollbar-track': {
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.05)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(255, 255, 255, 0.3)'
                : 'rgba(0, 0, 0, 0.3)',
            borderRadius: '2px',
            '&:hover': {
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.5)'
                  : 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      }}
      muiTableProps={{
        sx: {
          width: '100%',
          tableLayout: 'fixed', // Fixed layout for grid mode
        },
      }}
      muiTableHeadCellProps={{
        sx: {
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? '#2a2a2a'
              : '#f0f2f5',
          borderBottom: '2px solid',
          borderColor: 'primary.main',
          fontSize: '0.75rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.8px',
          color: 'text.primary',
          fontFamily: 'Inter, system-ui, sans-serif',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? '#353535'
                : '#e8eaf0',
          },
        },
      }}
      muiTableBodyRowProps={({ row }) => ({
        sx: {
          cursor: 'pointer',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          // Solid color highlight when expanded
          backgroundColor: row.getIsExpanded()
            ? (theme) =>
                theme.palette.mode === 'dark'
                  ? '#1e3a8a' // Dark blue for dark theme
                  : '#2563eb' // Bright blue for light theme
            : undefined,
          transform: row.getIsExpanded() ? 'scale(1.001)' : undefined,
          // White text when expanded
          color: row.getIsExpanded() ? '#ffffff' : undefined,
          '& .MuiTypography-root': {
            color: row.getIsExpanded() ? '#ffffff !important' : undefined,
          },
          '& .MuiChip-root': {
            backgroundColor: row.getIsExpanded()
              ? (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.2)'
                    : 'rgba(255, 255, 255, 0.25)'
              : undefined,
            color: row.getIsExpanded() ? '#ffffff' : undefined,
            borderColor: row.getIsExpanded() ? 'rgba(255, 255, 255, 0.4)' : undefined,
          },
          '&:hover': row.getIsExpanded() ? {} : {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? '#1e3a8a'
                : '#2563eb',
            color: '#ffffff',
            '& .MuiTypography-root': {
              color: '#ffffff !important',
            },
            '& .MuiChip-root': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(255, 255, 255, 0.25)',
              color: '#ffffff',
              borderColor: 'rgba(255, 255, 255, 0.4)',
            },
          },
          '&:nth-of-type(even)': {
            backgroundColor: row.getIsExpanded()
              ? (theme) =>
                  theme.palette.mode === 'dark'
                    ? '#1e3a8a'
                    : '#2563eb'
              : (theme) =>
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.015)'
                    : 'rgba(0, 0, 0, 0.02)',
          },
        },
      })}
      muiTableBodyCellProps={({ row, table }) => ({
        onClick: () => {
          // Only allow one row expanded at a time
          const currentlyExpanded = Object.keys(expanded).find(key => expanded[key]);
          if (currentlyExpanded && currentlyExpanded !== row.id) {
            // Collapse the currently expanded row
            setExpanded({ [row.id]: true });
          } else {
            // Toggle current row
            row.toggleExpanded();
          }
        },
        sx: {
          borderBottom: '1px solid',
          borderColor: row.getIsExpanded() ? 'rgba(255, 255, 255, 0.2)' : 'divider',
          py: 0.5,
          fontFamily: 'Inter, system-ui, sans-serif',
          overflow: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
            width: 0,
            height: 0,
          },
          // White icons when row is expanded
          '& .MuiIconButton-root': {
            color: row.getIsExpanded() ? '#ffffff' : undefined,
          },
          '& .MuiLinearProgress-root': {
            backgroundColor: row.getIsExpanded() ? 'rgba(255, 255, 255, 0.3)' : undefined,
          },
          '& .MuiLinearProgress-bar': {
            backgroundColor: row.getIsExpanded() ? '#ffffff' : undefined,
          },
        },
      })}
      muiExpandButtonProps={{
        sx: {
          color: 'primary.main',
          '&:hover': {
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
          },
        },
      }}
      muiDetailPanelProps={{
        onClick: (e) => e.stopPropagation(), // Prevent clicks from collapsing the row
        sx: {
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.05) !important'
              : 'rgba(0, 0, 0, 0.04) !important',
          overflow: 'hidden !important',
          overflowY: 'hidden !important',
          overflowX: 'hidden !important',
          maxHeight: 'none',
          // Reset colors to prevent parent blue background from affecting detail panel
          color: 'text.primary !important',
          '& .MuiTypography-root': {
            color: 'inherit !important',
          },
          '& .MuiChip-root': {
            color: 'inherit !important',
          },
          // Force scrollbar to be completely invisible
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
            width: '0 !important',
            height: '0 !important',
          },
          '&:hover': {
            overflow: 'hidden !important',
            overflowY: 'hidden !important',
            overflowX: 'hidden !important',
            color: 'text.primary !important',
            backgroundColor: 'background.paper !important',
          },
          '& *': {
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '&::-webkit-scrollbar': {
              display: 'none',
              width: 0,
              height: 0,
            },
          },
        },
      }}

      // Options
      enableColumnActions={false}
      enableSorting={true}
      enableColumnFilters={true}
      enableDensityToggle={false}
      enableFullScreenToggle={false}
      enableHiding={false}
      enablePagination={true}
      enableExpandAll={false}
      enableGlobalFilter={false}
      enableTopToolbar={false}
      manualFiltering={false} // Use client-side filtering for now
      enableMultiSort={false} // Only one column at a time
      layoutMode="grid" // Makes columns adapt to available horizontal space
      displayColumnDefOptions={{
        'mrt-row-expand': {
          size: 0,
          muiTableHeadCellProps: { sx: { display: 'none' } },
          muiTableBodyCellProps: { sx: { display: 'none' } },
        },
      }}
      paginationDisplayMode="pages"
      initialState={{
        density: 'compact',
        pagination: {
          pageIndex: 0,
          pageSize: 20,
        },
      }}
      muiPaginationProps={{
        showFirstButton: true,
        showLastButton: true,
      }}
      muiBottomToolbarProps={{
        sx: {
          borderTop: '2px solid',
          borderColor: 'divider',
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(30, 30, 30, 0.95)'
              : 'rgba(250, 251, 252, 0.95)',
          minHeight: '56px',
        },
      }}
    />
  );
};
