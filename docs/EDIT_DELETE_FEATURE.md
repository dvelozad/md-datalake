# Edit and Delete Simulation Runs Feature

## Overview

Users can now edit and delete simulation runs directly from the run detail page. This provides better data management and allows correcting metadata or removing unwanted runs.

## Features

### Edit Run
- **Edit run name**: Update the simulation run name
- **Edit description**: Add or modify the run description
- **Validation**: Run name is required
- **Real-time updates**: Changes reflect immediately in the UI

### Delete Run
- **Confirmation dialog**: Prevents accidental deletions
- **Cascade delete**: Automatically removes all associated data:
  - Artifacts (trajectory files, topologies, logs)
  - Observables (temperature, pressure, energy data)
  - Visualization sessions
  - System and engine information
- **Navigation**: Redirects to main browser after deletion
- **Warning**: Clear indication that deletion is permanent

## User Interface

### Run Detail Page Header

The run detail page now includes two action buttons in the header:

```
┌─────────────────────────────────────────────────────────┐
│  Run Name                              [Edit]  [Delete] │
│  Description text...                                    │
└─────────────────────────────────────────────────────────┘
```

### Edit Dialog

When clicking **Edit**:
1. Dialog opens with current values pre-filled
2. User can modify:
   - **Run Name** (required field)
   - **Description** (optional field)
3. Click **Save** to update
4. Click **Cancel** to discard changes

### Delete Dialog

When clicking **Delete**:
1. Confirmation dialog appears with warning
2. Shows what will be deleted:
   - Run name and ID
   - List of affected data (artifacts, observables, etc.)
3. User must confirm with **Delete Permanently** button
4. Click **Cancel** to abort

## API Endpoints

### Update Run

**Endpoint**: `PATCH /api/v1/runs/{run_id}`

**Request Body**:
```json
{
  "run_name": "New Run Name",
  "description": "Updated description"
}
```

**Response** (200 OK):
```json
{
  "id": 123,
  "run_name": "New Run Name",
  "description": "Updated description",
  "message": "Run updated successfully"
}
```

**Errors**:
- **404**: Run not found
- **422**: Validation error (e.g., empty run name)

**Example with curl**:
```bash
curl -X PATCH http://localhost:8080/api/v1/runs/123 \
  -H "Content-Type: application/json" \
  -d '{
    "run_name": "Updated Run Name",
    "description": "New description"
  }'
```

**Example with Python**:
```python
import requests

url = "http://localhost:8080/api/v1/runs/123"
data = {
    "run_name": "Updated Run Name",
    "description": "New description"
}

response = requests.patch(url, json=data)
print(response.json())
```

### Delete Run

**Endpoint**: `DELETE /api/v1/runs/{run_id}`

**Response** (200 OK):
```json
{
  "id": 123,
  "status": "deleted",
  "message": "Run 123 and all associated data deleted successfully"
}
```

**Errors**:
- **404**: Run not found

**Example with curl**:
```bash
curl -X DELETE http://localhost:8080/api/v1/runs/123
```

**Example with Python**:
```python
import requests

url = "http://localhost:8080/api/v1/runs/123"
response = requests.delete(url)
print(response.json())
```

## Usage

### Web Interface

1. **Navigate to run detail page**:
   - Click on any simulation run from the main browser
   - Or go directly to `/runs/{run_id}`

2. **Edit a run**:
   - Click the **Edit** button in the header
   - Modify run name and/or description
   - Click **Save**
   - Changes appear immediately

3. **Delete a run**:
   - Click the **Delete** button in the header
   - Review the confirmation dialog
   - Click **Delete Permanently** to confirm
   - Automatically redirected to main browser

### Programmatic Access

#### Update via API
```python
from mddatalake.api.client import APIClient

client = APIClient()

# Update run
result = client.update_run(
    run_id=123,
    run_name="New Name",
    description="Updated description"
)
print(f"Updated: {result['message']}")
```

#### Delete via API
```python
from mddatalake.api.client import APIClient

client = APIClient()

# Delete run
result = client.delete_run(run_id=123)
print(f"Deleted: {result['message']}")
```

## What Can Be Edited

### Editable Fields
- ✅ **Run Name**: Can be changed at any time
- ✅ **Description**: Can be added, modified, or removed

### Non-Editable Fields
- ❌ **Ensemble**: Determined from simulation data
- ❌ **Temperature/Pressure**: Extracted from log files
- ❌ **Timestep/Steps**: From simulation parameters
- ❌ **Engine/System**: From trajectory and topology files
- ❌ **Observables**: From log file parsing
- ❌ **Completeness Score**: Calculated automatically

**Why?** These fields are derived from the actual simulation files. To change them, you would need to re-upload the simulation with different files.

## What Gets Deleted

When deleting a run, the following data is permanently removed:

### Cascade Deletes
1. **Artifacts**:
   - Trajectory files
   - Topology files
   - Input scripts
   - Log files
   - All uploaded files

2. **Observables**:
   - Temperature time series
   - Pressure time series
   - Energy time series
   - All computed observables

3. **Visualization Sessions**:
   - All active visualization sessions
   - Cached preview images
   - Session data

4. **Related Records**:
   - System information
   - Engine information
   - Data quality flags
   - Completeness tracking

### Not Deleted
- Project information (if other runs use the same project)
- User account data
- Database schema

## Safety Features

### Edit Safety
- **Validation**: Run name cannot be empty
- **Preview**: See current values before changing
- **Cancel**: Easy to abort changes
- **No data loss**: Editing metadata doesn't affect simulation files

