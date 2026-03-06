import axios, { AxiosInstance } from 'axios';
import type {
  CreateSessionResponse,
  SimulationRun,
  Artifact,
  Observable,
  RunFilters,
  RunListResponse,
  VisualizationSession,
  CompletenessInfo,
  UploadResponse,
  UploadMetadata,
} from '@/types/visualization';

class APIClient {
  private client: AxiosInstance;

  constructor(baseURL: string = '/api/v1') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Health check
  async health(): Promise<{ status: string; database: string; storage: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }

  // Simulation runs
  async listRuns(filters?: RunFilters): Promise<RunListResponse> {
    const response = await this.client.get('/runs', { params: filters });
    return response.data;
  }

  async getRun(runId: number): Promise<SimulationRun> {
    const response = await this.client.get(`/runs/${runId}`);
    return response.data;
  }

  async getRunArtifacts(runId: number): Promise<Artifact[]> {
    const response = await this.client.get(`/runs/${runId}/artifacts`);
    return response.data.artifacts;
  }

  async getRunObservables(runId: number): Promise<Observable[]> {
    const response = await this.client.get(`/runs/${runId}/observables`);
    return response.data;
  }

  // Artifacts
  async getArtifact(artifactId: number): Promise<Artifact> {
    const response = await this.client.get(`/artifacts/${artifactId}`);
    return response.data;
  }

