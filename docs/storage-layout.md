# Storage Layout Specification

## Version: 1.0.0
## Date: 2026-01-29

---

## 1. Overview

The MD repository uses a **dual-path storage strategy**:

1. **Content-Addressed Store (CAS)**: Immutable artifacts stored by SHA-256 checksum
2. **Run-Organized Store**: Symlinks/references organized by run for human browsing

This design ensures:
- **Deduplication**: Identical files (e.g., shared topologies) stored once
- **Integrity**: Checksums detect corruption immediately
- **Immutability**: No file ever modified; versions create new checksums
- **Traceability**: Run-organized view preserves scientific context

---

## 2. Filesystem Layout

### 2.1 Root Directory Structure

```
{MDREPO_STORAGE_ROOT}/
├── artifacts/           # All binary files
│   ├── by-checksum/     # Content-addressed storage (CAS)
│   └── by-run/          # Run-organized views (symlinks to CAS)
├── staging/             # Temporary files during ingestion
├── exports/             # Metadata exports for backup
└── .mdrepo/             # System metadata
    ├── config.yaml
    ├── locks/
    └── logs/
```

### 2.2 Content-Addressed Storage (CAS)

Artifacts stored in 2-level subdirectory tree based on checksum prefix:

```
artifacts/by-checksum/sha256/{AA}/{BB}/{CHECKSUM}.{ext}{compression}
```

**Example:**
```
SHA-256: abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234
Path:    artifacts/by-checksum/sha256/ab/cd/abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234.xtc.gz
```

**Rationale for 2-level tree:**
- Avoids filesystem limits (max entries per directory ~32k-64k on ext4/XFS)
- 256 subdirs at level 1, 256 at level 2 = 65,536 buckets
- Expected collision rate: <1% even with 1M+ files

**Metadata sidecar:**
Each artifact has a `.meta.json` sidecar:

```json
{
  "checksum_sha256": "abcd1234...",
  "size_bytes": 12345678,
  "original_filename": "traj_part1.xtc",
  "compression": "gzip",
  "compression_ratio": 0.42,
  "created_at": "2026-01-29T12:34:56Z",
  "mime_type": "application/x-xtc",
  "verified_at": "2026-01-29T12:35:00Z",
  "verification_ok": true
}
```

### 2.3 Run-Organized Storage

Human-navigable directory tree organized by project and run:

```
artifacts/by-run/{PROJECT_ID}/{RUN_ID}/
├── manifest.json
├── input/
│   ├── in.lammps
│   ├── data.lmp
│   └── potential.table
├── output/
│   ├── traj.xtc.gz
│   ├── log.lammps
│   ├── thermo.dat
│   └── checkpoint.restart
└── analysis/
    ├── rdf.dat
    ├── msd.dat
    └── rmsd.dat
```

**Files are symlinks to CAS:**
```bash
ln -s ../../../by-checksum/sha256/ab/cd/abcd1234...5678.xtc.gz output/traj.xtc.gz
```

**Manifest format:**
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "run_name": "urea_water_npt_298K_prod",
  "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "ingestion_time": "2026-01-29T12:34:56.789Z",
  "storage_version": "1.0.0",
  "artifacts": [
    {
      "file": "output/traj.xtc.gz",
      "checksum_sha256": "abcd1234...",
      "size_bytes": 12345678,
      "artifact_type": "trajectory",
      "role": "primary",
      "format": "xtc",
      "compression": "gzip"
    },
    {
      "file": "input/in.lammps",
      "checksum_sha256": "ef011234...",
      "size_bytes": 2048,
      "artifact_type": "input",
      "role": "input",
      "format": "lammps-input",
      "compression": "none"
    }
  ],
  "system": {
    "composition_formula": "H2O_512_urea_32",
    "n_atoms": 17408
  },
  "parameters": {
    "ensemble": "NPT",
    "temperature_target": 298.0,
    "pressure_target": 1.0,
    "timestep": 2.0,
    "n_steps": 5000000,
    "total_time": 10.0
  }
}
```

### 2.4 Staging Area

Temporary location for files during ingestion:

```
staging/{HOSTNAME}/{JOB_ID}/
└── {RUN_ID}/
    ├── traj_part1.xtc
    ├── traj_part2.xtc
    ├── log.lammps
    └── .ingest_status.json
