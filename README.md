# Intelligent Media Processing Pipeline

A production-quality asynchronous image analysis backend built with **Node.js + TypeScript**, **PostgreSQL**, **BullMQ (Redis)**, and **Sharp / Tesseract.js**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (curl / frontend app)                         │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │  POST /api/v1/upload (multipart)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API SERVER (Express + TypeScript)                    │
│                                                                              │
│  ┌─────────────────────────┐    ┌──────────────────────────────────────┐    │
│  │  Upload Handler         │    │  Results / Status Handlers           │    │
│  │  • Magic byte check     │    │  • GET /jobs/:id/status              │    │
│  │  • Sharp decode check   │    │  • GET /jobs/:id/results             │    │
│  │  • Save to Storage      │    │  • GET /jobs/:id/failure             │    │
│  │  • Insert DB record     │    │  • GET /jobs (paginated)             │    │
│  └────────────┬────────────┘    └──────────────────────────────────────┘    │
└───────────────┼─────────────────────────────────────────────────────────────┘
                │  enqueue({ jobId, filePath, ... })
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BullMQ Queue — "image-analysis"                        │
│                    (Redis-backed, persistent, retryable)                     │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │  consume (concurrency: 3)
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       WORKER PROCESS (separate Node.js process)              │
│                                                                              │
│  status = 'processing'                                                       │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │             Promise.allSettled (all 6 checks concurrent)            │    │
│  │                                                                      │    │
│  │  ① Blur Detection    ② Brightness     ③ Duplicate Detection         │    │
│  │    (Laplacian var)     (Mean lum.)      (dHash + Hamming)           │    │
│  │                                                                      │    │
│  │  ④ Screenshot Det.   ⑤ OCR Plate      ⑥ Dimension Check            │    │
│  │    (EXIF+ratio+Sobel) (Tesseract)       (metadata only)             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  INSERT analysis_results (one row per check)                                 │
│  UPDATE image_jobs SET status='completed', quality_score=…                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PostgreSQL Database                                  │
│                                                                              │
│   image_jobs ──────────────────────────────────────────────────────────     │
│   │ id (UUID PK)  │ status (ENUM)  │ quality_score │ perceptual_hash │      │
│                                                                              │
│   analysis_results ──────────────────────────────────────────────────────   │
│   │ id (UUID PK)  │ job_id (FK)  │ check_name │ passed │ confidence │       │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────┐   ┌───────────────────────┐
│  Local Storage       │   │  (swap-in: S3/GCS)    │
│  /uploads/{uuid}.ext │   │  StorageProvider API  │
└──────────────────────┘   └───────────────────────┘
```

### Component Responsibilities

| Component | Why it exists |
|---|---|
| **API Server** | Accepts uploads, validates synchronously, returns immediately (async design). Keeps the upload latency to <100ms regardless of analysis time. |
| **PostgreSQL** | Authoritative record of job state and results. Chosen over MongoDB because the schema is well-defined, joins are needed (jobs ↔ results), and ACID guarantees prevent partial-result confusion. |
| **BullMQ + Redis** | Decouples upload acceptance from analysis work. Provides durable job persistence (survives worker restarts), backpressure control, and a retry mechanism with exponential backoff. |
| **Worker** | Separate process to avoid blocking the API event loop with CPU-bound Sharp and Tesseract operations. |
| **Storage Provider** | Abstraction layer that hides whether files live on local disk or S3. Zero call-site changes needed to switch. |
| **Analysis Modules** | Each check is a single-responsibility function. New checks can be added without touching the orchestrator beyond registering them in `index.ts`. |

---

## Processing Flow

**Step-by-step from upload to completed result:**

1. **Client** sends `POST /api/v1/upload` with a multipart form containing an `image` field.

2. **Multer** buffers the file in memory (max 10MB). Files exceeding the limit are rejected immediately with `413 FILE_TOO_LARGE`.

3. **MIME Type Pre-filter**: Multer's `fileFilter` rejects declared types not in `[image/jpeg, image/png, image/webp]`.

4. **Magic Byte Check**: `file-type` reads the buffer's first bytes to detect the actual format. A `.php` file renamed to `.jpg` is caught here (`415 UNSUPPORTED_FILE_TYPE`).

5. **Integrity Check**: `sharp(buffer).stats()` attempts a full decode. Corrupt or truncated files throw, returning `422 CORRUPT_IMAGE`.

6. **Persist**: File buffer written to `/uploads/{uuid}.{ext}` via `StorageProvider.save()`.

7. **DB Insert**: `image_jobs` row created with `status='pending'`.

8. **Enqueue**: BullMQ job pushed to `"image-analysis"` queue with `{ jobId, filePath, originalName, mimeType, fileSize }`.

9. **API Returns** `202 Accepted` with `{ jobId, status: "pending", message }`.

10. **Worker Picks Up Job**: BullMQ worker consumes the job (concurrency: 3).

11. **Status → 'processing'**: `image_jobs.status` updated immediately.

12. **File Existence Check**: If the file was deleted between upload and pickup, the job is marked `failed` immediately (no retry — file won't come back).

13. **6 Checks Run Concurrently** via `Promise.allSettled`:
    - `blur_detection` — Laplacian variance on grayscale pixels
    - `brightness_analysis` — Mean luminance, thresholds at 40 and 220
    - `duplicate_detection` — dHash computed, compared against last 1000 hashes
    - `screenshot_detection` — EXIF + aspect ratio + Sobel edge density (2/3 vote)
    - `ocr_plate_detection` — Tesseract PSM 11, regex matched against Indian plate patterns
    - `dimension_validation` — Width/height/aspect from image metadata header

14. **Results Saved**: One `analysis_results` row inserted per check.

15. **Quality Score Computed**: `Σ(check.confidence × weight)` for passed checks only.

16. **Status → 'completed'**: `image_jobs` updated with `quality_score`, `processed_at`.

17. **Client Polls**: `GET /api/v1/jobs/{jobId}/results` returns the full result when status is `completed`.

---

## Queue Strategy

### Why BullMQ over alternatives?

| Feature | BullMQ | AWS SQS | RabbitMQ | In-memory |
|---|---|---|---|---|
| **Local dev** | ✓ Redis only | ✗ AWS account needed | ✓ but heavy | ✓ |
| **Persistence** | ✓ Redis AOF | ✓ | ✓ | ✗ lost on crash |
| **Job state inspection** | ✓ Bull Board UI | ✗ limited | ✓ management UI | ✗ |
| **Delayed/scheduled jobs** | ✓ native | ✓ | ✓ plugin | ✗ |
| **Retry + backoff** | ✓ built-in | ✓ | ✓ | manual |
| **TypeScript types** | ✓ first-class | partial | partial | manual |
| **Priority queues** | ✓ | ✗ | ✓ | ✗ |

BullMQ's tight Redis integration also means zero additional infrastructure beyond what the app already uses. SQS would require AWS credentials and network round-trips; RabbitMQ adds operational complexity; in-memory queues lose jobs on restart.

### How Retries Work

```
Job fails (throws Error)
        │
        ├── AppError.isFatal = true (corrupt file, missing file)
        │         └── BullMQ marks as FAILED immediately
        │             DB status → 'failed', failureReason set
        │             No retry consumed
        │
        └── Any other Error (DB unavailable, network blip)
                  └── BullMQ waits exponential backoff:
                      Attempt 1 failed → wait 2s
                      Attempt 2 failed → wait 4s
                      Attempt 3 failed → wait 8s → FAILED
                                         DB status → 'failed'
