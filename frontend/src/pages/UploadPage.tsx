import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Button,
  Alert,
  Box,
  Stepper,
  Step,
  StepLabel,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { CloudUpload, ArrowBack, Warning, Info } from '@mui/icons-material';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { FileList } from '@/components/upload/FileList';
import { UploadMetadataForm } from '@/components/upload/UploadMetadataForm';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { apiClient } from '@/services/api';
import type { UploadMetadata, ValidationInfo } from '@/types/visualization';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const steps = ['Select Files', 'Enter Metadata', 'Upload'];

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [artifactTypes, setArtifactTypes] = useState<Record<string, string>>({});
  const [metadata, setMetadata] = useState<UploadMetadata>({
    projectName: '',
    runName: '',
    description: '',
  });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdRunId, setCreatedRunId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [validationInfo, setValidationInfo] = useState<ValidationInfo | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    if (activeStep === 0) {
      setActiveStep(1);
    }
  };

  const handleRemoveFile = (index: number) => {
    const removedFile = files[index];
    setFiles((prev) => prev.filter((_, i) => i !== index));
    // Remove artifact type for the removed file
    setArtifactTypes((prev) => {
      const updated = { ...prev };
      delete updated[removedFile.name];
      return updated;
    });
  };

  const handleArtifactTypeChange = (filename: string, artifactType: string) => {
    setArtifactTypes((prev) => ({
      ...prev,
      [filename]: artifactType,
    }));
  };

  const handleUpload = async () => {
    if (!metadata.projectName || !metadata.runName) {
      setErrorMessage('Please fill in all required fields');
      return;
    }

    if (files.length === 0) {
      setErrorMessage('Please select at least one file');
      return;
    }

    // Check if LAMMPS trajectory requires atom style
    const hasLammpsTrajectory = files.some(f => {
      const name = f.name.toLowerCase();
      return name.endsWith('.dump') || name.endsWith('.lammpstrj');
    });

    if (hasLammpsTrajectory && !metadata.atomStyle) {
      setErrorMessage('LAMMPS atom style is required for trajectory files');
      return;
    }

    setActiveStep(2);
    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      const result = await apiClient.uploadTrajectory(files, metadata, artifactTypes, (progress) => {
        setUploadProgress(progress);
      });

      setCreatedRunId(result.run_id);
      setValidationInfo(result.validation || null);
      setUploadStatus('success');
    } catch (error: any) {
      setUploadStatus('error');

      // Handle validation errors (422)
      if (error.response?.status === 422) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'object' && detail.message) {
          setErrorMessage(detail.message);
          setValidationInfo({
            warnings: detail.warnings || [],
            recommendations: detail.recommendations || [],
          });
        } else if (typeof detail === 'string') {
          setErrorMessage(detail);
        } else {
          setErrorMessage('File validation failed. Please check your files and try again.');
        }
      } else {
        // Handle other errors (400, 500, etc.)
        const detail = error.response?.data?.detail;
        if (typeof detail === 'object' && detail.message) {
          // Detailed error object from backend
          setErrorMessage(`${detail.message}: ${detail.error || ''}`);
        } else if (typeof detail === 'string') {
          setErrorMessage(detail);
        } else {
          setErrorMessage(error.message || 'Upload failed. Please try again.');
        }
      }
    }
  };

  const handleViewRun = () => {
    if (createdRunId) {
      navigate(`/runs/${createdRunId}`);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setArtifactTypes({});
    setMetadata({ projectName: '', runName: '', description: '' });
    setUploadStatus('idle');
    setUploadProgress(0);
    setCreatedRunId(null);
    setErrorMessage('');
    setValidationInfo(null);
    setActiveStep(0);
  };

  const canUpload =
    files.length > 0 &&
    metadata.projectName.trim() !== '' &&
    metadata.runName.trim() !== '' &&
    uploadStatus === 'idle';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Button startIcon={<ArrowBack />} onClick={() => navigate('/')}>
            Back to Runs
          </Button>
        </Box>
        <Typography variant="h4" gutterBottom>
          Upload Simulation Data
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Upload LAMMPS or GROMACS simulation files including trajectories, topologies, input
          scripts, and log files.
        </Typography>
      </Box>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {uploadStatus === 'success' ? (
        <Paper sx={{ p: 4 }}>
          <Alert severity="success" sx={{ mb: 3 }}>
            Successfully uploaded and ingested simulation run!
          </Alert>
          <Typography variant="body1" gutterBottom>
            Your simulation has been uploaded and processed. Run ID: {createdRunId}
          </Typography>

          {/* Display validation warnings and recommendations */}
          {validationInfo && (validationInfo.warnings.length > 0 || validationInfo.recommendations.length > 0) && (
            <Box sx={{ mt: 3 }}>
              {validationInfo.warnings.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Warnings:
                  </Typography>
                  <List dense>
                    {validationInfo.warnings.map((warning, idx) => (
                      <ListItem key={idx} sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Warning fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={warning} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}

              {validationInfo.recommendations.length > 0 && (
                <Alert severity="info">
                  <Typography variant="subtitle2" gutterBottom>
                    Recommendations:
                  </Typography>
                  <List dense>
                    {validationInfo.recommendations.map((rec, idx) => (
                      <ListItem key={idx} sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 32 }}>
                          <Info fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={rec} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}
            </Box>
          )}

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={handleViewRun}>
              View Run
            </Button>
            <Button variant="outlined" onClick={handleReset}>
              Upload Another
            </Button>
          </Box>
        </Paper>
      ) : (
        <Paper sx={{ p: 4 }}>
          {errorMessage && (
            <Box sx={{ mb: 3 }}>
              <Alert severity="error" onClose={() => setErrorMessage('')}>
                {errorMessage}
              </Alert>

              {/* Display validation errors if present */}
              {uploadStatus === 'error' && validationInfo && (
                <Box sx={{ mt: 2 }}>
                  {validationInfo.warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      <Typography variant="subtitle2" gutterBottom>
                        Issues found:
                      </Typography>
                      <List dense>
                        {validationInfo.warnings.map((warning, idx) => (
                          <ListItem key={idx} sx={{ py: 0 }}>
                            <ListItemText primary={warning} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}

                  {validationInfo.recommendations.length > 0 && (
                    <Alert severity="info">
                      <Typography variant="subtitle2" gutterBottom>
                        How to fix:
                      </Typography>
                      <List dense>
                        {validationInfo.recommendations.map((rec, idx) => (
                          <ListItem key={idx} sx={{ py: 0 }}>
                            <ListItemText primary={rec} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}
                </Box>
              )}
            </Box>
          )}

          <Box sx={{ mb: 3 }}>
            <UploadDropzone
              onFilesSelected={handleFilesSelected}
              disabled={uploadStatus === 'uploading'}
            />
          </Box>

          {files.length > 0 && (
            <>
              <Divider sx={{ my: 3 }} />
              <Typography variant="h6" gutterBottom>
                Selected Files ({files.length})
              </Typography>
              <FileList
                files={files}
                artifactTypes={artifactTypes}
                onRemove={handleRemoveFile}
                onArtifactTypeChange={handleArtifactTypeChange}
                disabled={uploadStatus === 'uploading'}
              />
            </>
          )}

          <Divider sx={{ my: 3 }} />

          <Typography variant="h6" gutterBottom>
            Simulation Metadata
          </Typography>
          <UploadMetadataForm
            metadata={metadata}
            onChange={setMetadata}
            disabled={uploadStatus === 'uploading'}
            files={files}
          />

          {uploadStatus === 'uploading' && (
            <Box sx={{ mt: 3 }}>
              <UploadProgress progress={uploadProgress} />
            </Box>
          )}

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<CloudUpload />}
              onClick={handleUpload}
              disabled={!canUpload}
              size="large"
            >
              {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleReset}
              disabled={uploadStatus === 'uploading'}
            >
              Reset
            </Button>
          </Box>
        </Paper>
      )}
    </Container>
  );
};
