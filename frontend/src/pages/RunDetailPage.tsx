import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import './RunDetailPage.css';

const METHOD_COLORS: Record<string, string> = {
  ATOMISTIC: '#2f4ea8',
  H_ADRESS: '#7d3cc6',
  COARSE_GRAINED: '#16936a',
  UNITED_ATOM: '#c87005',
  MONTE_CARLO: '#c44a85',
};

const METHOD_LABELS: Record<string, string> = {
  ATOMISTIC: 'Atomistic',
  H_ADRESS: 'H-AdResS',
  COARSE_GRAINED: 'Coarse-Grained',
  UNITED_ATOM: 'United Atom',
  MONTE_CARLO: 'Monte Carlo',
};

export const RunDetailPage: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [sectionTab, setSectionTab] = useState(0);
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [_observables, setObservables] = useState<Observable[]>([]);
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

  const handleEditSave = async (data: { run_name: string; description?: string }) => {
    if (!runId) return;

    const result = await apiClient.updateRun(parseInt(runId), data);

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
    navigate('/');
  };

  const handleMetadataUpdate = async () => {
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
      <div className="rdp">
        <div className="rdp-loading">
          <div className="rdp-loading__spinner" />
          Loading run data...
        </div>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="rdp">
        <div className="rdp-error">
          <div className="rdp-error__msg">{error || 'Run not found'}</div>
          <button className="rdp-topbar__back" onClick={() => navigate('/')}>
            <ArrowLeftIcon /> Back to runs
          </button>
        </div>
      </div>
    );
  }

  const method = run.simulation_method || 'ATOMISTIC';
  const methodColor = METHOD_COLORS[method] || METHOD_COLORS.ATOMISTIC;
  const methodLabel = METHOD_LABELS[method] || method;
  const score = run.completeness_score || 0;
  const qualityColor = score >= 80 ? 'green' : score >= 50 ? 'orange' : 'red';

  return (
    <div className="rdp">
      {/* Top bar */}
      <div className="rdp-topbar">
        <button className="rdp-topbar__back" onClick={() => navigate('/')}>
          <ArrowLeftIcon /> Back to runs
        </button>

        <div className="rdp-topbar__breadcrumb">
          runs / <span>{run.run_name}</span>
        </div>

        <div className="rdp-topbar__actions">
          <button className="rdp-topbar__btn" onClick={handleDownloadAll}>
            <DownloadIcon /> Download
          </button>
          <button className="rdp-topbar__btn" onClick={() => setEditDialogOpen(true)}>
            <EditIcon /> Edit
          </button>
          <button
            className="rdp-topbar__btn rdp-topbar__btn--danger"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <TrashIcon /> Delete
          </button>
        </div>
      </div>

      {/* Two-column grid */}
      <div className="rdp-grid">
        {/* Left: Viewer card */}
        <div className="rdp-card">
          <div className="rdp-viewer">
            <div className="rdp-viewer__stage">
              <div className="rdp-viewer__pattern" />
              <SimulationPreview
                runId={parseInt(runId || '0')}
                height={400}
                totalTime={run.total_time}
              />
            </div>
          </div>
        </div>

        {/* Right: Metadata card */}
        <div className="rdp-card">
          <div className="rdp-meta">
            <div className="rdp-meta__eyebrow">Run metadata</div>
            <h3 className="rdp-meta__name">{run.run_name}</h3>

            {/* Tags */}
            <div className="rdp-meta__tags">
              <span className="rdp-meta__tag" style={{ background: methodColor }}>
                {methodLabel}
              </span>
              <span className="rdp-meta__tag--outline rdp-meta__tag">
                {run.engine.name}
              </span>
              <span className="rdp-meta__tag" style={{ background: 'var(--primary-500)' }}>
                {run.ensemble}
              </span>
              {run.simulation_method === 'H_ADRESS' &&
                run.particle_insertion !== null &&
                run.particle_insertion !== undefined && (
                  <span className="rdp-meta__tag" style={{ background: 'var(--signal-600)' }}>
                    {run.particle_insertion ? 'PI' : 'Non-PI'}
                  </span>
                )}
            </div>

            {/* Key-value list */}
            <div className="rdp-kvlist">
              {run.temperature_target && (
                <>
                  <span className="rdp-kvlist__key">Temperature</span>
                  <span className="rdp-kvlist__val">{run.temperature_target} K</span>
                </>
              )}
              {run.pressure_target && (
                <>
                  <span className="rdp-kvlist__key">Pressure</span>
                  <span className="rdp-kvlist__val">{run.pressure_target} bar</span>
                </>
              )}
              <span className="rdp-kvlist__key">Atoms</span>
              <span className="rdp-kvlist__val">{run.system.n_atoms.toLocaleString()}</span>

              <span className="rdp-kvlist__key">Composition</span>
              <span className="rdp-kvlist__val">{run.system.composition}</span>

              {run.total_time && (
                <>
                  <span className="rdp-kvlist__key">Length</span>
                  <span className="rdp-kvlist__val">{run.total_time.toFixed(2)} ns</span>
                </>
              )}

              <span className="rdp-kvlist__key">Engine</span>
              <span className="rdp-kvlist__val">{run.engine.name} {run.engine.version}</span>

              <span className="rdp-kvlist__key">Uploaded</span>
              <span className="rdp-kvlist__val">
                {new Date(run.created_at).toLocaleDateString()}
              </span>

              {run.slurm_job_id && (
                <>
                  <span className="rdp-kvlist__key">SLURM Job</span>
                  <span className="rdp-kvlist__val">{run.slurm_job_id}</span>
                </>
              )}
              {run.compute_node && (
                <>
                  <span className="rdp-kvlist__key">Node</span>
                  <span className="rdp-kvlist__val">{run.compute_node}</span>
                </>
              )}
            </div>

            {/* Completeness bar */}
            <div className="rdp-completeness">
              <div className="rdp-completeness__track">
                <div
                  className={`rdp-completeness__fill rdp-completeness__fill--${qualityColor}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <span className="rdp-completeness__label">{score}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section tabs below grid */}
      <div className="rdp-card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ padding: 'var(--space-5)' }}>
          <div className="rdp-section-tabs">
            <button
              className={`rdp-section-tab ${sectionTab === 0 ? 'rdp-section-tab--active' : ''}`}
              onClick={() => setSectionTab(0)}
            >
              Observables
            </button>
            <button
              className={`rdp-section-tab ${sectionTab === 1 ? 'rdp-section-tab--active' : ''}`}
              onClick={() => setSectionTab(1)}
            >
              Data Quality
            </button>
            <button
              className={`rdp-section-tab ${sectionTab === 2 ? 'rdp-section-tab--active' : ''}`}
              onClick={() => setSectionTab(2)}
            >
              Artifacts
            </button>
            <button
              className={`rdp-section-tab ${sectionTab === 3 ? 'rdp-section-tab--active' : ''}`}
              onClick={() => setSectionTab(3)}
            >
              Log Metadata
            </button>
          </div>

          {/* Observables tab */}
          {sectionTab === 0 && (
            <div>
              <ObservablePlots runId={parseInt(runId || '0')} />
            </div>
          )}

          {/* Data Quality tab */}
          {sectionTab === 1 && (
            <div>
              {completenessLoading ? (
                <div className="rdp-loading">
                  <div className="rdp-loading__spinner" />
                  Loading quality data...
                </div>
              ) : completeness ? (
                <CompletenessCard completeness={completeness} />
              ) : (
                <p style={{ color: 'var(--fg-muted)' }}>
                  No data quality information available for this run.
                </p>
              )}
            </div>
          )}

          {/* Artifacts tab */}
          {sectionTab === 2 && (
            <div className="rdp-artifacts">
              <div className="rdp-artifacts__header">
                <span style={{ fontWeight: 600 }}>
                  Artifacts ({artifacts.length})
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {artifacts.length > 0 && (
                    <button className="rdp-topbar__btn" onClick={handleDownloadAll}>
                      <DownloadIcon /> Download All
                    </button>
                  )}
                  <button
                    className="rdp-topbar__btn"
                    onClick={() => setUploadArtifactsDialogOpen(true)}
                  >
                    <UploadIcon /> Upload Files
                  </button>
                </div>
              </div>

              {artifacts.length === 0 ? (
                <p style={{ color: 'var(--fg-muted)', fontSize: 'var(--text-sm)' }}>
                  No artifacts found. Click "Upload Files" to add trajectory, topology, or log files.
                </p>
              ) : (
                <div className="rdp-artifacts__list">
                  {artifacts.map((artifact) => (
                    <div key={artifact.id} className="rdp-artifact-item">
                      <div>
                        <div className="rdp-artifact-item__name">{artifact.file_name}</div>
                        <div className="rdp-artifact-item__meta">
                          <span className="rdp-artifact-item__chip">{artifact.artifact_type}</span>
                          <span className="rdp-artifact-item__chip">
                            {artifact.file_size_bytes
                              ? `${(artifact.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                              : '0.00 MB'}
                          </span>
                        </div>
                      </div>
                      <button
                        className="rdp-artifact-item__dl"
                        onClick={() => handleDownloadArtifact(artifact.id, artifact.file_name)}
                        aria-label="Download"
                      >
                        <DownloadIcon />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Log Metadata tab */}
          {sectionTab === 3 && (
            <div>
              <LogMetadata runId={parseInt(runId || '0')} onUpdate={handleMetadataUpdate} />
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <EditRunDialog
        open={editDialogOpen}
        run={run}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        run={run}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
      />

      {runId && (
        <UploadArtifactsDialog
          open={uploadArtifactsDialogOpen}
          runId={parseInt(runId)}
          onClose={() => setUploadArtifactsDialogOpen(false)}
          onSuccess={async () => {
            const artifactsData = await apiClient.getRunArtifacts(parseInt(runId));
            setArtifacts(artifactsData);
          }}
        />
      )}
    </div>
  );
};

/* Inline SVG icon components */
function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M7 2v7M7 9L4.5 6.5M7 9l2.5-2.5M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M8.5 2.5l3 3L4.5 12.5H1.5v-3l7-7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M2 4h10M5 4V2.5h4V4M3.5 4v8h7V4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M7 9V2M7 2L4.5 4.5M7 2l2.5 2.5M2 11h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
