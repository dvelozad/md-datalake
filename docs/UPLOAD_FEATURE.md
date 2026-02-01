# Web-Based Trajectory Upload Feature

## Overview

The web-based upload feature allows users to upload MD simulation data (LAMMPS and GROMACS) directly through the browser interface without requiring CLI access.

## Features

- **Drag-and-drop interface** for easy file selection
- **Multi-file upload** supporting trajectories, topologies, logs, and input scripts
- **Automatic MD engine detection** (LAMMPS vs GROMACS)
- **Real-time progress tracking** with upload percentage
- **File validation** for type and size
- **Metadata capture** (project name, run name, description)
- **Automatic ingestion** through existing pipeline

## Supported File Formats

### LAMMPS
- **Trajectories**: `.dump`, `.lammpstrj`, `.dcd`
- **Topology**: `.data`, `.lmp`
- **Input Scripts**: `in.*`, `.in`, `.lammps`
- **Logs**: `log.*`, `.log`, `.txt`, `.out`

### GROMACS
- **Trajectories**: `.xtc`, `.trr`, `.dcd`
- **Topology**: `.top`, `.gro`, `.pdb`, `.psf`
- **Input Scripts**: `.mdp`
- **Other**: `.tpr`, `.edr`

## Usage

### Web Interface

1. Navigate to the main simulation runs page
2. Click the **"Upload Trajectory"** button in the header
3. **Select files**:
   - Drag and drop files onto the dropzone, OR
   - Click the dropzone to browse and select files
   - You can add multiple files at once or incrementally
4. **Review files**: Selected files appear in a list showing:
   - File name
   - File size
   - File type (Trajectory, Topology, Input, Log, etc.)
   - Remove option
5. **Enter metadata**:
   - **Project Name** (required): Name of the project
   - **Run Name** (required): Unique name for this simulation
   - **Description** (optional): Additional details
6. Click **"Upload"** to start the upload
7. Monitor the progress bar during upload
8. On success, click **"View Run"** to see the ingested data

### API Endpoint

**Endpoint**: `POST /api/v1/upload`

**Content-Type**: `multipart/form-data`

**Form Fields**:
- `project_name` (string, required): Project name
- `run_name` (string, required): Run name
- `description` (string, optional): Description
- `files` (array of files, required): Uploaded files

**Example with curl**:

```bash
# LAMMPS upload
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=my_project" \
  -F "run_name=nvt_equilibration" \
  -F "description=NVT equilibration at 300K" \
  -F "files=@trajectory.dump" \
  -F "files=@data.lammps" \
  -F "files=@in.lammps" \
  -F "files=@log.lammps"

# GROMACS upload
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=my_project" \
  -F "run_name=md_production" \
  -F "description=Production MD run" \
  -F "files=@traj.xtc" \
  -F "files=@conf.gro" \
  -F "files=@topol.top" \
  -F "files=@md.mdp"
```

**Success Response** (200 OK):
```json
{
  "run_id": 123,
  "status": "success",
  "message": "Successfully uploaded and ingested LAMMPS run 123",
  "files_count": 4,
  "total_size_mb": 45.67,
  "engine": "LAMMPS"
}
```

**Error Responses**:

- **422 Unprocessable Entity**: Validation errors
  - No files provided
  - Invalid file types
  - Cannot detect MD engine
  - File size exceeds limit
- **400 Bad Request**: Ingestion errors
  - File format errors
  - Missing required data

## File Validation

### Extension Validation

Only allowed file extensions are accepted. Invalid extensions return a 422 error with the list of allowed extensions.

### Size Validation

Maximum file size: **5GB per file**

Files exceeding this limit will be rejected with a 422 error.

### MD Engine Detection

After upload, the system validates that files form a valid simulation directory:
- LAMMPS: Requires trajectory OR data file
- GROMACS: Requires trajectory OR topology file

If validation fails, a 422 error is returned explaining what's missing.

## Backend Architecture

### Upload Flow

1. **File Reception**: FastAPI receives multipart form data
2. **Validation**: Check file extensions and sizes
3. **Temporary Storage**: Save files to temporary directory
4. **Engine Detection**: Detect LAMMPS vs GROMACS
5. **Ingestion**: Call `IngestionService.ingest()` with temp directory
6. **Cleanup**: Remove temporary directory (always runs)

### Code Structure

**Backend**:
- `src/mddatalake/api/routes/upload.py`: Upload endpoint
- Uses existing `IngestionService` (no code duplication)
- Registered in `src/mddatalake/api/main.py`

**Frontend**:
- `frontend/src/pages/UploadPage.tsx`: Main upload page
- `frontend/src/components/upload/`:
  - `UploadDropzone.tsx`: Drag-and-drop file selector
  - `FileList.tsx`: Display selected files
  - `UploadMetadataForm.tsx`: Metadata input form
  - `UploadProgress.tsx`: Progress indicator
- `frontend/src/services/api.ts`: API client method
- Route: `/upload` in `App.tsx`

## Testing

### Manual Testing

#### Test Backend

1. Start the backend server:
```bash
poetry run uvicorn mddatalake.api.main:app --reload --host 0.0.0.0 --port 8080
```

2. Run the test script:
```bash
/tmp/claude-1000/-home-deo-Documents-projects-md-datalake/ad4c1ee0-e799-4dca-8a91-fb8171667efb/scratchpad/test_upload.sh
```

3. Check the OpenAPI docs at http://localhost:8080/docs and test the `/api/v1/upload` endpoint

#### Test Frontend

1. Start the frontend dev server:
```bash
cd frontend
npm run dev
```

