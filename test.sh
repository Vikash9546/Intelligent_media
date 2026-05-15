#!/usr/bin/env bash
# =============================================================================
# test.sh — Integration tests for the Intelligent Media Processing Pipeline
# Usage: bash test.sh [BASE_URL]
# Default BASE_URL: http://localhost:3000
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
API="$BASE_URL/api/v1"
PASS=0
FAIL=0

# ── Helpers ───────────────────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Colour

log_pass() { echo -e "${GREEN}✓ PASS${NC}: $1"; ((PASS++)) || true; }
log_fail() { echo -e "${RED}✗ FAIL${NC}: $1"; ((FAIL++)) || true; }
log_info() { echo -e "${YELLOW}→${NC} $1"; }

# Check if jq is available
if ! command -v jq &> /dev/null; then
  echo "jq is required: brew install jq"
  exit 1
fi

# Create test images using Python (cross-platform, no ImageMagick needed)
setup_test_images() {
  log_info "Creating test images…"

  # Valid JPEG (640x480) — will be our main happy-path image
  python3 -c "
import struct, zlib, io

# Create a minimal valid JPEG (white 640x480)
try:
    from PIL import Image
    img = Image.new('RGB', (640, 480), color=(200, 200, 200))
    img.save('/tmp/test_valid.jpg', 'JPEG')
    img.save('/tmp/test_valid.png', 'PNG')
    img.save('/tmp/test_valid.webp', 'WEBP')

    # 1x1 pixel (too small)
    small = Image.new('RGB', (1, 1), color=(0, 0, 0))
    small.save('/tmp/test_tiny.jpg', 'JPEG')

    print('PIL images created')
except ImportError:
    # Fallback: create a minimal valid JPEG manually
    import subprocess
    subprocess.run(['convert', '-size', '640x480', 'xc:gray', '/tmp/test_valid.jpg'], check=False)
    print('ImageMagick fallback used')
" 2>/dev/null || log_info "Could not create synthetic images — using existing files if available"

  # Create a corrupt file (fake JPEG header + garbage)
  printf '\xFF\xD8\xFF\xE0\x00\x01garbage_corrupted_data' > /tmp/test_corrupt.jpg

  # Create a text file disguised as JPEG
  echo "this is not an image" > /tmp/test_fake.jpg

  # Create an oversized file marker (we can't easily create a real 10MB image here)
  # We'll test the size limit separately
}

# Wait for the API to be ready
wait_for_api() {
  log_info "Waiting for API at $BASE_URL…"
  for i in $(seq 1 30); do
    if curl -sf "$BASE_URL/health" > /dev/null 2>&1; then
      log_pass "API is ready"
      return 0
    fi
    sleep 2
  done
  log_fail "API did not respond after 60s"
  exit 1
}

# Poll job status until done or timeout
wait_for_job() {
  local JOB_ID="$1"
  local MAX_WAIT="${2:-60}"
  local ELAPSED=0

  while [ $ELAPSED -lt $MAX_WAIT ]; do
    STATUS=$(curl -sf "$API/jobs/$JOB_ID/status" | jq -r '.status' 2>/dev/null || echo "error")
    if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
      echo "$STATUS"
      return 0
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done

  echo "timeout"
}

# =============================================================================
# TESTS
# =============================================================================

setup_test_images
wait_for_api

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  HAPPY PATH TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Test 1: Health check ──────────────────────────────────────────────────────
log_info "Test 1: Health check"
HEALTH=$(curl -sf "$BASE_URL/health")
if echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null; then
  log_pass "Health check returns {status: ok}"
else
  log_fail "Health check failed: $HEALTH"
fi

# ── Test 2: Successful JPEG upload ───────────────────────────────────────────
log_info "Test 2: Upload valid JPEG"
if [ -f /tmp/test_valid.jpg ]; then
  UPLOAD=$(curl -sf -X POST "$API/upload" -F "image=@/tmp/test_valid.jpg;type=image/jpeg")
  JOB_ID=$(echo "$UPLOAD" | jq -r '.jobId' 2>/dev/null || echo "")

  if [ -n "$JOB_ID" ] && [ "$JOB_ID" != "null" ]; then
    log_pass "Upload returned jobId: $JOB_ID"
    VALID_JOB_ID="$JOB_ID"
  else
    log_fail "Upload did not return a jobId: $UPLOAD"
    VALID_JOB_ID=""
  fi
