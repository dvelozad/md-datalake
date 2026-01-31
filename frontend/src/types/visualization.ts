export interface VisualizationSession {
  id: number;
  session_id: string;
  simulation_run_id: number;
  created_at: string;
  expires_at: string;
  last_accessed_at: string;
  mdserv_port: number;
  status: 'initializing' | 'active' | 'expired' | 'error';
  config: Record<string, unknown>;
  access_token?: string;
}

export interface CreateSessionResponse {
  session_id: string;
  mdserv_url: string;
  expires_at: string;
  session: VisualizationSession;
}

export interface SimulationRun {
  id: number;
  run_name: string;
  ensemble: string;
  temperature_target?: number;
  pressure_target?: number;
  timestep: number;
  n_steps: number;
  total_time: number;
  engine: {
    name: string;
    version: string;
  };
  system: {
    n_atoms: number;
    composition: string;
  };
  created_at: string;
}

export interface Artifact {
  id: number;
  simulation_run_id: number;
  artifact_type: string;
  file_path: string;
  original_path: string;
  checksum_sha256: string;
  size_bytes: number;
  frame_count?: number;
  output_frequency?: number;
  trajectory_metadata?: {
    format: string;
    n_atoms: number;
    n_frames: number;
    time_step: number;
  };
}

export interface Observable {
  id: number;
  simulation_run_id: number;
  observable_type: string;
  time_series: number[];
  values: number[];
  units: string;
  metadata?: Record<string, unknown>;
}

export interface RunFilters {
  project_id?: number;
  ensemble?: string;
  min_temperature?: number;
  max_temperature?: number;
  min_pressure?: number;
  max_pressure?: number;
  engine_name?: string;
  composition?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface RunListResponse {
  runs: SimulationRun[];
  total: number;
  limit: number;
  offset: number;
}

export interface TrajectoryFrame {
  index: number;
  time: number;
  positions: Float32Array;
}

export interface RepresentationType {
  value: string;
  label: string;
  description: string;
}

export const REPRESENTATION_TYPES: RepresentationType[] = [
  { value: 'ball+stick', label: 'Ball & Stick', description: 'Classic ball and stick model' },
  { value: 'cartoon', label: 'Cartoon', description: 'Cartoon representation for proteins' },
  { value: 'surface', label: 'Surface', description: 'Molecular surface' },
  { value: 'spacefill', label: 'Spacefill', description: 'Van der Waals spheres' },
  { value: 'licorice', label: 'Licorice', description: 'Stick model' },
  { value: 'line', label: 'Line', description: 'Simple line representation' },
  { value: 'point', label: 'Point', description: 'Point cloud' },
];

export interface MeasurementTool {
  type: 'distance' | 'angle' | 'dihedral';
  atoms: number[];
  value: number;
  label: string;
}
