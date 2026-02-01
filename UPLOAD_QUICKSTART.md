# Upload Feature - Quick Start Guide

## TL;DR

Upload MD simulation files through your web browser instead of using the CLI.

**Web Interface**: http://localhost:3000 → Click "Upload Trajectory" button

**API**: `POST /api/v1/upload` with multipart form data

---

## For End Users (Web Interface)

### 1. Start the Application

```bash
# Terminal 1: Start backend
cd /home/deo/Documents/projects/md-datalake
poetry run uvicorn mddatalake.api.main:app --reload --host 0.0.0.0 --port 8080

# Terminal 2: Start frontend
cd /home/deo/Documents/projects/md-datalake/frontend
npm run dev
```

Open browser: http://localhost:3000

### 2. Upload Your Simulation

1. **Click "Upload Trajectory"** button in the header

2. **Select files**:
   - Drag and drop files onto the blue area, OR
   - Click the blue area to browse

3. **Add your files**:
   - ✅ Trajectory file (`.dump`, `.xtc`, etc.) - **Required**
   - ✅ Topology file (`.data`, `.gro`, etc.) - Recommended
   - ✅ Input script (`in.lammps`, `.mdp`) - Recommended
   - ✅ Log file (`log.lammps`, `.edr`) - Recommended

4. **Fill in the form**:
   - **Project Name**: e.g., "Water Simulation"
   - **Run Name**: e.g., "NVT Equilibration 300K"
   - **Description** (optional): Extra details

5. **Click Upload** and wait

6. **Click "View Run"** when done!

### What Files Can I Upload?

**LAMMPS**:
- 📊 Trajectories: `.dump`, `.lammpstrj`, `.dcd`
- 🧬 Structure: `.data`, `.lmp`
- ⚙️ Input: `in.*`, `.lammps`
- 📝 Logs: `log.*`, `.log`

**GROMACS**:
- 📊 Trajectories: `.xtc`, `.trr`, `.dcd`
- 🧬 Structure: `.gro`, `.pdb`, `.top`
- ⚙️ Input: `.mdp`
- 📝 Logs/Data: `.edr`, `.tpr`

---

## For Developers (API)

### Using curl

```bash
curl -X POST http://localhost:8080/api/v1/upload \
  -F "project_name=my_project" \
  -F "run_name=my_simulation" \
  -F "description=Optional description" \
  -F "files=@trajectory.dump" \
  -F "files=@data.lammps" \
  -F "files=@in.lammps" \
  -F "files=@log.lammps"
```

### Using Python

```python
import requests

url = "http://localhost:8080/api/v1/upload"

files = [
    ("files", open("trajectory.dump", "rb")),
    ("files", open("data.lammps", "rb")),
    ("files", open("in.lammps", "rb")),
]

data = {
    "project_name": "my_project",
    "run_name": "my_simulation",
    "description": "Test upload"
}

response = requests.post(url, files=files, data=data)
print(response.json())
```

### Using JavaScript

```javascript
const formData = new FormData();
formData.append('project_name', 'my_project');
formData.append('run_name', 'my_simulation');
formData.append('description', 'Test upload');

// Add files
document.getElementById('fileInput').files.forEach(file => {
  formData.append('files', file);
});

const response = await fetch('http://localhost:8080/api/v1/upload', {
  method: 'POST',
  body: formData,
});

const result = await response.json();
console.log('Run ID:', result.run_id);
```

### Success Response

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

---

## Common Questions

### Q: What's the maximum file size?

**A**: 5GB per file. This can be configured in the backend.

### Q: How long does upload take?

**A**:
- Small files (<10MB): Few seconds
- Medium files (10-100MB): ~1 minute
- Large files (>100MB): Several minutes

The progress bar shows real-time upload percentage.

### Q: Can I upload just a trajectory file?

**A**: Yes! But your completeness score will be lower. For best results:
- **Minimum**: Trajectory OR topology
- **Recommended**: Trajectory + topology + input + log

### Q: Do I need to create a directory structure?

**A**: No! Just upload all your files together. The system will detect the format and organize everything automatically.

### Q: What if upload fails?

**A**: Common reasons:
1. **Invalid file type**: Only MD simulation formats allowed
2. **File too large**: Max 5GB per file
3. **Cannot detect engine**: Need at least trajectory or topology
4. **Server error**: Check backend logs

See the error message for specific guidance.

### Q: Can I add files to an existing run?

**A**: Not yet. This is a planned future enhancement.

---

## Troubleshooting

### Upload button is grayed out

✅ **Solution**:
- Make sure you've selected at least one file
- Fill in both Project Name and Run Name

### "Cannot detect MD engine" error

✅ **Solution**:
- Make sure you have at least one of:
  - Trajectory file (`.dump`, `.xtc`, etc.)
  - Topology file (`.data`, `.gro`, etc.)
- Check file extensions match file contents

### Upload stuck at 100%

✅ **Solution**:
- This is normal! Processing/ingestion happens after upload
- Wait 1-2 minutes for large files
- Check backend terminal for progress

### Upload fails with network error

✅ **Solution**:
- Check backend server is running: http://localhost:8080/health
- Check frontend can reach backend (CORS settings)
- Check firewall isn't blocking connection

---

## Examples

### Example 1: Simple LAMMPS Upload

**Files**:
- `dump.water` (trajectory)

**Steps**:
1. Open upload page
2. Drop `dump.water`
3. Project: "Water Simulations"
4. Run: "Test Run"
5. Upload

**Result**: Run created with trajectory only (lower completeness score)

### Example 2: Complete LAMMPS Upload

**Files**:
- `trajectory.dump` (trajectory)
- `water.data` (topology)
- `in.nvt` (input script)
- `log.lammps` (log)

**Steps**:
1. Open upload page
2. Drop all 4 files
3. Project: "Water Simulations"
4. Run: "NVT Production 300K"
5. Description: "100ns production run at 300K"
6. Upload

**Result**: Complete run with high completeness score

### Example 3: Complete GROMACS Upload

**Files**:
- `md.xtc` (trajectory)
- `conf.gro` (structure)
- `topol.top` (topology)
- `md.mdp` (input)

**Steps**:
1. Open upload page
2. Drop all 4 files
3. Project: "Protein-Ligand"
4. Run: "MD 100ns"
5. Upload

**Result**: Complete GROMACS run

---

## Testing Your Upload

After uploading:

1. **Check run appears**: Go back to main page, find your run
2. **View details**: Click on the run card
3. **Check artifacts**: Verify all files are listed
4. **Check preview**: Thumbnail should generate automatically
5. **Check completeness**: See completeness score and warnings

---

## Next Steps

After uploading your simulation:

1. **View trajectory** in 3D viewer
2. **Analyze observables** (temperature, pressure, energy)
3. **Check data completeness** and recommendations
4. **Download artifacts** if needed
5. **Share run ID** with collaborators

---

## Getting Help

- **Documentation**: `docs/UPLOAD_FEATURE.md`
- **Testing Guide**: `UPLOAD_TESTING_CHECKLIST.md`
- **API Docs**: http://localhost:8080/docs

For issues, check the backend terminal for detailed error logs.

---

## Pro Tips

💡 **Drag and drop is faster**: Just drop files onto the upload area

💡 **Add files incrementally**: Don't have all files? Upload what you have, add more files to the list later before submitting

💡 **Use descriptive names**: Future you will thank you for clear project/run names

💡 **Include logs**: Log files provide temperature, pressure, energy data

💡 **Check completeness**: After upload, review completeness score for missing data

💡 **Save time with API**: For repeated uploads, use the API with scripts

---

**Ready to upload? Let's go!** 🚀