```

**What triggers retry:** DB connection errors, file I/O errors, network timeouts.

**What does NOT retry:** Corrupt files, missing files, validation failures — retrying would never succeed and just wastes queue capacity.

### Concurrency Settings

- **`concurrency: 3`**: Each job takes 5–30s (OCR is the bottleneck). Three concurrent jobs keeps CPU busy without starving the API process on a 4-core server. At 10k uploads/day (~7/minute average), 3 workers comfortably handle bursts up to ~18/minute.
- **`attempts: 3`**: One attempt + two retries. Three total attempts balances reliability vs. queue-clog from permanently broken jobs.
- **`removeOnComplete/Fail: false`**: Job metadata retained in Redis for 7 days, enabling the Bull Board dashboard and post-mortem analysis.

---

## Design Decisions

### 1. dHash over MD5/SHA256 for duplicate detection
Cryptographic hashes change entirely with any re-encoding. The same photo saved at JPEG quality 95 vs 90 produces completely different SHA256 values. `dHash` (difference hash) generates a 64-bit fingerprint based on pixel gradients in a 9×8 downscaled version — similar images have similar hashes. Hamming distance < 10 bits (of 64) reliably catches re-saves, slight crops, and compression at different quality levels.

### 2. Promise.allSettled over Promise.all in the worker
`Promise.all` short-circuits on the first rejection. One crashing check (e.g., Tesseract failing on a malformed font) would silently discard all other check results. `Promise.allSettled` waits for all promises regardless of individual failures, allowing partial results to be saved and the specific failing check to be flagged.

### 3. Memory storage in Multer, not disk storage
Multer's disk storage writes the file before validation. Saving a corrupt 10MB file to disk only to delete it immediately is wasteful and creates a TOCTOU window. Memory storage lets us validate (magic bytes + Sharp decode) then atomically write only valid files.

### 4. Separate API and Worker processes
Node.js is single-threaded. CPU-intensive Sharp convolutions and Tesseract OCR block the event loop. Running the worker as a separate process (separate `npm run dev:worker` or separate Docker container) ensures the API remains responsive during analysis. It also enables independent scaling: deploy 1 API replica and 5 worker replicas under load.

### 5. StorageProvider abstraction from day 1
The local filesystem works for a single server but breaks with horizontal scaling (multiple API instances can't share `/uploads`). By implementing a `StorageProvider` interface immediately, swapping to S3 requires only a new class — no call-site changes. The interface is simple: `save`, `read`, `delete`, `exists`.

### 6. PostgreSQL ENUM over VARCHAR + CHECK constraint for status
A real Postgres ENUM (`job_status`) is stored as an OID internally — smaller than VARCHAR. More importantly, it's self-documenting in `pg_type` and generates better error messages on constraint violations. The trade-off is that adding a new status value requires `ALTER TYPE`, but statuses are stable by design.

### 7. Tesseract PSM 11 (sparse text) over PSM 6 (uniform block)
PSM 6 assumes a single uniform block of text (like a document). Number plates appear at arbitrary positions and sizes within vehicle photos. PSM 11 (sparse text) tells Tesseract to find text anywhere without assuming reading order — far better recall for plates at the cost of more false-positive OCR tokens, which are filtered by the regex.

### 8. Heuristic voting (2/3) for screenshot detection, not a single signal
No single heuristic is reliable alone. EXIF Software tags can be stripped by editors. 16:9 aspect ratios appear in some camera photos. Edge density varies by scene. Requiring 2 of 3 independent signals significantly reduces both false positives (a 16:9 photo not flagged as screenshot) and false negatives (screenshot without EXIF that has high edge density).

---

## AI Usage Disclosure

This project was built with AI assistance (Claude). Here is an honest accounting:

### What AI generated
- Boilerplate Express + TypeScript structure (routes, middleware wiring)
- Pino logger configuration
- Docker Compose and Dockerfile skeletons
- README structure and section drafts
- Initial SQL migration DDL

### Where AI was wrong/suboptimal and how it was fixed
1. **dHash BigInt overflow**: The initial AI-generated dHash used JavaScript's regular `number` type for 64-bit bit manipulation, which loses precision above 2^53. Fixed by explicitly using `BigInt` throughout the hash computation.

2. **Tesseract PSM mode**: AI initially suggested PSM 6 (uniform block). This was corrected to PSM 11 (sparse text) after reviewing Tesseract documentation — PSM 6 would miss plates not occupying the full image.

3. **Promise.allSettled vs Promise.all**: Initial draft used `Promise.all`. Corrected to `Promise.allSettled` after reasoning through the failure mode (one bad check kills all results).

4. **Magic byte check placement**: Initial placement was after Multer's disk write. Moved before any disk I/O so corrupt/wrong-type files never touch the filesystem.

### How AI-generated analysis logic was validated
- Laplacian variance formula verified against published computer vision references
- Hamming distance threshold (10 of 64 bits) validated against pHash literature
- Edge density threshold (0.35) was calibrated manually — AI suggested 0.3, adjusted up after manual testing showed too many false positives on textured nature photos
- Indian plate regexes cross-checked against MoRTH format specifications

---

## Trade-offs & Future Improvements

### Intentionally simplified for MVP
- **No auth**: The upload and status endpoints are unauthenticated. Production needs API keys or JWT.
- **No rate limiting**: A user could DDoS the upload endpoint. Add `express-rate-limit`.
- **Tesseract runs on CPU**: OCR takes 10–30s per image. Production should use dedicated OCR service or GPU-accelerated Tesseract.
- **Duplicate detection looks at only 1000 recent images**: Linear scan. At scale, use a vector database or LSH index.
- **Local storage only**: Shared volume in Docker Compose works locally but not across multi-host deployments.

### What would be added with 2 more days
1. **API key authentication** with per-key rate limits
2. **Webhook support**: `POST /api/v1/upload?webhook=https://…` — notify clients when job completes
3. **S3 storage provider** implementation
4. **Job priority**: Premium users get `priority: 1`, free tier `priority: 10`
5. **Metrics**: Prometheus endpoint at `/metrics` for job throughput, check pass rates, queue depth
6. **Integration tests**: Supertest-based tests with a real PostgreSQL test database
7. **OWASP file upload hardening**: Strip EXIF from uploaded files, randomise paths further