```

**Cleanup policy:**
- Files deleted after successful ingestion
- Failed ingestions retained for 7 days (configurable)
- Orphaned staging directories cleaned by cron job

---

## 3. Object Storage Layout (S3/MinIO)

### 3.1 Bucket Structure

**Single bucket:** `md-simulations`

**Prefix hierarchy:**
```
md-simulations/
├── artifacts/sha256-{AA}-{BB}/{CHECKSUM}.{ext}{compression}
├── manifests/runs/{RUN_ID}/manifest.json
├── manifests/projects/{PROJECT_ID}/manifest.json
└── metadata-snapshots/{YYYY-MM-DD}/metadata-{TIMESTAMP}.jsonl.gz
```

**Example object key:**
```
artifacts/sha256-ab-cd/abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234.xtc.gz
```

### 3.2 Object Metadata (S3 Headers)

Store metadata as S3 object metadata:

```
x-amz-meta-checksum-sha256: abcd1234...
x-amz-meta-original-filename: traj_part1.xtc
x-amz-meta-run-id: 550e8400-e29b-41d4-a716-446655440000
x-amz-meta-artifact-type: trajectory
x-amz-meta-compression: gzip
x-amz-meta-size-uncompressed: 48000000
```

### 3.3 Versioning Strategy

**S3 versioning enabled** for all buckets:
- Protects against accidental deletion
- Enables rollback if corruption detected
- Old versions auto-archived to Glacier after 90 days (lifecycle policy)

**Version IDs stored in PostgreSQL:**
```sql
ALTER TABLE artifacts ADD COLUMN s3_version_id TEXT;
```

---

## 4. Naming Conventions

### 4.1 File Naming

**Input files:**
- LAMMPS: `in.{description}.lammps`, `data.{system}.lmp`
- GROMACS: `{name}.mdp`, `{system}.gro`, `{system}.top`

**Trajectory files:**
- Original names preserved in manifest
- CAS names: `{CHECKSUM}.{format}.{compression}`
  - `abcd1234....xtc.gz`
  - `ef011234....trr.xz`
  - `12345678....dcd` (no compression)

**Log files:**
- LAMMPS: `log.lammps`, `log.{date}.lammps`
- GROMACS: `md.log`, `ener.edr`

### 4.2 Compression Extensions

| Format | Extension | Tool | Compression Ratio | Decompression Speed |
|--------|-----------|------|-------------------|---------------------|
| gzip   | `.gz`     | gzip | 3-5x              | ~200 MB/s          |
| xz     | `.xz`     | xz   | 5-8x              | ~50 MB/s           |
| zstd   | `.zst`    | zstd | 4-6x              | ~500 MB/s          |
| lz4    | `.lz4`    | lz4  | 2-3x              | ~2 GB/s            |

**Recommendation:**
- **Default:** `gzip` (universally supported, good ratio)
- **Fast access:** `zstd` or `lz4` (modern, much faster decompression)
- **Archival:** `xz` (best ratio, slow)

### 4.3 ID Formats

**Run ID:** UUID v4, lowercase with hyphens
```
550e8400-e29b-41d4-a716-446655440000
```

**Checksum:** SHA-256, lowercase hex, 64 characters
```
abcd1234567890abcd1234567890abcd1234567890abcd1234567890abcd1234
```

**Project ID:** UUID v4, lowercase with hyphens

---

## 5. Versioning Strategy

### 5.1 Artifact Versioning

**Immutable artifacts:** Files never modified after ingestion.

**Versioning via lineage:**
- New version of analysis → new artifact with lineage link
- Trajectory reprocessed → new artifact + lineage relationship
- Database tracks: `parent_artifact_id`, `version_number`

**Example:**
```
run_001:
  artifacts:
    - traj_v1.xtc (checksum: abcd...)
    - traj_v2.xtc (checksum: ef01...)  # Reprocessed with different stride
      lineage: parent=traj_v1, relationship=derived
