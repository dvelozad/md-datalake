import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CloudUpload,
  Download as DownloadIcon,
  Archive as ArchiveIcon,
} from '@mui/icons-material';
import { apiClient } from '@/services/api';
import { useCompleteness } from '@/hooks/useCompleteness';
import { CompletenessCard } from '@/components/completeness/CompletenessCard';
import { SimulationPreview } from '@/components/visualization/SimulationPreview';
import { EditRunDialog } from '@/components/browser/EditRunDialog';
import { DeleteConfirmDialog } from '@/components/browser/DeleteConfirmDialog';
import { UploadArtifactsDialog } from '@/components/artifacts/UploadArtifactsDialog';
import { ObservablePlots } from '@/components/properties/ObservablePlots';
import { LogMetadata } from '@/components/properties/LogMetadata';
import type { SimulationRun, Artifact, Observable } from '@/types/visualization';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`run-tabpanel-${index}`}
      aria-labelledby={`run-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export const RunDetailPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [observables, setObservables] = useState<Observable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadArtifactsDialogOpen, setUploadArtifactsDialogOpen] = useState(false);

  const { completeness, loading: completenessLoading } = useCompleteness(
    runId ? parseInt(runId) : null
  );

  useEffect(() => {
    const fetchRunData = async () => {
      if (!runId) return;

      setLoading(true);
      setError(null);

      try {
        const [runData, artifactsData, observablesData] = await Promise.all([
          apiClient.getRun(parseInt(runId)),
          apiClient.getRunArtifacts(parseInt(runId)),
          apiClient.getRunObservables(parseInt(runId)),
        ]);

        setRun(runData);
        setArtifacts(artifactsData);
        setObservables(observablesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run data');
      } finally {
        setLoading(false);
      }
    };

    fetchRunData();
  }, [runId]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditSave = async (data: { run_name: string; description?: string }) => {
    if (!runId) return;

    const result = await apiClient.updateRun(parseInt(runId), data);

    // Update local state
    setRun((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        run_name: result.run_name,
        description: result.description,
      };
    });
  };

  const handleDelete = async () => {
    if (!runId) return;

    await apiClient.deleteRun(parseInt(runId));

    // Navigate back to browser after successful deletion
    navigate('/');
  };

  const handleMetadataUpdate = async () => {
    // Reload run data after metadata update
    if (!runId) return;

    try {
      const runData = await apiClient.getRun(parseInt(runId));
      setRun(runData);
    } catch (err) {
      console.error('Failed to reload run data:', err);
    }
  };

  const handleDownloadArtifact = async (artifactId: number, fileName: string) => {
    if (!runId) return;

    try {
      await apiClient.downloadArtifact(parseInt(runId), artifactId, fileName);
    } catch (err) {
      console.error('Failed to download artifact:', err);
      alert('Failed to download file. Please try again.');
    }
  };

  const handleDownloadAll = async () => {
    if (!runId || !run) return;

    try {
      await apiClient.downloadAllArtifacts(parseInt(runId), run.run_name);
    } catch (err) {
      console.error('Failed to download all artifacts:', err);
      alert('Failed to download files. Please try again.');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading run data...</Typography>
      </Container>
    );
  }

  if (error || !run) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">{error || 'Run not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mt: 2 }}>
          Back to Browser
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
        Back to Browser
      </Button>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="h4">
            {run.run_name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<EditIcon />}
              variant="outlined"
              onClick={() => setEditDialogOpen(true)}
            >
              Edit
            </Button>
            <Button
              startIcon={<DeleteIcon />}
              variant="outlined"
              color="error"
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete
            </Button>
          </Box>
        </Box>

        {run.description && (
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {run.description}
          </Typography>
        )}

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="run detail tabs">
            <Tab label="Overview" id="run-tab-0" aria-controls="run-tabpanel-0" />
            <Tab label="Data Quality" id="run-tab-1" aria-controls="run-tabpanel-1" />
            <Tab label="Artifacts" id="run-tab-2" aria-controls="run-tabpanel-2" />
            <Tab label="Observables" id="run-tab-3" aria-controls="run-tabpanel-3" />
          </Tabs>
        </Box>

        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            {/* Simulation Preview */}
            <Grid item xs={12}>
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <SimulationPreview
                  runId={parseInt(runId || '0')}
                  height={500}
                  totalTime={run.total_time}
                />
              </Paper>
            </Grid>

            {/* Existing Overview Content */}
            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                Simulation Parameters
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Chip label={run.ensemble} color="primary" />
                  {run.simulation_method && (
                    <Chip
                      label={run.simulation_method === 'H_ADRESS' ? 'H-AdResS' : run.simulation_method}
                      color="error"
                    />
                  )}
                  {run.simulation_method === 'H_ADRESS' && run.particle_insertion !== null && run.particle_insertion !== undefined && (
                    <Chip
                      label={run.particle_insertion ? 'Particle-Insertion' : 'Non-Particle-Insertion'}
                      color="warning"
                      variant="outlined"
                    />
                  )}
                  <Chip label={run.engine.name} variant="outlined" />
                </Box>
                {run.temperature_target && (
                  <Typography variant="body2">
                    <strong>Temperature:</strong> {run.temperature_target} K
                  </Typography>
                )}
                {run.pressure_target && (
                  <Typography variant="body2">
                    <strong>Pressure:</strong> {run.pressure_target} bar
                  </Typography>
                )}
                {run.timestep && (
                  <Typography variant="body2">
                    <strong>Timestep:</strong> {run.timestep} fs
                  </Typography>
                )}
                {run.n_steps && (
                  <Typography variant="body2">
                    <strong>Steps:</strong> {run.n_steps.toLocaleString()}
                  </Typography>
                )}
                {run.total_time && (
                  <Typography variant="body2">
                    <strong>Total Time:</strong> {run.total_time.toFixed(2)} ns
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom>
                System Information
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2">
                  <strong>Atoms:</strong> {run.system.n_atoms.toLocaleString()}
                </Typography>
                <Typography variant="body2">
                  <strong>Composition:</strong> {run.system.composition}
                </Typography>
                <Typography variant="body2">
                  <strong>Engine Version:</strong> {run.engine.version}
                </Typography>
              </Box>
            </Grid>

            {/* HPC / SLURM Information */}
            {(run.slurm_job_id || run.compute_node) && (
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  HPC / SLURM
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {run.slurm_job_id && (
                    <Typography variant="body2">
                      <strong>SLURM Job ID:</strong> {run.slurm_job_id}
                    </Typography>
                  )}
                  {run.compute_node && (
                    <Typography variant="body2">
                      <strong>Compute Node:</strong> {run.compute_node}
                    </Typography>
                  )}
                </Box>
              </Grid>
            )}

            {/* Log File Metadata */}
            <Grid item xs={12}>
              <LogMetadata runId={parseInt(runId || '0')} onUpdate={handleMetadataUpdate} />
            </Grid>

            {run.completeness_score !== undefined &&
              run.completeness_score !== null &&
              !completenessLoading &&
              completeness && (
                <Grid item xs={12}>
                  <CompletenessCard completeness={completeness} />
                </Grid>
              )}
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {completenessLoading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }}>Loading data quality information...</Typography>
            </Box>
          ) : completeness ? (
            <CompletenessCard completeness={completeness} />
          ) : (
            <Alert severity="info">No data quality information available for this run.</Alert>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Artifacts ({artifacts.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {artifacts.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<ArchiveIcon />}
                  onClick={handleDownloadAll}
                  size="small"
                  color="primary"
                >
                  Download All
                </Button>
              )}
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={() => setUploadArtifactsDialogOpen(true)}
                size="small"
              >
                Upload Files
              </Button>
            </Box>
          </Box>
          {artifacts.length === 0 ? (
            <Alert severity="info">
              No artifacts found for this run. Click "Upload Files" to add trajectory, topology, or log files.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {artifacts.map((artifact) => (
                <Paper key={artifact.id} variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" fontWeight={500}>
                        {artifact.file_name}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Chip label={artifact.artifact_type} size="small" />
                        <Chip
                          label={`${(artifact.file_size_bytes ? (artifact.file_size_bytes / 1024 / 1024).toFixed(2) : '0.00')} MB`}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                    <Tooltip title="Download file">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleDownloadArtifact(artifact.id, artifact.file_name)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </TabPanel>

        <TabPanel value={tabValue} index={3}>
          <Typography variant="h6" gutterBottom>
            Observable Plots
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
            Interactive plots of thermodynamic observables from log files
          </Typography>
          <ObservablePlots runId={parseInt(runId || '0')} />
        </TabPanel>
      </Paper>

      {/* Edit Dialog */}
      <EditRunDialog
        open={editDialogOpen}
        run={run}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        run={run}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />

      {/* Upload Artifacts Dialog */}
      {runId && (
        <UploadArtifactsDialog
          open={uploadArtifactsDialogOpen}
          runId={parseInt(runId)}
          onClose={() => setUploadArtifactsDialogOpen(false)}
          onSuccess={async () => {
            // Refresh artifacts list after successful upload
            const artifactsData = await apiClient.getRunArtifacts(parseInt(runId));
            setArtifacts(artifactsData);
          }}
        />
      )}
    </Container>
  );
};
