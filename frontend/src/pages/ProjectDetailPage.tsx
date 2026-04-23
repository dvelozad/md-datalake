import React, { useState } from 'react';
import {
  Box, Typography, Stack, Chip, Divider, Button, Grid,
  CircularProgress, Alert, Paper, IconButton, Tooltip,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
} from '@mui/material';
import {
  ArrowBack, Edit, Delete, Lock, LockOpen, Science,
  Business, AccountBalance, Person,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api';
import { EditProjectDialog } from '@/components/projects/EditProjectDialog';
import { CollaboratorsPanel } from '@/components/projects/CollaboratorsPanel';
import { useAuth } from '@/contexts/AuthContext';
import type { ProjectCreate } from '@/types/visualization';

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const id = parseInt(projectId!);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, isAdmin } = useAuth();
  const [editOpen, setEditOpen] = useState(false);

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => apiClient.getProject(id),
  });

  const { data: runsData } = useQuery({
    queryKey: ['runs', { project_id: id }],
    queryFn: () => apiClient.listRuns({ project_id: id, limit: 100, offset: 0 }),
    enabled: !!project,
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ProjectCreate>) => apiClient.updateProject(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', id] }); qc.invalidateQueries({ queryKey: ['projects'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.deleteProject(id),
    onSuccess: () => navigate('/'),
  });

  const addCollaborator = async (userId: number, role: string) => {
    await apiClient.addCollaborator(id, userId, role);
    qc.invalidateQueries({ queryKey: ['project', id] });
  };

  const removeCollaborator = async (userId: number) => {
    await apiClient.removeCollaborator(id, userId);
    qc.invalidateQueries({ queryKey: ['project', id] });
  };

  if (isLoading) return <Box sx={{ textAlign: 'center', py: 8 }}><CircularProgress /></Box>;
  if (error || !project) return <Alert severity="error" sx={{ m: 3 }}>Project not found.</Alert>;

  const canEdit = isAdmin || project.created_by_id === user?.id;

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <IconButton onClick={() => navigate('/')} size="small">
          <ArrowBack />
        </IconButton>
        <Typography variant="h5" fontWeight={700} sx={{ flex: 1 }}>
          {project.name}
        </Typography>
        <Tooltip title={project.is_public ? 'Public project' : 'Private project'}>
          {project.is_public
            ? <Chip icon={<LockOpen />} label="Public" size="small" color="success" />
            : <Chip icon={<Lock />} label="Private" size="small" />}
        </Tooltip>
        {canEdit && (
          <>
            <Button startIcon={<Edit />} size="small" variant="outlined" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            {isAdmin && (
              <Button
                startIcon={<Delete />}
                size="small"
                color="error"
                variant="outlined"
                onClick={() => { if (confirm('Delete this project?')) deleteMutation.mutate(); }}
              >
                Delete
              </Button>
            )}
          </>
        )}
      </Stack>

      <Grid container spacing={3}>
        {/* Left column: metadata */}
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              {project.description && (
                <Typography variant="body2" color="text.secondary">
                  {project.description}
                </Typography>
              )}

              {project.pi_name && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Person fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">PI / Lead</Typography>
                    <Typography variant="body2">{project.pi_name}</Typography>
                  </Box>
                </Stack>
              )}

              {project.institution && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Business fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Institution</Typography>
                    <Typography variant="body2">{project.institution}</Typography>
                  </Box>
                </Stack>
              )}

              {(project.grant_number || project.funding_source) && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <AccountBalance fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Funding</Typography>
                    {project.grant_number && (
                      <Typography variant="body2">Grant: {project.grant_number}</Typography>
                    )}
                    {project.funding_source && (
                      <Typography variant="body2">{project.funding_source}</Typography>
                    )}
                  </Box>
                </Stack>
              )}

              {(project.keywords || []).length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">Keywords</Typography>
                  <Box sx={{ mt: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {project.keywords.map(kw => (
                      <Chip key={kw} label={kw} size="small" variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              <Divider />

              <Stack direction="row" alignItems="center" spacing={1}>
                <Science color="primary" fontSize="small" />
                <Typography variant="body2" fontWeight={600}>
                  {project.run_count} simulation run{project.run_count !== 1 ? 's' : ''}
                </Typography>
              </Stack>

              {project.created_by_name && (
                <Typography variant="caption" color="text.secondary">
                  Created by {project.created_by_name}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {new Date(project.created_at).toLocaleDateString()}
              </Typography>
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <CollaboratorsPanel
              project={project}
              onAddCollaborator={addCollaborator}
              onRemoveCollaborator={removeCollaborator}
            />
          </Paper>
        </Grid>

        {/* Right column: runs */}
        <Grid item xs={12} md={8}>
          <Typography variant="subtitle1" fontWeight={600} mb={1}>Simulation Runs</Typography>
          {!runsData ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : runsData.runs.length === 0 ? (
            <Alert severity="info">No runs in this project yet. Upload a simulation to get started.</Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Run Name</TableCell>
                    <TableCell>Engine</TableCell>
                    <TableCell>Ensemble</TableCell>
                    <TableCell>Atoms</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {runsData.runs.map(run => (
                    <TableRow
                      key={run.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/runs/${run.id}`)}
                    >
                      <TableCell>{run.run_name}</TableCell>
                      <TableCell>{run.engine?.name || '—'}</TableCell>
                      <TableCell>{run.ensemble || '—'}</TableCell>
                      <TableCell>{run.system?.n_atoms?.toLocaleString() || '—'}</TableCell>
                      <TableCell>{new Date(run.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Grid>
      </Grid>

      <EditProjectDialog
        project={editOpen ? project : null}
        onClose={() => setEditOpen(false)}
        onSubmit={updateMutation.mutateAsync}
      />
    </Box>
  );
};