```

### 5.2 Manifest Versioning

Manifest files are versioned in S3:

```
manifests/runs/{RUN_ID}/manifest.json
  version 1: 2026-01-29T12:00:00Z
  version 2: 2026-01-30T15:30:00Z (added analysis artifacts)
  version 3: 2026-02-01T09:00:00Z (corrected metadata)
```

Current version ID stored in PostgreSQL `simulation_runs.manifest_version_id`.

### 5.3 Schema Versioning

Storage layout version tracked in manifest:

```json
{
  "storage_version": "1.0.0",
  "schema_version": "1.0.0"
}
```

Breaking changes increment major version. Migration tool provided.

---

## 6. Integrity Checks

### 6.1 Checksum Verification

**On write:**
1. Compute SHA-256 during upload
2. Compare with expected checksum (if provided)
3. Store verified checksum in database

**On read (periodic):**
1. Recompute SHA-256 from stored file
2. Compare with database checksum
3. Log discrepancies, mark artifact as `corrupted`

**Scheduled verification:**
- Critical artifacts (topologies, inputs): weekly
- Trajectories: monthly
- Archives (>1 year old): quarterly

### 6.2 Consistency Checks

**Database ↔ Storage sync:**
```sql
-- Find artifacts in DB but missing from storage
SELECT id, object_key FROM artifacts
WHERE storage_backend = 's3'
  AND NOT EXISTS (SELECT 1 FROM s3_object_list WHERE key = object_key);

-- Find orphaned files in storage not in DB
SELECT key FROM s3_object_list
WHERE key LIKE 'artifacts/%'
  AND key NOT IN (SELECT object_key FROM artifacts WHERE object_key IS NOT NULL);
```

**Manifest ↔ Artifacts:**
- Every artifact in manifest must exist in CAS
- Every artifact in run directory must have DB record

---

## 7. Compression Guidelines

### 7.1 When to Compress

| Artifact Type | Compress? | Format | Rationale |
|---------------|-----------|--------|-----------|
| Trajectories (XTC, TRR, DCD) | **Yes** | gzip/zstd | Large, compress 3-5x |
| LAMMPS dump (text) | **Yes** | gzip/xz | ASCII, compress 10-20x |
| Topology files | **No** | none | Small (<1 MB), rarely accessed |
| Input scripts | **No** | none | Tiny (<100 KB), human-readable |
| Log files | **Yes** | gzip | Large (>10 MB), text |
| Energy files (EDR) | **No** | none | Already binary compressed |
| Checkpoint files | **No** | none | Binary, need fast restore |
| Analysis output | **Yes** | gzip | Text, large time series |

### 7.2 Compression Commands

**gzip (level 6, default):**
```bash
gzip -6 -c input.xtc > output.xtc.gz
```

**zstd (level 3, balanced):**
```bash
zstd -3 -T0 input.xtc -o output.xtc.zst
```

**xz (level 6, for archival):**
```bash
xz -6 -T0 input.dump -c > output.dump.xz
```

### 7.3 Transparent Decompression

Application layer handles decompression transparently:

```python
def read_artifact(artifact_id: UUID) -> bytes:
    artifact = db.query(Artifact).filter_by(id=artifact_id).first()
    data = storage.get_object(artifact.object_key)

    if artifact.compression == 'gzip':
        return gzip.decompress(data)
    elif artifact.compression == 'zstd':
        return zstandard.decompress(data)
    elif artifact.compression == 'none':
        return data
```

---

## 8. Storage Backend Configuration

### 8.1 Local Filesystem

**Config (`mdrepo-config.yaml`):**
```yaml
storage:
  backend: filesystem
  root: /data/mdrepo/storage
  staging: /data/mdrepo/staging
  permissions:
    directories: 0755
    files: 0644
  use_cas: true
  use_symlinks: true
