# Upload Feature Testing Checklist

## Pre-Testing Setup

### Backend Setup
```bash
# Navigate to project root
cd /home/deo/Documents/projects/md-datalake

# Start backend server
poetry run uvicorn mddatalake.api.main:app --reload --host 0.0.0.0 --port 8080
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd /home/deo/Documents/projects/md-datalake/frontend

# Install dependencies (if needed)
npm install

# Start development server
npm run dev
```

---

## Backend API Testing

### 1. Health Check
```bash
curl http://localhost:8080/health
```
**Expected**: `{"status":"healthy",...}`

### 2. Upload Endpoint Available
Open browser: http://localhost:8080/docs
- [ ] `/api/v1/upload` endpoint is listed
- [ ] Endpoint shows POST method
- [ ] Form parameters are documented

### 3. Test Invalid Upload (No Files)
```bash
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=test" \
  -F "run_name=test"
```
**Expected**: HTTP 422, error message "No files provided"

### 4. Test Invalid File Type
```bash
# Create a test file
echo "test" > /tmp/test.txt

curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=test" \
  -F "run_name=test" \
  -F "files=@/tmp/test.txt"
```
**Expected**: HTTP 422, error about invalid file type

### 5. Test Valid Upload (if sample data exists)
```bash
# Find a sample dump file
DUMP_FILE=$(find raw_data -name "*.dump" -o -name "*.lammpstrj" | head -1)

# Upload it
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=upload_test" \
  -F "run_name=test_$(date +%s)" \
  -F "description=Testing upload feature" \
  -F "files=@$DUMP_FILE"
```
**Expected**: HTTP 200, JSON with `run_id`

### 6. Verify Uploaded Run
```bash
# Use run_id from previous test
RUN_ID=<from previous response>

curl http://localhost:8080/api/v1/runs/$RUN_ID
```
**Expected**: Run details with matching project/run name

---

## Frontend UI Testing

### Navigation

- [ ] Navigate to http://localhost:3000
- [ ] Main page shows "Simulation Runs" header
- [ ] "Upload Trajectory" button is visible in header
- [ ] Click "Upload Trajectory" button
- [ ] URL changes to `/upload`

### Upload Page - Initial State

- [ ] Page title is "Upload Simulation Data"
- [ ] Stepper shows 3 steps: "Select Files", "Enter Metadata", "Upload"
- [ ] Active step is "Select Files"
- [ ] Dropzone is visible with cloud upload icon
- [ ] Dropzone text: "Upload Simulation Files"
- [ ] "Drag and drop files or click to browse" is visible
- [ ] Supported formats are listed
- [ ] File list shows "No files selected yet"
- [ ] Metadata form is visible but empty
- [ ] Upload button is disabled

### File Selection - Drag and Drop

- [ ] Drag a file over the dropzone
- [ ] Dropzone border changes color (blue)
- [ ] Dropzone background changes (hover effect)
- [ ] Drop the file
- [ ] File appears in the file list
- [ ] File name is displayed
- [ ] File size is shown (formatted: KB/MB/GB)
- [ ] File type badge is shown (Trajectory/Topology/Input/Log)
- [ ] Active step changes to "Enter Metadata"

### File Selection - Click to Browse

- [ ] Click on the dropzone
- [ ] File browser dialog opens
- [ ] Select one or more files
- [ ] Files appear in the file list
- [ ] Each file has correct icon
- [ ] Each file has correct type badge

### File List Management

- [ ] Add multiple files
- [ ] File count updates: "Selected Files (X)"
- [ ] Each file has a delete button
- [ ] Click delete button on a file
- [ ] File is removed from list
- [ ] Count updates
- [ ] Add files incrementally (drag, then click to add more)
- [ ] All files are shown

### File Type Detection

Test with these file types (if available):

- [ ] `.dump` file → Badge: "Trajectory"
- [ ] `.data` file → Badge: "Topology"
- [ ] `in.lammps` file → Badge: "Input"
- [ ] `log.lammps` file → Badge: "Log"
- [ ] `.xtc` file → Badge: "Trajectory"
- [ ] `.gro` file → Badge: "Topology"
- [ ] `.mdp` file → Badge: "Input"

### Metadata Form

- [ ] "Project Name" field is required (asterisk)
- [ ] "Run Name" field is required
- [ ] "Description" field is optional
- [ ] Helper text is shown for each field
- [ ] Type in project name
- [ ] Type in run name
- [ ] Type in description
- [ ] Form updates in real-time

### Form Validation

- [ ] Leave project name empty, click Upload
- [ ] Error message appears
- [ ] Fill project name, leave run name empty, click Upload
- [ ] Error message appears
- [ ] Fill both required fields
- [ ] Upload button becomes enabled

### Upload Process

