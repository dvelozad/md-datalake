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
} from '@mui/material';
import { CloudUpload, ArrowBack } from '@mui/icons-material';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { FileList } from '@/components/upload/FileList';
import { UploadMetadataForm } from '@/components/upload/UploadMetadataForm';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { apiClient } from '@/services/api';
import type { UploadMetadata } from '@/types/visualization';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

const steps = ['Select Files', 'Enter Metadata', 'Upload'];

export const UploadPage: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [metadata, setMetadata] = useState<UploadMetadata>({
    projectName: '',
    runName: '',
    description: '',
  });
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [createdRunId, setCreatedRunId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [activeStep, setActiveStep] = useState(0);

  const navigate = useNavigate();

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
    if (activeStep === 0) {
      setActiveStep(1);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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

    setActiveStep(2);
    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      const result = await apiClient.uploadTrajectory(files, metadata, (progress) => {
        setUploadProgress(progress);
      });

      setCreatedRunId(result.run_id);
      setUploadStatus('success');
    } catch (error: any) {
      setUploadStatus('error');
      setErrorMessage(
        error.response?.data?.detail || error.message || 'Upload failed. Please try again.'
      );
    }
  };

  const handleViewRun = () => {
    if (createdRunId) {
      navigate(`/runs/${createdRunId}`);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setMetadata({ projectName: '', runName: '', description: '' });
    setUploadStatus('idle');
    setUploadProgress(0);
    setCreatedRunId(null);
    setErrorMessage('');
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
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/')} sx={{ mb: 2 }}>
          Back to Runs
        </Button>
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
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setErrorMessage('')}>
              {errorMessage}
            </Alert>
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
                onRemove={handleRemoveFile}
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
              disabled={!canUpload || uploadStatus === 'uploading'}
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