2. Navigate to http://localhost:3000

3. Click "Upload Trajectory" button

4. Test the upload workflow:
   - [ ] Drag and drop files
   - [ ] Click to browse files
   - [ ] Add multiple files
   - [ ] Remove files from list
   - [ ] Fill metadata form
   - [ ] Submit upload
   - [ ] Monitor progress
   - [ ] View uploaded run

### Automated Testing

**Type checking**:
```bash
cd frontend
npm run type-check
```

**Backend import test**:
```bash
poetry run python -c "from mddatalake.api.routes import upload; print('OK')"
```

### Test Scenarios

1. **Valid LAMMPS Upload**:
   - Files: trajectory.dump, data.lammps, in.lammps, log.lammps
   - Expected: Success, run created

2. **Valid GROMACS Upload**:
   - Files: traj.xtc, conf.gro, topol.top
   - Expected: Success, run created

3. **Minimal Upload**:
   - Files: trajectory.dump only
   - Expected: Success, lower completeness score

4. **Invalid File Type**:
   - Files: document.pdf
   - Expected: 422 error

5. **No Files**:
   - Expected: 422 error

6. **Missing Metadata**:
   - No project_name or run_name
   - Expected: Frontend validation, cannot submit

## Configuration

### File Size Limit

Default: 5GB per file

To change, edit `MAX_FILE_SIZE_MB` in `src/mddatalake/api/routes/upload.py`:

```python
MAX_FILE_SIZE_MB = 5000  # Change this value
```

### Timeout

Default: 5 minutes (300 seconds)

To change, edit timeout in `frontend/src/services/api.ts`:

```typescript
timeout: 300000,  // Change this value (milliseconds)
```

### Allowed Extensions

To add/remove allowed file extensions, edit `ALLOWED_EXTENSIONS` in `src/mddatalake/api/routes/upload.py`:

```python
ALLOWED_EXTENSIONS = {
    ".dcd", ".xtc", ".trr", ".dump", ".lammpstrj",  # Trajectories
    ".pdb", ".gro", ".data", ".top", ".psf",        # Topology
    ".in", ".mdp", ".lammps",                       # Input scripts
    ".log", ".txt", ".out", ".tpr", ".edr",         # Logs & other
    # Add custom extensions here
}
```

## Error Handling

### Backend Errors

All errors are properly caught and returned as HTTP exceptions:
- **422**: Validation errors (user-fixable)
- **400**: Processing errors (file/format issues)

Temporary directories are **always** cleaned up, even on error.

### Frontend Errors

Errors are displayed as alerts with user-friendly messages:
- Network errors
- Validation errors
- Server errors

Users can dismiss errors and retry.

## Performance Considerations

### Upload Performance

- Files are streamed in 64KB chunks to avoid memory issues
- Progress tracking updates in real-time
- Large files (>1GB) may take several minutes

### Server Resources

- Each upload creates a temporary directory
- Temporary directories are cleaned up immediately after ingestion
- Concurrent uploads each get unique temp directories (no conflicts)

### Future Improvements

For very large files or slow connections:
- **Background task processing**: Use Celery/Redis for async ingestion
- **Chunked upload**: Resume interrupted uploads
- **Direct S3 upload**: Upload large files directly to object storage

## Security

### File Validation

- File extensions are validated
- File sizes are limited
- MD engine detection ensures files are valid simulations

### Uploaded File Storage

- Files are saved to temporary directories with unique names
- Temporary directories are cleaned up after processing
- Only ingested data persists to database and object storage

### Authentication

Currently the upload endpoint has no authentication. To add authentication:

1. Implement user authentication system
2. Add `Depends(get_current_user)` to the upload endpoint
3. Associate uploads with user accounts

## Troubleshooting

### Upload Fails with 422 Error

**Problem**: Invalid file type or missing required files

**Solution**:
- Check that file extensions are in the allowed list
- Ensure you have at least a trajectory OR topology file
- Verify files are not corrupted

### Upload Fails with 400 Error

**Problem**: File format or parsing error

**Solution**:
- Check that files are valid MD simulation files
- Verify file formats match their extensions
- Check server logs for detailed error messages

### Upload Freezes at 100%

**Problem**: Processing/ingestion is still running

**Solution**:
- Wait for processing to complete (may take 1-2 minutes for large files)
- Check server logs for progress
- Check database to see if run was created

### No Progress Updates

**Problem**: Network or timeout issue

**Solution**:
- Check server is running at correct port
- Check browser console for errors
- Verify CORS is configured correctly
- Try with smaller files first

## Examples

### Minimal LAMMPS Upload

```bash
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=water_sim" \
  -F "run_name=nvt_test" \
  -F "files=@dump.water"
```

### Complete LAMMPS Upload

```bash
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=water_sim" \
  -F "run_name=production_nvt" \
  -F "description=Production NVT at 300K with Nose-Hoover" \
  -F "files=@trajectory.dump" \
  -F "files=@water.data" \
  -F "files=@in.nvt" \
  -F "files=@log.lammps"
```

### Complete GROMACS Upload

```bash
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=protein_ligand" \
  -F "run_name=md_100ns" \
  -F "description=100ns production MD with AMBER" \
  -F "files=@md.xtc" \
  -F "files=@conf.gro" \
  -F "files=@topol.top" \
  -F "files=@md.mdp" \
  -F "files=@md.edr"
```

## Related Documentation

- [Ingestion Pipeline](../src/mddatalake/ingestion/README.md)
- [API Documentation](http://localhost:8080/docs)
- [Data Completeness](./DATA_SCENARIO_FEATURE_README.md)
