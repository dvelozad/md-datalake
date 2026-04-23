import React from 'react';
import { TextField, Stack, Typography, FormControl, InputLabel, Select, MenuItem, FormHelperText, Alert } from '@mui/material';
import type { UploadMetadata } from '@/types/visualization';

interface UploadMetadataFormProps {
  metadata: UploadMetadata;
  onChange: (metadata: UploadMetadata) => void;
  disabled?: boolean;
  files?: File[];  // To detect engine type
}

const LAMMPS_ATOM_STYLES = [
  { value: 'atomic', label: 'Atomic - no bonds (id, type, x, y, z)' },
  { value: 'bond', label: 'Bond - simple bonds (id, mol, type, x, y, z)' },
  { value: 'angle', label: 'Angle - bonds and angles' },
  { value: 'molecular', label: 'Molecular - full molecule info' },
  { value: 'full', label: 'Full - charges and bonds (id, mol, type, q, x, y, z)' },
  { value: 'charge', label: 'Charge - no bonds, with charge' },
  { value: 'dipole', label: 'Dipole - point dipoles' },
  { value: 'sphere', label: 'Sphere - granular spheres' },
  { value: 'ellipsoid', label: 'Ellipsoid - aspherical particles' },
  { value: 'full/gc/HAdResS', label: 'Full/GC/HAdResS - Hybrid AdResS (id, mol, type, q, replambdaH, moltypeH, reservoirH, x, y, z)' },
];

const SIMULATION_METHODS = [
  { value: 'ATOMISTIC', label: 'Atomistic' },
  { value: 'H_ADRESS', label: 'H-AdResS (Hybrid Adaptive Resolution)' },
];

const ENSEMBLE_TYPES = [
  { value: 'NVE', label: 'NVE (Microcanonical)' },
  { value: 'NVT', label: 'NVT (Canonical)' },
  { value: 'NPT', label: 'NPT (Isothermal-Isobaric)' },
  { value: 'NPH', label: 'NPH (Isenthalpic)' },
  { value: 'MUVT', label: 'muVT (Grand Canonical)' },
  { value: 'NVT_NVE', label: 'NVT_NVE (Equilibration + Production)' },
];

export const UploadMetadataForm: React.FC<UploadMetadataFormProps> = ({
  metadata,
  onChange,
  disabled,
  files,
}) => {
  // Detect if files include LAMMPS formats
  const hasLammpsFiles = files?.some(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.dump') ||
           name.endsWith('.lammpstrj') ||
           name.endsWith('.data') ||
           name.includes('data.') ||
           name.startsWith('in.');
  });

  // Check if trajectory file present (requires atom style)
  const hasTrajectory = files?.some(f => {
    const name = f.name.toLowerCase();
    return name.endsWith('.dump') || name.endsWith('.lammpstrj');
  });

  const atomStyleRequired = hasLammpsFiles && hasTrajectory;

  return (
    <Stack spacing={2}>
      <TextField
        label="Project Name"
        required
        fullWidth
        value={metadata.projectName}
        onChange={(e) => onChange({ ...metadata, projectName: e.target.value })}
        disabled={disabled}
        helperText="Name of the project this simulation belongs to"
      />
      <TextField
        label="Run Name"
        required
        fullWidth
        value={metadata.runName}
        onChange={(e) => onChange({ ...metadata, runName: e.target.value })}
        disabled={disabled}
        helperText="Unique name for this simulation run"
      />
      <TextField
        label="Description"
        multiline
        rows={3}
        fullWidth
        value={metadata.description || ''}
        onChange={(e) => onChange({ ...metadata, description: e.target.value })}
        disabled={disabled}
        helperText="Optional description of the simulation"
      />

      <FormControl fullWidth disabled={disabled}>
        <InputLabel>Simulation Method</InputLabel>
        <Select
          value={metadata.simulationMethod || ''}
          label="Simulation Method"
          onChange={(e) => onChange({ ...metadata, simulationMethod: e.target.value })}
        >
          <MenuItem value="">
            <em>Select method...</em>
          </MenuItem>
          {SIMULATION_METHODS.map(method => (
            <MenuItem key={method.value} value={method.value}>
              {method.label}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Type of simulation method (e.g., Atomistic, H-AdResS)
        </FormHelperText>
      </FormControl>

      <FormControl fullWidth disabled={disabled}>
        <InputLabel>Ensemble Type</InputLabel>
        <Select
          value={metadata.ensemble || ''}
          label="Ensemble Type"
          onChange={(e) => onChange({ ...metadata, ensemble: e.target.value })}
        >
          <MenuItem value="">
            <em>Select ensemble...</em>
          </MenuItem>
          {ENSEMBLE_TYPES.map(ensemble => (
            <MenuItem key={ensemble.value} value={ensemble.value}>
              {ensemble.label}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>
          Statistical ensemble used in simulation
        </FormHelperText>
      </FormControl>

      <Stack direction="row" spacing={2}>
        <TextField
          label="Temperature (K)"
          type="number"
          fullWidth
          value={metadata.temperatureTarget || ''}
          onChange={(e) => onChange({ ...metadata, temperatureTarget: e.target.value ? parseFloat(e.target.value) : undefined })}
          disabled={disabled}
          helperText="Target temperature in Kelvin"
          inputProps={{ step: 0.1, min: 0 }}
        />
        <TextField
          label="Pressure (atm)"
          type="number"
          fullWidth
          value={metadata.pressureTarget || ''}
          onChange={(e) => onChange({ ...metadata, pressureTarget: e.target.value ? parseFloat(e.target.value) : undefined })}
          disabled={disabled}
          helperText="Target pressure in atmospheres"
          inputProps={{ step: 0.1, min: 0 }}
        />
      </Stack>

      {hasLammpsFiles && (
        <>
          {atomStyleRequired && (
            <Alert severity="info" sx={{ mb: 1 }}>
              LAMMPS atom style is required for trajectory visualization. This defines the column format in your data file.
            </Alert>
          )}
          <FormControl fullWidth required={atomStyleRequired} disabled={disabled}>
            <InputLabel>LAMMPS Atom Style</InputLabel>
            <Select
              value={metadata.atomStyle || ''}
              label="LAMMPS Atom Style"
              onChange={(e) => onChange({ ...metadata, atomStyle: e.target.value })}
            >
              <MenuItem value="">
                <em>Select atom style...</em>
              </MenuItem>
              {LAMMPS_ATOM_STYLES.map(style => (
                <MenuItem key={style.value} value={style.value}>
                  {style.label}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              {atomStyleRequired
                ? 'Required: Specifies the column format in your LAMMPS data file'
                : 'Specifies the column format in your LAMMPS data file (if applicable)'
              }
            </FormHelperText>
          </FormControl>
        </>
      )}

      {/* HPC / SLURM (optional) */}
      <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
        HPC / SLURM (Optional)
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="SLURM Job ID"
          fullWidth
          disabled={disabled}
          value={metadata.slurmJobId || ''}
          onChange={(e) => onChange({ ...metadata, slurmJobId: e.target.value || undefined })}
          helperText="e.g. 12345678"
          size="small"
        />
        <TextField
          label="Compute Node"
          fullWidth
          disabled={disabled}
          value={metadata.computeNode || ''}
          onChange={(e) => onChange({ ...metadata, computeNode: e.target.value || undefined })}
          helperText="e.g. cn001"
          size="small"
        />
      </Stack>
    </Stack>
  );
};