  async downloadArtifact(runId: number, artifactId: number, fileName: string): Promise<void> {
    const response = await this.client.get(
      `/runs/${runId}/artifacts/${artifactId}/download`,
      {
        responseType: 'blob',
      }
    );

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async downloadAllArtifacts(runId: number, runName: string): Promise<void> {
    const response = await this.client.get(`/runs/${runId}/artifacts/download-all`, {
      responseType: 'blob',
      timeout: 120000, // 2 minutes for large zip files
    });

    // Create download link
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `run_${runId}_${runName}_artifacts.zip`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  // Visualization sessions
  async createVisualizationSession(
    runId: number,
    config?: Record<string, unknown>
  ): Promise<CreateSessionResponse> {
    const response = await this.client.post(`/runs/${runId}/visualizations`, { config });
    return response.data;
  }

  async getVisualizationSession(sessionId: string): Promise<VisualizationSession> {
    const response = await this.client.get(`/visualizations/${sessionId}`);
    return response.data;
  }

  async terminateVisualizationSession(sessionId: string): Promise<void> {
    await this.client.delete(`/visualizations/${sessionId}`);
  }

  async getTrajectoryMetadata(runId: number): Promise<{
    frame_count: number;
    n_atoms: number;
    time_step: number;
    format: string;
  }> {
    const response = await this.client.get(`/runs/${runId}/trajectory/metadata`);
    return response.data;
  }

  async getTopology(runId: number): Promise<{
    atoms: Array<{ element: string; residue?: string; chain?: string }>;
    bonds?: Array<[number, number]>;
  }> {
    const response = await this.client.get(`/runs/${runId}/topology`);
    return response.data;
  }

  async generateThumbnail(runId: number): Promise<{ thumbnail_url: string }> {
    const response = await this.client.post(`/runs/${runId}/thumbnail`);
    return response.data;
  }

  // Data completeness
  async getRunCompleteness(runId: number): Promise<CompletenessInfo> {
    const response = await this.client.get(`/runs/${runId}/completeness`);
    return response.data;
  }

  async getIncompleteRuns(maxScore: number = 90, limit: number = 50): Promise<CompletenessInfo[]> {
    const response = await this.client.get('/runs/incomplete', {
      params: { max_score: maxScore, limit },
    });
    return response.data;
  }

  async getCompletenessStatistics(): Promise<{
    total_runs: number;
    complete_runs: number;
    incomplete_runs: number;
    average_score: number;
    score_distribution: Record<string, number>;
  }> {
    const response = await this.client.get('/runs/statistics/completeness');
    return response.data;
  }

  // Upload trajectory
  async uploadTrajectory(
    files: File[],
    metadata: UploadMetadata,
    artifactTypes: Record<string, string>,
    onProgress?: (progress: number) => void
  ): Promise<UploadResponse> {
    const formData = new FormData();

    formData.append('project_name', metadata.projectName);
    formData.append('run_name', metadata.runName);
    if (metadata.description) {
      formData.append('description', metadata.description);
    }
    if (metadata.atomStyle) {
      formData.append('atom_style', metadata.atomStyle);
    }
    if (metadata.simulationMethod) {
      formData.append('simulation_method', metadata.simulationMethod);
    }
    if (metadata.ensemble) {
      formData.append('ensemble', metadata.ensemble);
    }
    if (metadata.temperatureTarget !== undefined) {
      formData.append('temperature_target', metadata.temperatureTarget.toString());
    }
    if (metadata.pressureTarget !== undefined) {
      formData.append('pressure_target', metadata.pressureTarget.toString());
    }

    // Send artifact types as JSON if any are manually set
    if (Object.keys(artifactTypes).length > 0) {
      formData.append('artifact_types', JSON.stringify(artifactTypes));
    }

    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await this.client.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 1800000, // 30 minutes
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  }

  // Update run
  async updateRun(
    runId: number,
    data: { run_name?: string; description?: string }
  ): Promise<{ id: number; run_name: string; description: string; message: string }> {
    const response = await this.client.patch(`/runs/${runId}`, data);
    return response.data;
  }

  // Delete run
  async deleteRun(runId: number): Promise<{ id: number; status: string; message: string }> {
    const response = await this.client.delete(`/runs/${runId}`);
    return response.data;
  }

  // Get available observables for plotting
  async getAvailableObservables(
    runId: number
  ): Promise<{ available: boolean; columns: string[]; engine: string; message: string }> {
    const response = await this.client.get(`/runs/${runId}/available-observables`);
    return response.data;
  }

  // Get plot data for observables
  async getPlotData(
    runId: number,
    observables?: string[]
  ): Promise<{
    columns: string[];
    data: Record<string, number[]>;
    units: Record<string, string>;
    engine: string;
    n_points: number;
  }> {
    const params = observables ? { observables } : {};
    const response = await this.client.get(`/runs/${runId}/plot-data`, { params });
    return response.data;
  }

  // Get metadata from log file
  async getLogMetadata(
    runId: number
  ): Promise<{
    engine: string;
    extracted_metadata: {
      units: string | null;
      timestep: number | null;
      first_step: number | null;
      last_step: number | null;
      n_steps: number | null;
      simulation_time: number | null;
    };
    can_update_run: boolean;
    message: string;
  }> {
    const response = await this.client.get(`/runs/${runId}/log-metadata`);
    return response.data;
  }

  // Update run metadata from log file
  async updateRunFromLog(
    runId: number
  ): Promise<{
    run_id: number;
    updated_fields: string[];
    metadata: any;
    message: string;
  }> {
    const response = await this.client.post(`/runs/${runId}/update-from-log`);
    return response.data;
  }

  // Upload additional artifacts to existing run
  async uploadArtifacts(
    runId: number,
    files: File[],
    artifactTypes?: Record<string, string>,
    onProgress?: (progress: number) => void
  ): Promise<{
    run_id: number;
    uploaded_count: number;
    skipped_count: number;
    artifacts: Array<{
      filename: string;
      artifact_type?: string;
      file_size_bytes?: number;
      status: string;
      message?: string;
    }>;
    message: string;
  }> {
    const formData = new FormData();

    files.forEach(file => {
      formData.append('files', file);
    });

    if (artifactTypes) {
      formData.append('artifact_types', JSON.stringify(artifactTypes));
    }

    const response = await this.client.post(`/runs/${runId}/artifacts/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 1800000, // 30 minutes
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });

    return response.data;
  }
}

export const apiClient = new APIClient();
export default apiClient;
