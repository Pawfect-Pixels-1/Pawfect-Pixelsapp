#!/usr/bin/env bash
set -euo pipefail

# 🧪 Concurrent Operations Test Script (hardened)
# - Tests race conditions & overcommit prevention with strict error handling.

### --- Config (edit if needed) ---
BASE_URL="${BASE_URL:-http://localhost:5000}"
OP_CREDITS=4                 # credits per /api/transform call
DAILY_CAP=10                 # set user to this cap
CONCURRENT_OPS=3             # how many concurrent operations to launch
STYLE="${STYLE:-vibrant}"    # style sent to transform endpoint
IMG_NAME="${IMG_NAME:-test-image.jpg}"
CURL_MAX_TIME=60             # seconds
### ------------------------------

echo "🧪 Starting Concurrent Operations Test"
echo "📋 Test Setup:"
echo "  Base URL: $BASE_URL"
echo "  Operation credits: $OP_CREDITS"
echo "  Daily cap: $DAILY_CAP"
echo "  Concurrent operations: $CONCURRENT_OPS"
echo "  Style: $STYLE"
echo "  Image: $IMG_NAME"
echo "  cURL max time: $CURL_MAX_TIME"

# --- Dependencies ---
for bin in curl jq mktemp base64; do
  command -v "$bin" >/dev/null 2>&1 || { echo "❌ Missing dependency: $bin"; exit 1; }
done

# --- Temp files & cleanup ---
COOKIE_FILE="$(mktemp -t cookies.XXXXXX)"
RESULT_DIR="$(mktemp -d -t conc_results.XXXXXX)"
trap 'rm -f "$COOKIE_FILE"; rm -rf "$RESULT_DIR"; [ -f "$IMG_NAME" ] && rm -f "$IMG_NAME"; echo "🧹 Cleanup done."' EXIT

# --- Utility: cURL wrapper ---
curl_json() {
  local method="$1"; shift
  local url="$1"; shift
  curl \
    --fail-with-body --show-error --silent \
    --max-time "$CURL_MAX_TIME" \
    -X "$method" "$url" \
    -H "Accept: application/json" \
    "$@"
}

# --- Create tiny JPEG if needed (1x1 white) ---
if [ ! -f "$IMG_NAME" ]; then
  echo "4️⃣ Creating test image..."
  # 1x1 px JPEG (base64). Safer than echoing binary escapes.
  base64 -d > "$IMG_NAME" <<'B64'
/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAkGBxAQEA8QDw8QDw8PDw8PDw8PDw8PFREWFhURFRUY
HSggGBolGxUVITEhJSkrLi4uFx8zODMsNygtLisBCgoKDg0OGxAQGy0lICUtLS0tLS0tLS0tLS0t
LS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLf/AABEIAAEAAQMBIgACEQEDEQH/xAAX
AAEAAwAAAAAAAAAAAAAAAAACAQME/8QAFxABAQEBAAAAAAAAAAAAAAAAAQACIf/aAAwDAQACEQMR
AD8A7gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z
B64
fi

# --- Generate unique username/email for isolation ---
TS="$(date +%s)"
USERNAME="concurrency_test_${TS}"
PASSWORD="test123"
EMAIL="${USERNAME}@example.com"
echo "  Username: $USERNAME"

# 1) Register
echo "1️⃣ Creating test user..."
curl_json POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg u "$USERNAME" --arg p "$PASSWORD" --arg e "$EMAIL" '{username:$u,password:$p,email:$e}')" \
  >/dev/null || { echo "❌ Register failed"; exit 1; }

# 2) Login (save cookie)
echo "2️⃣ Logging in..."
curl \
  --fail-with-body --show-error --silent \
  --max-time "$CURL_MAX_TIME" \
  -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg u "$USERNAME" --arg p "$PASSWORD" '{username:$u,password:$p}')" \
  -c "$COOKIE_FILE" \
  >/dev/null || { echo "❌ Login failed"; exit 1; }

# 3) Fetch user/me
echo "3️⃣ Setting up test conditions..."
ME_JSON="$(curl_json GET "$BASE_URL/api/auth/me" -b "$COOKIE_FILE")"
USER_ID="$(jq -er '.user.id' <<<"$ME_JSON")" || { echo "❌ Unable to read user.id from /me"; exit 1; }
INITIAL_USED="$(jq -er '.user.dailyCreditsUsed // 0' <<<"$ME_JSON")"
echo "  User ID: $USER_ID"
echo "  Initial dailyCreditsUsed: $INITIAL_USED"

# Set credits: exactly DAILY_CAP available (dailyCreditsUsed=0, balance=0, cap=DAILY_CAP)
echo "  Setting user to have exactly ${DAILY_CAP} credits available..."
curl_json POST "$BASE_URL/api/dev/set-user-credits" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --argjson id "$USER_ID" --argjson used 0 --argjson bal 0 --argjson cap "$DAILY_CAP" \
        '{userId:$id,dailyCreditsUsed:$used,creditsBalance:$bal,dailyCreditsCap:$cap}')" \
  >/dev/null || { echo "❌ set-user-credits failed"; exit 1; }

# Verify setup
ME2_JSON="$(curl_json GET "$BASE_URL/api/auth/me" -b "$COOKIE_FILE")"
UPDATED_USED="$(jq -er '.user.dailyCreditsUsed // 0' <<<"$ME2_JSON")"
CREDITS_CAP="$(jq -er '.user.dailyCreditsCap // 0' <<<"$ME2_JSON")"
CREDITS_BALANCE="$(jq -er '.user.creditsBalance // 0' <<<"$ME2_JSON")"
echo "  Updated setup: dailyUsed=$UPDATED_USED, cap=$CREDITS_CAP, balance=$CREDITS_BALANCE"

# 5) Launch concurrent operations
echo "5️⃣ Launching ${CONCURRENT_OPS} concurrent ${OP_CREDITS}-credit operations (total ${CONCURRENT_OPS*OP_CREDITS}, cap ${DAILY_CAP})..."
pids=()
for i in $(seq 1 "$CONCURRENT_OPS"); do
  out="$RESULT_DIR/result${i}.json"
  (
    curl \
      --fail-with-body --show-error --silent \
      --max-time "$CURL_MAX_TIME" \
      -X POST "$BASE_URL/api/transform" \
      -b "$COOKIE_FILE" \
      -F "image=@${IMG_NAME}" \
      -F "style=${STYLE}" \
      -F "num_images=1" \
      -o "$out" || echo '{"success":false,"error":"HTTP request failed"}' >"$out"
  ) &
  pids+=($!)
done

echo "  Waiting for operations to complete..."
for pid in "${pids[@]}"; do
  wait "$pid"
done

echo "6️⃣ Analyzing results..."
SUCCESS_COUNT=0
FAILURE_COUNT=0
INSUFFICIENT_FAILURES=0

for i in $(seq 1 "$CONCURRENT_OPS"); do
  f="$RESULT_DIR/result${i}.json"
  if [ -s "$f" ]; then
    # best-effort parse
    success="$(jq -r 'try .success // false' "$f" 2>/dev/null || echo false)"
    if [ "$success" = "true" ]; then
      SUCCESS_COUNT=$((SUCCESS_COUNT+1))
      echo "  Operation $i: ✅ SUCCESS"
    else
      FAILURE_COUNT=$((FAILURE_COUNT+1))
      error_msg="$(jq -r 'try .error // "Unknown error"' "$f" 2>/dev/null || echo "Unknown error")"
      echo "  Operation $i: ❌ FAILED - $error_msg"
      if grep -qi "insufficient credits" <<<"$error_msg"; then
        INSUFFICIENT_FAILURES=$((INSUFFICIENT_FAILURES+1))
      fi
    fi
  else
    FAILURE_COUNT=$((FAILURE_COUNT+1))
    echo "  Operation $i: ❌ NO RESPONSE FILE"
  fi
done

# Final credits check
ME3_JSON="$(curl_json GET "$BASE_URL/api/auth/me" -b "$COOKIE_FILE")"
FINAL_USED="$(jq -er '.user.dailyCreditsUsed // 0' <<<"$ME3_JSON")"
CREDITS_USED=$((FINAL_USED - UPDATED_USED))