```

### 8.2 MinIO (Local S3-Compatible)

**Config:**
```yaml
storage:
  backend: minio
  endpoint: http://localhost:9000
  bucket: md-simulations
  access_key: ${MINIO_ACCESS_KEY}
  secret_key: ${MINIO_SECRET_KEY}
  secure: false
  region: us-east-1
```

**Docker Compose:**
```yaml
services:
  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: admin
      MINIO_ROOT_PASSWORD: changeme123
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio-data:/data
```

### 8.3 AWS S3

**Config:**
```yaml
storage:
  backend: s3
  bucket: my-org-md-simulations
  region: us-west-2
  access_key: ${AWS_ACCESS_KEY_ID}
  secret_key: ${AWS_SECRET_ACCESS_KEY}
  endpoint: null  # Use AWS default
  storage_class: STANDARD  # or STANDARD_IA, GLACIER
```

**Lifecycle policy (S3):**
```json
{
  "Rules": [
    {
      "Id": "archive-old-artifacts",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 90,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 365,
          "StorageClass": "GLACIER"
        }
      ]
    }
  ]
}
```

---

## 9. Backup Strategy

### 9.1 Metadata Backup

**PostgreSQL dump (daily):**
```bash
pg_dump -h localhost -U mdrepo -d mdrepo \
  --format=custom \
  --compress=9 \
  -f metadata-$(date +%Y%m%d).pgdump
```

**Incremental backup (hourly):**
- WAL archiving enabled
- Point-in-time recovery (PITR) to S3

### 9.2 Artifact Backup

**S3 versioning + cross-region replication:**
- Primary: us-west-2
- Replica: us-east-1
- Auto-sync via S3 replication rules

**Filesystem backup (local):**
- Rsync to backup server daily
- Snapshot-based backup (ZFS/Btrfs)

### 9.3 Disaster Recovery

**Recovery Time Objective (RTO):** 4 hours
**Recovery Point Objective (RPO):** 1 hour

**Recovery procedure:**
1. Restore PostgreSQL from latest dump + WAL
2. Restore S3 artifacts from replica bucket
3. Verify checksums for 1000 random artifacts
4. Resume service

---

## 10. Monitoring and Maintenance

### 10.1 Storage Metrics

**Track in Prometheus/Grafana:**
- Total storage used (bytes)
- Artifact count by type
- Compression ratio by format
- Checksum verification pass/fail rate
- Orphaned files count
- Staging directory size

### 10.2 Maintenance Tasks

**Daily:**
- Clean up staging directories (>7 days old)
- Verify checksums for artifacts accessed today

**Weekly:**
- Check for orphaned artifacts (DB ↔ storage)
- Vacuum PostgreSQL
- Update storage statistics

**Monthly:**
- Full checksum verification of random 10% sample
- Audit lineage graph for cycles
- Export metadata snapshot to S3

**Quarterly:**
- Review storage costs
- Archive old runs to Glacier
- Test disaster recovery procedure

---

## 11. Migration Path

### 11.1 From Existing Filesystem

**Step 1: Inventory existing runs**
```bash
find /old/md/runs -name "*.xtc" -o -name "*.trr" > inventory.txt
```

**Step 2: Compute checksums**
```bash
parallel -j 8 sha256sum {} ::: $(cat inventory.txt) > checksums.txt
```

**Step 3: Ingest with metadata**
```bash
mdrepo ingest-batch --manifest migration-manifest.yaml
```

**Step 4: Verify all artifacts**
```bash
mdrepo verify --run-ids $(cat migrated_runs.txt)
```

### 11.2 Storage Layout Version Upgrade

**Example: v1.0 → v2.0 (hypothetical)**

If layout changes (e.g., 3-level CAS tree instead of 2):

1. **Dual-write period:** Write to both layouts
2. **Background migration:** Move old files to new layout
3. **Update database:** Point to new paths
4. **Verification:** Checksum all migrated files
5. **Cleanup:** Remove old layout after 30 days

---

## 12. Security

### 12.1 Access Control

**Filesystem:**
- Owner: `mdrepo` user
- Group: `mdrepo-users`
- Permissions: 0755 (directories), 0644 (files)

**S3 bucket policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::123456789012:user/mdrepo-api"
      },
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::md-simulations/artifacts/*"
    }
  ]
}
```