### Delete Safety
- **Confirmation required**: Cannot delete with single click
- **Visual warnings**: Red error alerts and warning icons
- **Detailed information**: Shows exactly what will be deleted
- **List of consequences**: Clear enumeration of affected data
- **Two-step process**: Must click Delete button, then confirm in dialog

### Error Handling
- **Network errors**: Clear error messages
- **Permission errors**: Handled gracefully
- **Not found errors**: Informative 404 messages
- **Validation errors**: User-friendly feedback

## Database Considerations

### Update Operation
- Uses `PATCH` (partial update) not `PUT` (full replace)
- Only specified fields are updated
- Atomic transaction (all-or-nothing)
- Optimistic locking prevents conflicts

### Delete Operation
- Database cascade rules automatically remove related records
- Foreign key constraints ensure data integrity
- Transaction-based (rollback on error)
- No orphaned records left behind

### Cascade Configuration
Ensure database models have proper cascade delete configured:

```python
# In SimulationRun model
artifacts = relationship("Artifact", back_populates="run", cascade="all, delete-orphan")
observables = relationship("Observable", back_populates="run", cascade="all, delete-orphan")
```

## Testing

### Manual Testing - Edit

1. Navigate to run detail page
2. Click **Edit** button
3. Change run name to "Test Edit"
4. Change description to "Testing edit feature"
5. Click **Save**
6. Verify changes appear immediately
7. Refresh page - changes should persist
8. Check database - run record should be updated

### Manual Testing - Delete

1. Navigate to run detail page
2. Click **Delete** button
3. Verify warning dialog appears
4. Verify run information is displayed
5. Verify list of consequences is shown
6. Click **Cancel** - dialog closes, nothing deleted
7. Click **Delete** again
8. Click **Delete Permanently**
9. Verify redirect to main browser
10. Verify run no longer appears in list
11. Try to access run directly - should get 404
12. Check database - run and related records removed

### API Testing - Update

```bash
# Test successful update
curl -X PATCH http://localhost:8080/api/v1/runs/1 \
  -H "Content-Type: application/json" \
  -d '{"run_name": "Updated Name"}'

# Test validation error (empty name)
curl -X PATCH http://localhost:8080/api/v1/runs/1 \
  -H "Content-Type: application/json" \
  -d '{"run_name": ""}'

# Test not found
curl -X PATCH http://localhost:8080/api/v1/runs/99999 \
  -H "Content-Type: application/json" \
  -d '{"run_name": "Test"}'
```

### API Testing - Delete

```bash
# Test successful delete
curl -X DELETE http://localhost:8080/api/v1/runs/1

# Test not found
curl -X DELETE http://localhost:8080/api/v1/runs/99999

# Verify cascade delete
# 1. Upload a simulation
# 2. Note the run_id
# 3. Delete the run
# 4. Query artifacts table - should be empty for that run_id
```

## Architecture

### Backend
- **File**: `src/mddatalake/api/routes/runs.py`
- **Endpoints**:
  - `PATCH /runs/{run_id}` - Update run
  - `DELETE /runs/{run_id}` - Delete run
- **Model**: `UpdateRunRequest` - Pydantic model for validation
- **Database**: SQLAlchemy ORM with cascade deletes

### Frontend
- **Components**:
  - `EditRunDialog.tsx` - Edit dialog with form
  - `DeleteConfirmDialog.tsx` - Delete confirmation dialog
  - `RunDetailPage.tsx` - Updated with buttons and dialogs
- **API Client**: `api.ts` - Methods for update and delete
- **Types**: `visualization.ts` - TypeScript interfaces

### Data Flow

**Edit Flow**:
```
User clicks Edit
  → EditRunDialog opens
  → User modifies fields
  → Click Save
  → apiClient.updateRun()
  → PATCH /api/v1/runs/{id}
  → Database update
  → Success response
  → Update local state
  → Dialog closes
  → UI reflects changes
```

**Delete Flow**:
```
User clicks Delete
  → DeleteConfirmDialog opens
  → User reads warning
  → Click Delete Permanently
  → apiClient.deleteRun()
  → DELETE /api/v1/runs/{id}
  → Database cascade delete
  → Success response
  → Navigate to main browser
  → Run removed from list
```

## Future Enhancements

### Possible Improvements
1. **Bulk edit**: Edit multiple runs at once
2. **Edit history**: Track changes to run metadata
3. **Undo delete**: Soft delete with recovery option
4. **Archive**: Move runs to archive instead of delete
5. **Export before delete**: Automatic backup before deletion
6. **Batch delete**: Delete multiple runs at once
7. **Advanced validation**: Prevent deleting runs used in analyses
8. **Permissions**: Role-based access control for edit/delete

### Current Limitations
- Cannot edit simulation parameters (derived from files)
- No undo for deletions
- No audit trail for edits
- No bulk operations

## Troubleshooting

### Edit button doesn't work
- Check browser console for errors
- Verify API endpoint is accessible
- Check backend server is running

### Delete confirmation doesn't appear
- Check if DeleteConfirmDialog component is imported
- Verify dialog state management
- Check browser console for React errors

### Updates don't persist
- Check database connection
- Verify transaction commits
- Check for validation errors in backend logs

### Cascade delete fails
- Check database foreign key constraints
- Verify cascade rules in SQLAlchemy models
- Check database logs for constraint violations

## Related Documentation

- [API Documentation](http://localhost:8080/docs)
- [Upload Feature](./UPLOAD_FEATURE.md)
- [Data Completeness](./DATA_SCENARIO_FEATURE_README.md)
