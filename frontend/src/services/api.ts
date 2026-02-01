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

  async downloadArtifact(artifactId: number): Promise<Blob> {
    const response = await this.client.get(`/artifacts/${artifactId}/download`, {
      responseType: 'blob',
    });
    return response.data;
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
    metadata: { projectName: string; runName: string; description?: string },
    onProgress?: (progress: number) => void
  ): Promise<{ run_id: number; status: string; message: string }> {
    const formData = new FormData();

    formData.append('project_name', metadata.projectName);
    formData.append('run_name', metadata.runName);
    if (metadata.description) {
      formData.append('description', metadata.description);
    }

    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await this.client.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 300000, // 5 minutes
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