- [ ] Select valid LAMMPS files (e.g., .dump)
- [ ] Fill metadata form completely
- [ ] Upload button is enabled
- [ ] Click "Upload" button
- [ ] Button shows "Uploading..."
- [ ] Button is disabled
- [ ] Progress bar appears
- [ ] Progress percentage is shown (0-100%)
- [ ] Active step changes to "Upload"
- [ ] Progress message: "Uploading files..."
- [ ] When at 100%: "Processing and ingesting data..."
- [ ] All form controls are disabled during upload

### Upload Success

- [ ] Green success alert appears
- [ ] Message: "Successfully uploaded and ingested simulation run!"
- [ ] Run ID is displayed
- [ ] "View Run" button is visible
- [ ] "Upload Another" button is visible
- [ ] Click "View Run"
- [ ] Navigates to run detail page (`/runs/{run_id}`)
- [ ] Run details are displayed

### Upload Another

- [ ] Complete an upload successfully
- [ ] Click "Upload Another"
- [ ] Form resets to initial state
- [ ] File list is empty
- [ ] Metadata form is cleared
- [ ] Stepper resets to step 1
- [ ] Can start a new upload

### Error Handling

#### Test Invalid File Type
- [ ] Select a `.txt` or `.pdf` file
- [ ] Fill metadata form
- [ ] Click Upload
- [ ] Error alert appears (red)
- [ ] Error message explains invalid file type
- [ ] Can dismiss error by clicking X
- [ ] Can fix and retry

#### Test No Files
- [ ] Don't select any files
- [ ] Fill metadata form
- [ ] Upload button should be disabled
- [ ] (If enabled via bug) Click Upload
- [ ] Error message appears

#### Test Network Error
- [ ] Stop the backend server
- [ ] Try to upload
- [ ] Error alert appears
- [ ] Error message indicates connection failure

### Responsive Design

Test on different screen sizes:

- [ ] Desktop (1920x1080): All elements properly spaced
- [ ] Laptop (1366x768): Layout adjusts
- [ ] Tablet (768x1024): Stepper still visible
- [ ] Mobile (375x667): Single column layout

### Back Navigation

- [ ] Click "Back to Runs" button
- [ ] Returns to main page (`/`)
- [ ] Run browser is displayed

---

## Integration Testing

### End-to-End LAMMPS Upload

- [ ] Start both backend and frontend
- [ ] Navigate to upload page
- [ ] Select LAMMPS files:
  - [ ] trajectory.dump
  - [ ] data.lammps
  - [ ] in.lammps
  - [ ] log.lammps
- [ ] Fill metadata:
  - [ ] Project: "E2E Test"
  - [ ] Run: "LAMMPS Upload Test"
  - [ ] Description: "Testing LAMMPS upload"
- [ ] Upload
- [ ] Wait for success
- [ ] Click "View Run"
- [ ] Verify run appears correctly
- [ ] Check artifacts tab
- [ ] Verify all 4 files are listed
- [ ] Check completeness score
- [ ] Verify preview is generated (may take a few seconds)

### End-to-End GROMACS Upload

- [ ] Navigate to upload page
- [ ] Select GROMACS files:
  - [ ] traj.xtc
  - [ ] conf.gro
  - [ ] topol.top
- [ ] Fill metadata:
  - [ ] Project: "E2E Test"
  - [ ] Run: "GROMACS Upload Test"
  - [ ] Description: "Testing GROMACS upload"
- [ ] Upload
- [ ] Wait for success
- [ ] View run
- [ ] Verify run appears correctly
- [ ] Check artifacts
- [ ] Verify completeness

### Minimal Upload

- [ ] Upload only a trajectory file (no other files)
- [ ] Verify upload succeeds
- [ ] Check completeness score is lower
- [ ] Verify missing data warnings are shown

### Large File Upload

- [ ] Select a file >100MB (if available)
- [ ] Upload
- [ ] Verify progress updates smoothly
- [ ] Wait for completion (may take several minutes)
- [ ] Verify success

### Browse Integration

- [ ] Complete an upload
- [ ] Navigate to main page (/)
- [ ] Verify uploaded run appears in the list
- [ ] Filter by project name
- [ ] Verify run is found
- [ ] Click on the run card
- [ ] Verify details page opens

---

## Browser Compatibility

Test in multiple browsers:

### Chrome
- [ ] Upload works
- [ ] Drag-and-drop works
- [ ] Progress bar animates
- [ ] No console errors

### Firefox
- [ ] Upload works
- [ ] Drag-and-drop works
- [ ] Progress bar animates
- [ ] No console errors

### Safari
- [ ] Upload works
- [ ] Drag-and-drop works
- [ ] Progress bar animates
- [ ] No console errors

---

## Performance Testing