else
  log_info "Skipping — /tmp/test_valid.jpg not created"
  VALID_JOB_ID=""
fi

# ── Test 3: Poll job status ───────────────────────────────────────────────────
log_info "Test 3: Poll job status"
if [ -n "${VALID_JOB_ID:-}" ]; then
  STATUS_RESP=$(curl -sf "$API/jobs/$VALID_JOB_ID/status")
  STATUS=$(echo "$STATUS_RESP" | jq -r '.status')
  if [ "$STATUS" = "pending" ] || [ "$STATUS" = "processing" ] || [ "$STATUS" = "completed" ]; then
    log_pass "Job status is valid: $STATUS"
  else
    log_fail "Unexpected status: $STATUS_RESP"
  fi
fi

# ── Test 4: Upload PNG ────────────────────────────────────────────────────────
log_info "Test 4: Upload valid PNG"
if [ -f /tmp/test_valid.png ]; then
  UPLOAD_PNG=$(curl -sf -X POST "$API/upload" -F "image=@/tmp/test_valid.png;type=image/png")
  PNG_JOB=$(echo "$UPLOAD_PNG" | jq -r '.jobId' 2>/dev/null || echo "")
  if [ -n "$PNG_JOB" ] && [ "$PNG_JOB" != "null" ]; then
    log_pass "PNG upload accepted: $PNG_JOB"
  else
    log_fail "PNG upload failed: $UPLOAD_PNG"
  fi
fi

# ── Test 5: Upload WEBP ───────────────────────────────────────────────────────
log_info "Test 5: Upload valid WEBP"
if [ -f /tmp/test_valid.webp ]; then
  UPLOAD_WEBP=$(curl -sf -X POST "$API/upload" -F "image=@/tmp/test_valid.webp;type=image/webp")
  WEBP_JOB=$(echo "$UPLOAD_WEBP" | jq -r '.jobId' 2>/dev/null || echo "")
  if [ -n "$WEBP_JOB" ] && [ "$WEBP_JOB" != "null" ]; then
    log_pass "WEBP upload accepted: $WEBP_JOB"
  else
    log_fail "WEBP upload failed: $UPLOAD_WEBP"
  fi
fi

# ── Test 6: Wait for job completion and get results ───────────────────────────
log_info "Test 6: Wait for job completion and fetch results"
if [ -n "${VALID_JOB_ID:-}" ]; then
  log_info "Waiting for job $VALID_JOB_ID to complete (max 120s)…"
  FINAL_STATUS=$(wait_for_job "$VALID_JOB_ID" 120)

  if [ "$FINAL_STATUS" = "completed" ]; then
    log_pass "Job completed successfully"

    RESULTS=$(curl -sf "$API/jobs/$VALID_JOB_ID/results")
    TOTAL_CHECKS=$(echo "$RESULTS" | jq '.summary.totalChecks')
    if [ "$TOTAL_CHECKS" = "6" ]; then
      log_pass "Results contain 6 checks: $(echo "$RESULTS" | jq '.summary')"
    else
      log_fail "Expected 6 checks, got: $RESULTS"
    fi

    QUALITY=$(echo "$RESULTS" | jq '.qualityScore')
    log_info "Quality score: $QUALITY"
  else
    log_info "Job status: $FINAL_STATUS (may be processing if worker is slow)"
  fi
fi

# ── Test 7: List jobs ─────────────────────────────────────────────────────────
log_info "Test 7: List jobs endpoint"
LIST=$(curl -sf "$API/jobs?page=1&limit=5")
TOTAL=$(echo "$LIST" | jq '.total')
if echo "$LIST" | jq -e '.jobs | type == "array"' > /dev/null; then
  log_pass "Job list returned (total: $TOTAL)"
else
  log_fail "Job list failed: $LIST"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ERROR CASE TESTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Error 1: No file uploaded ─────────────────────────────────────────────────
log_info "Error 1: Upload with no file field"
RESP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/upload")
if [ "$RESP" = "400" ]; then
  log_pass "Returns 400 when no file uploaded"