### Scalability concerns at 10k uploads/day
- **OCR is the bottleneck**: Tesseract on CPU takes 10–30s. Need to either run more worker replicas or switch to cloud OCR (Google Vision API: ~200ms).
- **Redis memory**: With `removeOnComplete: false` and job history retained 7 days, Redis holds ~10k × 7 = 70k job records. At ~1KB each, that's 70MB — fine. At 10× scale, set `removeOnComplete: { count: 1000, age: 86400 }`.
- **PostgreSQL**: 10k jobs/day = ~60k `analysis_results` rows/day. With proper indexes, PostgreSQL handles this easily up to ~100M rows. Add read replicas for status polling at high fan-out.
- **Storage**: 10k × avg 3MB = 30GB/day. Local disk fills in days. S3 is required.
- **Worker crashes leave jobs in 'processing'**: Need a stuck-job reaper cron that resets jobs stuck in `processing` for > 5 minutes back to `pending`.

### Failure handling gaps
- **No dead-letter alerting**: Failed jobs currently sit in Redis. Need Slack/PagerDuty notification on job failure threshold.
- **No circuit breaker**: If the database is down, every job fails immediately without backoff at the DB call level.
- **File orphan risk**: If the API crashes after `storage.save()` but before `insertImageJob()`, an orphaned file stays in `/uploads`. A periodic cleanup job comparing DB records to filesystem would fix this.

