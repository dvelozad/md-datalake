import React, { useState } from 'react';
import {
  Box, Grid, Typography, Button, TextField, InputAdornment,
  CircularProgress, Alert, Stack, ToggleButton, ToggleButtonGroup,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  Paper, Chip, Tooltip, IconButton,
} from '@mui/material';
import { Add, Search, GridView, TableRows, Lock, LockOpen, OpenInNew } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import apiClient from '@/services/api';
import type { Project, ProjectCreate } from '@/types/visualization';
import { useAuth } from '@/contexts/AuthContext';

type ViewMode = 'grid' | 'table';

const ProjectsTable: React.FC<{ projects: Project[]; onNavigate: (id: number) => void }> = ({
  projects, onNavigate,
}) => (
  <TableContainer component={Paper} variant="outlined">
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Name</TableCell>
          <TableCell>PI / Lead</TableCell>
          <TableCell>Institution</TableCell>
          <TableCell>Keywords</TableCell>
          <TableCell align="center">Runs</TableCell>
          <TableCell align="center">Visibility</TableCell>
          <TableCell align="center">Created</TableCell>
          <TableCell />
        </TableRow>
      </TableHead>
      <TableBody>
        {projects.map(p => (
          <TableRow
            key={p.id}
            hover
            sx={{ cursor: 'pointer' }}
            onClick={() => onNavigate(p.id)}
          >
            <TableCell sx={{ fontWeight: 600 }}>{p.name}</TableCell>
            <TableCell>{p.pi_name || '—'}</TableCell>
            <TableCell>{p.institution || '—'}</TableCell>
            <TableCell>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(p.keywords || []).slice(0, 3).map(kw => (
                  <Chip key={kw} label={kw} size="small" variant="outlined" />
                ))}
                {(p.keywords || []).length > 3 && (
                  <Chip label={`+${p.keywords.length - 3}`} size="small" variant="outlined" />
                )}
              </Box>
            </TableCell>
            <TableCell align="center">{p.run_count}</TableCell>
            <TableCell align="center">
              <Tooltip title={p.is_public ? 'Public' : 'Private'}>
                {p.is_public
                  ? <LockOpen fontSize="small" color="success" />
                  : <Lock fontSize="small" color="action" />}
              </Tooltip>
            </TableCell>
            <TableCell align="center">
              {new Date(p.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell align="center" onClick={e => e.stopPropagation()}>
              <IconButton size="small" onClick={() => onNavigate(p.id)}>
                <OpenInNew fontSize="small" />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isContributor } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState<'all' | 'public' | 'private'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects', search, visibility],
    queryFn: () => apiClient.listProjects({
      search: search || undefined,
      is_public: visibility === 'all' ? undefined : visibility === 'public',
    }),
  });

  const createMutation = useMutation({
    mutationFn: (data: ProjectCreate) => apiClient.createProject(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Projects</Typography>
        {isContributor && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
            New Project
          </Button>
        )}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3} alignItems="center">
        <TextField
          placeholder="Search projects…"
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
          sx={{ flex: 1, maxWidth: 400 }}
        />
        <ToggleButtonGroup
          value={visibility}
          exclusive
          onChange={(_, v) => { if (v) setVisibility(v); }}
          size="small"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="public">Public</ToggleButton>
          <ToggleButton value="private">Private</ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => { if (v) setViewMode(v); }}
          size="small"
        >
          <Tooltip title="Table view">
            <ToggleButton value="table"><TableRows fontSize="small" /></ToggleButton>
          </Tooltip>
          <Tooltip title="Grid view">
            <ToggleButton value="grid"><GridView fontSize="small" /></ToggleButton>
          </Tooltip>
        </ToggleButtonGroup>
      </Stack>

      {isLoading && (
        <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>
      )}

      {error && (
        <Alert severity="error">Failed to load projects.</Alert>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary" gutterBottom>No projects found.</Typography>
          {isContributor && (
            <Button variant="outlined" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
              Create your first project
            </Button>
          )}
        </Box>
      )}

      {!isLoading && !error && projects.length > 0 && (
        viewMode === 'table' ? (
          <ProjectsTable projects={projects} onNavigate={id => navigate(`/projects/${id}`)} />
        ) : (
          <Grid container spacing={2}>
            {projects.map(p => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={p.id}>
                <ProjectCard project={p} onClick={() => navigate(`/projects/${p.id}`)} />
              </Grid>
            ))}
          </Grid>
        )
      )}

      <CreateProjectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={createMutation.mutateAsync}
      />
    </Box>
  );
};
