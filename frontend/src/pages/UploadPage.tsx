import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadDropzone } from '@/components/upload/UploadDropzone';
import { FileList } from '@/components/upload/FileList';
import { UploadMetadataForm } from '@/components/upload/UploadMetadataForm';
import { UploadProgress } from '@/components/upload/UploadProgress';
import { apiClient } from '@/services/api';
import type { UploadMetadata, ValidationInfo } from '@/types/visualization';
import './UploadPage.css';

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
        const detail = error.response?.data?.detail;
        if (typeof detail === 'object' && detail.message) {
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

  function getStepClass(index: number): string {
    if (index < activeStep) return 'up-stepper__number--done';
    if (index === activeStep) return 'up-stepper__number--active';
    return '';
  }

  return (
    <div className="up-page">
      {/* Back button */}
      <button className="up-back" onClick={() => navigate('/')}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M8.75 3.5L5.25 7L8.75 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back to Runs
      </button>

      {/* Header */}
      <h1 className="up-title">Upload simulation data</h1>
      <p className="up-subtitle">
        Drop trajectory and topology files. LAMMPS or GROMACS. Maximum 5 GB per file.
      </p>

      {/* Stepper */}
      <div className="up-stepper">
        {steps.map((label, idx) => (
          <React.Fragment key={label}>
            {idx > 0 && <div className="up-stepper__line" />}
            <div className="up-stepper__step">
              <span className={`up-stepper__number ${getStepClass(idx)}`}>
                {idx < activeStep ? '\u2713' : idx + 1}
              </span>
              <span className={`up-stepper__label ${idx === activeStep ? 'up-stepper__label--active' : ''}`}>
                {label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Success state */}
      {uploadStatus === 'success' ? (
        <div className="up-card">
          <div className="up-alert up-alert--success">
            Successfully uploaded and ingested simulation run!
          </div>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--fg-default)' }}>
            Your simulation has been uploaded and processed. Run ID: {createdRunId}
          </p>

          {validationInfo && (validationInfo.warnings.length > 0 || validationInfo.recommendations.length > 0) && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              {validationInfo.warnings.length > 0 && (
                <div className="up-alert up-alert--warning">
                  <div className="up-alert__title">Warnings:</div>
                  <ul className="up-alert__list">
                    {validationInfo.warnings.map((warning, idx) => (
                      <li key={idx}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              {validationInfo.recommendations.length > 0 && (
                <div className="up-alert up-alert--info">
                  <div className="up-alert__title">Recommendations:</div>
                  <ul className="up-alert__list">
                    {validationInfo.recommendations.map((rec, idx) => (
                      <li key={idx}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="up-success-actions">
            <button className="up-btn-primary" onClick={handleViewRun}>
              View Run
            </button>
            <button className="up-btn-ghost" onClick={handleReset}>
              Upload Another
            </button>
          </div>
        </div>
      ) : (
        <div className="up-card">
          {/* Error display */}
          {errorMessage && (
            <div>
              <div className="up-alert up-alert--error">
                {errorMessage}
              </div>

              {uploadStatus === 'error' && validationInfo && (
                <>
                  {validationInfo.warnings.length > 0 && (
                    <div className="up-alert up-alert--warning">
                      <div className="up-alert__title">Issues found:</div>
                      <ul className="up-alert__list">
                        {validationInfo.warnings.map((warning, idx) => (
                          <li key={idx}>{warning}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {validationInfo.recommendations.length > 0 && (
                    <div className="up-alert up-alert--info">
                      <div className="up-alert__title">How to fix:</div>
                      <ul className="up-alert__list">
                        {validationInfo.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Dropzone */}
          <UploadDropzone
            onFilesSelected={handleFilesSelected}
            disabled={uploadStatus === 'uploading'}
          />

          {/* File list */}
          {files.length > 0 && (
            <>
              <hr className="up-divider" />
              <p className="up-eyebrow">Selected files ({files.length})</p>
              <FileList
                files={files}
                artifactTypes={artifactTypes}
                onRemove={handleRemoveFile}
                onArtifactTypeChange={handleArtifactTypeChange}
                disabled={uploadStatus === 'uploading'}
              />
            </>
          )}

          <hr className="up-divider" />

          {/* Metadata form */}
          <p className="up-eyebrow">Simulation metadata</p>
          <UploadMetadataForm
            metadata={metadata}
            onChange={setMetadata}
            disabled={uploadStatus === 'uploading'}
            files={files}
          />

          {/* Upload progress */}
          {uploadStatus === 'uploading' && (
            <div className="up-progress">
              <UploadProgress progress={uploadProgress} />
            </div>
          )}

          {/* Action buttons */}
          <div className="up-actions">
            <button
              className="up-btn-primary"
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {uploadStatus === 'uploading' ? 'Uploading...' : 'Upload'}
            </button>
            <button
              className="up-btn-ghost"
              onClick={handleReset}
              disabled={uploadStatus === 'uploading'}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