---

## Running Locally

### Prerequisites
- Node.js 20+
- PostgreSQL 14+ running locally
- Redis 7+ running locally
- `jq` (for test script)

### Step 1: Clone and Install

```bash
git clone https://github.com/Vikash9546/Intelligent_media.git
cd Intelligent_media
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
# Edit .env with your PostgreSQL and Redis credentials
```

### Step 3: Create the Database

```bash
psql -U postgres -c "CREATE DATABASE media_pipeline;"
```

### Step 4: Run Migrations

```bash
npm run migrate
```

### Step 5: Start Redis

```bash
redis-server
# or: brew services start redis
```

### Step 6: Start the API Server

```bash
npm run dev
# Server starts at http://localhost:3000
# Bull Board dashboard at http://localhost:3000/admin/queues
```

### Step 7: Start the Worker (separate terminal)

```bash
npm run dev:worker
```

### Step 8: Run the Test Suite

```bash
chmod +x test.sh
./test.sh
```

---

### Sample curl Commands

**Upload an image:**
```bash
curl -X POST http://localhost:3000/api/v1/upload \
  -F "image=@/path/to/photo.jpg"
```

**Check job status:**
```bash
curl http://localhost:3000/api/v1/jobs/{jobId}/status
```

**Get analysis results:**
```bash
curl http://localhost:3000/api/v1/jobs/{jobId}/results
```