### Small Files (<10MB)
- [ ] Upload completes in <10 seconds
- [ ] Progress updates smoothly
- [ ] No UI lag

### Medium Files (10-100MB)
- [ ] Upload completes in reasonable time
- [ ] Progress updates every few seconds
- [ ] UI remains responsive

### Large Files (>100MB)
- [ ] Upload succeeds (doesn't timeout)
- [ ] Progress tracking works
- [ ] Can wait for completion without errors

### Multiple Files
- [ ] Upload 10 small files
- [ ] All files are processed
- [ ] Progress tracks total upload

---

## TypeScript & Code Quality

### Type Checking
```bash
cd frontend
npm run type-check
```
- [ ] Upload-related files pass type checking
- [ ] No new TypeScript errors introduced

### Build
```bash
cd frontend
npm run build
```
- [ ] Build succeeds
- [ ] No build errors for upload code

---

## Documentation Verification

- [ ] `docs/UPLOAD_FEATURE.md` is complete
- [ ] API endpoint is documented
- [ ] Usage examples work
- [ ] Configuration options are clear
- [ ] Troubleshooting guide is helpful

---

## Cleanup Testing

### Temporary Files
- [ ] Upload a file
- [ ] Check if temp directory is created during upload
- [ ] Wait for upload to complete
- [ ] Verify temp directory is cleaned up
- [ ] Check `/tmp` for leftover files
- [ ] No orphaned files remain

### Error Cleanup
- [ ] Upload an invalid file
- [ ] Wait for error
- [ ] Check that temp directory was cleaned up
- [ ] No leftover files in `/tmp`

---

## Edge Cases

### Empty Files
- [ ] Create an empty file: `touch empty.dump`
- [ ] Try to upload
- [ ] Should succeed but may have parsing warnings

### Special Characters in Filename
- [ ] Create file: `test file (1).dump`
- [ ] Upload
- [ ] Verify it handles spaces and parentheses

### Very Long Filename
- [ ] Create file with very long name (>200 chars)
- [ ] Upload
- [ ] Verify UI handles display

### Duplicate Filenames
- [ ] Add same file twice
- [ ] Both appear in list
- [ ] Both are uploaded

### Concurrent Uploads
- [ ] Open two browser tabs
- [ ] Start upload in tab 1
- [ ] Start different upload in tab 2
- [ ] Both should succeed independently

---

## Security Testing

### File Extension Bypass
- [ ] Rename `malicious.exe` to `malicious.dump`
- [ ] Try to upload
- [ ] Should be rejected during validation

### Large File Attack
- [ ] Create file >5GB
- [ ] Try to upload
- [ ] Should be rejected with size error

### SQL Injection in Metadata
- [ ] Enter `'; DROP TABLE runs; --` in project name
- [ ] Upload
- [ ] Should be safely escaped
- [ ] Verify database is intact

---

## Accessibility

### Keyboard Navigation
- [ ] Tab through all controls
- [ ] Focus indicators are visible
- [ ] Can select files with keyboard
- [ ] Can fill form with keyboard only
- [ ] Can submit with keyboard

### Screen Reader
- [ ] Form labels are read correctly
- [ ] Error messages are announced
- [ ] Success messages are announced
- [ ] Progress updates are announced

---

## Summary

**Total Tests**: ~150

**Critical Tests** (must pass):
- Backend endpoint works
- File upload succeeds
- Progress tracking works
- Success navigation works
- Error handling works
- Temp directory cleanup works

**Nice-to-Have Tests**:
- All browsers
- All edge cases
- Accessibility
- Performance with very large files

---

## Quick Test Script

For rapid verification:

```bash
# Backend quick test
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=quick_test" \
  -F "run_name=test_$(date +%s)" \
  -F "files=@/path/to/test.dump"

# Frontend quick test
# 1. Open http://localhost:3000
# 2. Click "Upload Trajectory"
# 3. Drop a file
# 4. Fill form
# 5. Click Upload
# 6. Verify success
```

---

## Bug Reporting Template

If you find a bug:

```
**Bug**: [Brief description]

**Steps to Reproduce**:
1.
2.
3.

**Expected**: [What should happen]

**Actual**: [What actually happened]

**Browser**: [Chrome/Firefox/Safari]

**Console Errors**: [Paste any errors]

**Screenshots**: [If applicable]
```

---

## Testing Complete Checklist

- [ ] Backend API tests pass
- [ ] Frontend UI tests pass
- [ ] Integration tests pass
- [ ] Browser compatibility verified
- [ ] Performance acceptable
- [ ] TypeScript compilation succeeds
- [ ] Documentation verified
- [ ] Edge cases handled
- [ ] No security issues
- [ ] Cleanup verified

**Ready for Production**: YES / NO

**Notes**:
