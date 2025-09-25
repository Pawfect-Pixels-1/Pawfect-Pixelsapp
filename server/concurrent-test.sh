#!/bin/bash

# Concurrent Operations Test Script
# Tests race conditions and overcommit prevention

echo "🧪 Starting Concurrent Operations Test"

# Configuration
BASE_URL="http://localhost:5000"
USERNAME="concurrency_test_$(date +%s)"
PASSWORD="test123"
EMAIL="${USERNAME}@example.com"
TEST_IMAGE="test-image.jpg"

echo "📋 Test Setup:"
echo "  Username: $USERNAME"
echo "  Base URL: $BASE_URL"

# Step 1: Create test user
echo "1️⃣ Creating test user..."
curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\", \"email\": \"$EMAIL\"}" \
  -o /dev/null

# Step 2: Login and save cookies
echo "2️⃣ Logging in..."
curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"$USERNAME\", \"password\": \"$PASSWORD\"}" \
  -c cookies.txt \
  -o /dev/null

# Step 3: Check initial credits and set up test conditions
echo "3️⃣ Setting up test conditions..."
USER_ID=$(curl -s -X GET "$BASE_URL/api/auth/me" -b cookies.txt | jq -r '.user.id')
INITIAL_CREDITS=$(curl -s -X GET "$BASE_URL/api/auth/me" -b cookies.txt | jq -r '.user.dailyCreditsUsed // 0')
echo "  User ID: $USER_ID"
echo "  Initial dailyCreditsUsed: $INITIAL_CREDITS"

# Set user to have exactly 10 credits available (dailyCreditsCap=10, dailyCreditsUsed=0)
echo "  Setting user to have exactly 10 credits available..."
curl -s -X POST "$BASE_URL/api/dev/set-user-credits" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": $USER_ID, \"dailyCreditsUsed\": 0, \"creditsBalance\": 0, \"dailyCreditsCap\": 10}" \
  -o /dev/null

# Verify the setup
UPDATED_CREDITS=$(curl -s -X GET "$BASE_URL/api/auth/me" -b cookies.txt | jq -r '.user.dailyCreditsUsed // 0')
CREDITS_CAP=$(curl -s -X GET "$BASE_URL/api/auth/me" -b cookies.txt | jq -r '.user.dailyCreditsCap // 0')
CREDITS_BALANCE=$(curl -s -X GET "$BASE_URL/api/auth/me" -b cookies.txt | jq -r '.user.creditsBalance // 0')
echo "  Updated setup: dailyUsed=$UPDATED_CREDITS, cap=$CREDITS_CAP, balance=$CREDITS_BALANCE"

# Step 4: Create a simple test image if it doesn't exist
if [ ! -f "$TEST_IMAGE" ]; then
  echo "4️⃣ Creating test image..."
  # Create a simple 1x1 pixel JPEG for testing
  echo -n -e '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0C\x14\r\x0C\x0B\x0B\x0C\x19\x12\x13\x0F\x14\x1D\x1A\x1F\x1E\x1D\x1A\x1C\x1C $.\x27 \x20\x2C\x2C\x1C\x1C(7),01444\x1F\x27=9=82<.342\xFF\xC0\x00\x11\x08\x00\x01\x00\x01\x01\x01\x11\x00\x02\x11\x01\x03\x11\x01\xFF\xC4\x00\x14\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xFF\xC4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xFF\xDA\x00\x0C\x03\x01\x00\x02\x11\x03\x11\x00\x3F\x00\xAA\xFF\xD9' > "$TEST_IMAGE"
fi

# Step 5: Launch concurrent operations
echo "5️⃣ Launching 3 concurrent 4-credit operations (12 total, but user has max 10 available)..."

# Each operation needs 4 credits (1 image transformation)
# With default daily cap of 10, only 2 operations should succeed

PIDS=()

# Operation 1
curl -s -X POST "$BASE_URL/api/transform" \
  -b cookies.txt \
  -F "image=@$TEST_IMAGE" \
  -F "style=vibrant" \
  -F "num_images=1" \
  -o result1.json &
PIDS+=($!)

# Operation 2  
curl -s -X POST "$BASE_URL/api/transform" \
  -b cookies.txt \
  -F "image=@$TEST_IMAGE" \
  -F "style=vibrant" \
  -F "num_images=1" \
  -o result2.json &
PIDS+=($!)

# Operation 3
curl -s -X POST "$BASE_URL/api/transform" \
  -b cookies.txt \
  -F "image=@$TEST_IMAGE" \
  -F "style=vibrant" \
  -F "num_images=1" \
  -o result3.json &
PIDS+=($!)

echo "  Waiting for operations to complete..."
for pid in "${PIDS[@]}"; do
  wait $pid
done

echo "6️⃣ Analyzing results..."

# Check results
SUCCESS_COUNT=0
FAILURE_COUNT=0

for i in {1..3}; do
  if [ -f "result$i.json" ]; then
    SUCCESS=$(cat "result$i.json" | jq -r '.success // false')
    if [ "$SUCCESS" = "true" ]; then
      SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
      echo "  Operation $i: ✅ SUCCESS"
    else
      FAILURE_COUNT=$((FAILURE_COUNT + 1))
      ERROR=$(cat "result$i.json" | jq -r '.error // "Unknown error"')
      echo "  Operation $i: ❌ FAILED - $ERROR"
    fi
  else
    echo "  Operation $i: ❌ NO RESPONSE FILE"
    FAILURE_COUNT=$((FAILURE_COUNT + 1))
  fi
done

# Check final credits  
FINAL_CREDITS=$(curl -s -X GET "$BASE_URL/api/auth/me" -b cookies.txt | jq -r '.user.dailyCreditsUsed // 0')
CREDITS_USED=$((FINAL_CREDITS - UPDATED_CREDITS))

echo "7️⃣ Test Results:"
echo "  Successful operations: $SUCCESS_COUNT"
echo "  Failed operations: $FAILURE_COUNT"
echo "  Credits used: $CREDITS_USED"
echo "  Final dailyCreditsUsed: $FINAL_CREDITS"

# Validate results
echo "8️⃣ Validation:"

# With 10 credit cap and 4 credits per operation:
# - 2 operations should succeed (8 credits total)
# - 1 operation should fail due to insufficient credits
# - Final credits used should be 8

if [ $SUCCESS_COUNT -eq 2 ] && [ $FAILURE_COUNT -eq 1 ] && [ $CREDITS_USED -eq 8 ]; then
  echo "  ✅ PASS: Exactly 2 operations succeeded, 1 failed, 8 credits used"
  echo "  ✅ PASS: No overcommit occurred, race conditions prevented"
  echo "  ✅ PASS: User had 10 credits available, 2×4-credit operations succeeded"
else
  echo "  ❌ FAIL: Expected 2 success, 1 failure, 8 credits used"
  echo "  ❌ FAIL: Actual: $SUCCESS_COUNT success, $FAILURE_COUNT failure, $CREDITS_USED credits"
  echo "  ❌ FAIL: This indicates potential race condition or overcommit vulnerability"
fi

# Additional validation: Check operations in database
echo "9️⃣ Database Validation:"
echo "  Checking operations created for user $USER_ID..."
OPERATIONS_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dev/user/$USER_ID/operations?limit=5")
OPERATIONS_COUNT=$(echo "$OPERATIONS_RESPONSE" | jq -r '.operations | length')
echo "  Operations found in database: $OPERATIONS_COUNT"

# Strengthen validation as per architect requirements
if [ "$OPERATIONS_COUNT" -eq 2 ]; then
  echo "  ✅ PASS: Exactly 2 operations found in database"
  
  # Check that no operation was double-charged
  TOTAL_RESERVED_DAILY=$(echo "$OPERATIONS_RESPONSE" | jq -r '.operations | map(.dailyPortionReserved // 0) | add')
  TOTAL_RESERVED_BALANCE=$(echo "$OPERATIONS_RESPONSE" | jq -r '.operations | map(.balancePortionReserved // 0) | add')
  echo "  Total daily credits reserved: $TOTAL_RESERVED_DAILY"
  echo "  Total balance credits reserved: $TOTAL_RESERVED_BALANCE"
  
  if [ "$TOTAL_RESERVED_DAILY" -eq 8 ] && [ "$TOTAL_RESERVED_BALANCE" -eq 0 ]; then
    echo "  ✅ PASS: Credit reservation tracking is accurate"
  else
    echo "  ❌ FAIL: Unexpected credit reservation amounts"
  fi
  
  # Check that only operations with creditsDeducted=true are successful
  SUCCESSFUL_OPS=$(echo "$OPERATIONS_RESPONSE" | jq -r '[.operations[] | select(.creditsDeducted == true)] | length')
  DEDUCTED_OPS=$(echo "$OPERATIONS_RESPONSE" | jq -r '[.operations[] | select(.creditsDeducted == true and .status == "completed")] | length')
  echo "  Operations with creditsDeducted=true: $SUCCESSFUL_OPS"
  echo "  Completed operations with creditsDeducted=true: $DEDUCTED_OPS"
  
  if [ "$SUCCESSFUL_OPS" -eq 2 ] && [ "$DEDUCTED_OPS" -eq 2 ]; then
    echo "  ✅ PASS: Credit deduction matches completed operations"
  else
    echo "  ❌ FAIL: Unexpected credit deduction status"
  fi
else
  echo "  ❌ FAIL: Expected exactly 2 operations in database, found: $OPERATIONS_COUNT"
fi

# Check if any operation failed due to insufficient credits
echo "🔟 Failure Validation:"
echo "  Checking failure responses for 'Insufficient credits' message..."
INSUFFICIENT_FAILURES=0
for i in 1 2 3; do
  if [ -f "result${i}.json" ]; then
    ERROR_MSG=$(jq -r '.error // ""' "result${i}.json")
    if echo "$ERROR_MSG" | grep -q "Insufficient credits"; then
      INSUFFICIENT_FAILURES=$((INSUFFICIENT_FAILURES + 1))
      echo "  ✅ Request $i failed with 'Insufficient credits' message"
    elif [ -n "$ERROR_MSG" ]; then
      echo "  ⚠️  Request $i failed with different error: $ERROR_MSG"
    fi
  fi
done

if [ "$INSUFFICIENT_FAILURES" -eq 1 ]; then
  echo "  ✅ PASS: Exactly 1 request failed due to insufficient credits"
else
  echo "  ❌ FAIL: Expected 1 insufficient credits failure, found: $INSUFFICIENT_FAILURES"
fi

# Cleanup
echo "9️⃣ Cleanup..."
rm -f cookies.txt result*.json
if [ "$TEST_IMAGE" = "test-image.jpg" ]; then
  rm -f "$TEST_IMAGE"
fi

echo "🏁 Concurrent operations test complete!"