**Get failure details:**
```bash
curl http://localhost:3000/api/v1/jobs/{jobId}/failure
```

**List recent completed jobs:**
```bash
curl "http://localhost:3000/api/v1/jobs?page=1&limit=10&status=completed"
```

**Health check:**
```bash
curl http://localhost:3000/health
```

**Upload a non-image (should fail with 415):**
```bash
curl -X POST http://localhost:3000/api/v1/upload \
  -F "image=@/etc/hosts;type=text/plain"
```

**Request results before job completes (should return 409):**
```bash
# Upload then immediately request results
JOB_ID=$(curl -s -X POST http://localhost:3000/api/v1/upload \
  -F "image=@photo.jpg" | jq -r '.jobId')
curl http://localhost:3000/api/v1/jobs/$JOB_ID/results
```

---

## Docker Setup

### Full stack with one command:

```bash
docker-compose up --build
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **API server** on port 3000 (runs migrations on startup)
- **Worker** (starts after API is healthy)

All services use shared Docker volumes for uploads and database persistence.

### Verify it's running:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

### Scale workers:

```bash
docker-compose up --scale worker=3
```

---

## Project Structure

```
src/
├── server.ts              ← API entry point (starts Express, runs migrations)
├── worker.ts              ← Worker entry point (starts BullMQ worker)
├── api/
│   ├── app.ts             ← Express app factory
│   ├── upload.ts          ← POST /api/v1/upload handler
│   ├── jobs.ts            ← Status, results, failure, list handlers
│   └── errorHandler.ts    ← Global error middleware
├── queue/
│   ├── producer.ts        ← BullMQ queue + enqueue function
│   └── consumer.ts        ← BullMQ worker + job processor
├── analysis/
│   ├── types.ts           ← CheckResult interface
│   ├── index.ts           ← Orchestrator (runs all 6 checks concurrently)
│   ├── blurDetection.ts   ← Laplacian variance
│   ├── brightnessAnalysis.ts  ← Mean luminance
│   ├── duplicateDetection.ts  ← dHash + Hamming distance
│   ├── screenshotDetection.ts ← EXIF + aspect ratio + Sobel edges
│   ├── ocrPlateDetection.ts   ← Tesseract + Indian plate regex
│   └── dimensionValidation.ts ← Metadata read, dimension/ratio checks
├── db/
│   ├── pool.ts            ← PostgreSQL connection pool singleton
│   ├── migrate.ts         ← Sequential migration runner
│   └── models.ts          ← Typed query functions
├── storage/
│   └── provider.ts        ← StorageProvider interface + LocalStorageProvider
└── utils/
    ├── logger.ts          ← Pino structured logger
    ├── errors.ts          ← AppError hierarchy (fatal vs transient)
    └── constants.ts       ← All thresholds + weights (documented)
```