### 12.2 Encryption

**At rest:**
- S3: Enable SSE-S3 or SSE-KMS
- Filesystem: LUKS or dm-crypt

**In transit:**
- S3: HTTPS only (enforce via bucket policy)
- PostgreSQL: SSL/TLS required

---

## 13. Performance Optimization

### 13.1 Caching

**Metadata cache (Redis):**
```yaml
cache:
  backend: redis
  host: localhost
  port: 6379
  ttl: 3600  # 1 hour
  key_prefix: mdrepo:
```

**Object cache (local):**
- Frequently accessed artifacts cached locally
- LRU eviction when disk fills
- Max cache size: 100 GB (configurable)

### 13.2 Parallel Uploads

**Multipart uploads for large files (>100 MB):**
```python
from concurrent.futures import ThreadPoolExecutor

def upload_large_file(file_path: Path, object_key: str):
    part_size = 50 * 1024 * 1024  # 50 MB
    with ThreadPoolExecutor(max_workers=4) as executor:
        # Upload parts in parallel
        futures = []
        for part_num, chunk in enumerate_chunks(file_path, part_size):
            future = executor.submit(upload_part, object_key, part_num, chunk)
            futures.append(future)

        # Wait for all parts, then complete multipart upload
        wait(futures)
        complete_multipart_upload(object_key)
```

### 13.3 Prefetching

**Predictive prefetch:**
- If user queries run X, prefetch manifest and small artifacts
- If user downloads trajectory part 1, prefetch part 2

---

## 14. Troubleshooting

### 14.1 Common Issues

**Issue: Checksum mismatch**
```
ERROR: Artifact abcd1234... checksum mismatch
  Expected: abcd1234567890...
  Actual:   ef011234567890...
```

**Solution:**
1. Check if file corrupted during transfer
2. Re-ingest from original source
3. Mark old artifact as `corrupted` in DB

**Issue: Orphaned artifacts**
```
WARNING: 150 artifacts in storage not referenced by database
```

**Solution:**
```bash
mdrepo storage audit --fix-orphans
```

**Issue: Staging disk full**
```
ERROR: No space left on device (/staging)
```

**Solution:**
```bash
mdrepo storage clean-staging --age 7d --dry-run
mdrepo storage clean-staging --age 7d  # Actually delete
```

---

## 15. Future Enhancements

### 15.1 Content-Defined Chunking

For very large trajectories (>100 GB), use CDC (content-defined chunking):
- Split trajectory into variable-size chunks
- Each chunk gets own checksum
- Enables deduplication of partial trajectory overlap

### 15.2 Delta Encoding

For restart/continuation runs:
- Store only the diff from parent trajectory
- Saves storage for long simulations with many restarts

### 15.3 Tiered Storage

Automatic migration based on access patterns:
- Hot tier (SSD): accessed in last 30 days
- Warm tier (HDD): accessed in last 1 year
- Cold tier (Glacier): older than 1 year

---

## Appendix A: Storage Layout Version History

| Version | Date       | Changes |
|---------|------------|---------|
| 1.0.0   | 2026-01-29 | Initial specification |

---

## Appendix B: Checksum Algorithm Choice

**Why SHA-256 over MD5?**
- MD5 collisions demonstrated (not secure)
- SHA-256 cryptographically strong
- Hardware acceleration available (SHA-NI)
- Performance: ~500 MB/s (single core), ~2 GB/s (multi-core)

**Why not SHA-512?**
- Marginally stronger but 2x larger hashes
- Negligible security benefit for our use case
- SHA-256 collision probability already ~10^-60

**Why not BLAKE3?**
- Faster than SHA-256 (~3-5x)
- Not yet universally supported
- Consider for v2.0 with migration path