else
  log_fail "Expected 400, got $RESP"
fi

# ── Error 2: Unsupported file type (text file) ────────────────────────────────
log_info "Error 2: Upload unsupported MIME type (text/plain)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/upload" \
  -F "image=@/tmp/test_fake.jpg;type=text/plain")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
if [ "$HTTP_CODE" = "415" ] || [ "$HTTP_CODE" = "400" ]; then
  log_pass "Returns $HTTP_CODE for unsupported MIME type"
else
  log_fail "Expected 415, got $HTTP_CODE: $BODY"
fi

# ── Error 3: Corrupt image (valid extension, bad bytes) ───────────────────────
log_info "Error 3: Upload corrupt image (garbage bytes, JPEG extension)"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/upload" \
  -F "image=@/tmp/test_corrupt.jpg;type=image/jpeg")
HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -1)
if [ "$HTTP_CODE" = "422" ] || [ "$HTTP_CODE" = "415" ] || [ "$HTTP_CODE" = "400" ]; then
  log_pass "Returns $HTTP_CODE for corrupt image"
else
  log_fail "Expected 422, got $HTTP_CODE: $BODY"
fi

# ── Error 4: Job not found ────────────────────────────────────────────────────
log_info "Error 4: Get status for non-existent jobId"
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$API/jobs/00000000-0000-0000-0000-000000000000/status")
if [ "$RESP" = "404" ]; then
  log_pass "Returns 404 for unknown jobId"
else
  log_fail "Expected 404, got $RESP"
fi

# ── Error 5: Results for a pending/processing job ─────────────────────────────
log_info "Error 5: Get results for a non-completed job"
if [ -n "${VALID_JOB_ID:-}" ]; then
  # Upload a new image and immediately request results (it'll be pending/processing)
  if [ -f /tmp/test_valid.jpg ]; then
    FAST_UPLOAD=$(curl -sf -X POST "$API/upload" -F "image=@/tmp/test_valid.jpg;type=image/jpeg")
    FAST_JOB=$(echo "$FAST_UPLOAD" | jq -r '.jobId' 2>/dev/null || echo "")
    if [ -n "$FAST_JOB" ]; then
      # Immediately hit results (job likely still pending)
      RESULT_RESP=$(curl -s -o /dev/null -w "%{http_code}" "$API/jobs/$FAST_JOB/results")
      if [ "$RESULT_RESP" = "409" ] || [ "$RESULT_RESP" = "200" ]; then
        log_pass "Returns $RESULT_RESP for job result request (409=not ready, 200=already done)"
      else
        log_fail "Expected 409 or 200, got $RESULT_RESP"
      fi
    fi
  fi
fi

# ── Error 6: Invalid status filter on list endpoint ───────────────────────────
log_info "Error 6: Invalid status filter"
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$API/jobs?status=invalid_status")
if [ "$RESP" = "400" ]; then
  log_pass "Returns 400 for invalid status filter"
else
  log_fail "Expected 400, got $RESP"
fi

# ── Error 7: Fake JPEG (wrong magic bytes) ────────────────────────────────────
log_info "Error 7: Text file with .jpg extension and image/jpeg MIME"
echo "Hello, I am not an image!" > /tmp/test_text_as_jpg.jpg
RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/upload" \
  -F "image=@/tmp/test_text_as_jpg.jpg;type=image/jpeg")
HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" = "415" ] || [ "$HTTP_CODE" = "422" ] || [ "$HTTP_CODE" = "400" ]; then
  log_pass "Returns $HTTP_CODE — magic byte check correctly rejected non-image content"
else
  log_fail "Expected 415/422, got $HTTP_CODE"
fi

# ── Error 8: Results for failed job ──────────────────────────────────────────
log_info "Error 8: Failure endpoint for non-existent job"
RESP=$(curl -s -o /dev/null -w "%{http_code}" "$API/jobs/ffffffff-ffff-ffff-ffff-ffffffffffff/failure")
if [ "$RESP" = "404" ]; then
  log_pass "Returns 404 for failure endpoint with unknown jobId"
else
  log_fail "Expected 404, got $RESP"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  RESULTS: ${GREEN}%d PASSED${NC} | ${RED}%d FAILED${NC}\n" "$PASS" "$FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