echo "7️⃣ Test Results:"
echo "  Successful operations: $SUCCESS_COUNT"
echo "  Failed operations: $FAILURE_COUNT"
echo "  Credits used: $CREDITS_USED"
echo "  Final dailyCreditsUsed: $FINAL_USED"

# 8) Validation against expectations
echo "8️⃣ Validation:"
expected_success=$((DAILY_CAP / OP_CREDITS)) # integer division
[ "$expected_success" -gt "$CONCURRENT_OPS" ] && expected_success="$CONCURRENT_OPS"
expected_fail=$((CONCURRENT_OPS - expected_success))
expected_credits=$((expected_success * OP_CREDITS))

if [ "$SUCCESS_COUNT" -eq "$expected_success" ] && \
   [ "$FAILURE_COUNT" -eq "$expected_fail" ] && \
   [ "$CREDITS_USED" -eq "$expected_credits" ]; then
  echo "  ✅ PASS: $expected_success success, $expected_fail failure, $expected_credits credits used"
  echo "  ✅ PASS: No overcommit occurred; race conditions prevented"
else
  echo "  ❌ FAIL: Expected $expected_success success, $expected_fail failure, $expected_credits credits used"
  echo "  ❌ FAIL: Actual: $SUCCESS_COUNT success, $FAILURE_COUNT failure, $CREDITS_USED credits"
fi

# 9) DB validation (optional endpoints)
echo "9️⃣ Database Validation:"
ops_json="$(curl_json GET "$BASE_URL/api/dev/user/$USER_ID/operations?limit=5" || echo '{"operations":[]}')"
ops_count="$(jq -r 'try .operations | length // 0' <<<"$ops_json")"
echo "  Operations found in database: $ops_count"

if [ "$ops_count" -eq "$expected_success" ]; then
  echo "  ✅ PASS: Exactly $expected_success operations found in database"
  total_daily="$(jq -r 'try (.operations | map(.dailyPortionReserved // 0) | add) // 0' <<<"$ops_json")"
  total_balance="$(jq -r 'try (.operations | map(.balancePortionReserved // 0) | add) // 0' <<<"$ops_json")"
  echo "  Total daily credits reserved: $total_daily"
  echo "  Total balance credits reserved: $total_balance"
  if [ "$total_daily" -eq "$expected_credits" ] && [ "$total_balance" -eq 0 ]; then
    echo "  ✅ PASS: Credit reservation tracking is accurate"
  else
    echo "  ❌ FAIL: Unexpected credit reservation amounts"
  fi
  successful_ops="$(jq -r 'try ([.operations[] | select(.creditsDeducted == true)] | length) // 0' <<<"$ops_json")"
  deducted_completed="$(jq -r 'try ([.operations[] | select(.creditsDeducted == true and .status == "completed")] | length) // 0' <<<"$ops_json")"
  echo "  Operations with creditsDeducted=true: $successful_ops"
  echo "  Completed operations with creditsDeducted=true: $deducted_completed"
  if [ "$successful_ops" -eq "$expected_success" ] && [ "$deducted_completed" -eq "$expected_success" ]; then
    echo "  ✅ PASS: Credit deduction matches completed operations"
  else
    echo "  ❌ FAIL: Unexpected credit deduction status"
  fi
else
  echo "  ⚠️  NOTE: Expected $expected_success operations in DB; found $ops_count"
fi

# 🔟 Failure validation for "Insufficient credits"
echo "🔟 Failure Validation:"
if [ "$expected_fail" -eq 0 ]; then
  echo "  (No failures expected at this cap/credit ratio.)"
else
  echo "  Checking failure responses for 'Insufficient credits' message..."
  if [ "$INSUFFICIENT_FAILURES" -eq "$expected_fail" ]; then
    echo "  ✅ PASS: Exactly $expected_fail request(s) failed due to insufficient credits"
  else
    echo "  ❌ FAIL: Expected $expected_fail insufficient-credits failure(s), found: $INSUFFICIENT_FAILURES"
  fi
fi

echo "🏁 Concurrent operations test complete!"
