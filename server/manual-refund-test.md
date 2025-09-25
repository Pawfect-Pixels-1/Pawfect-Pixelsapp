# Manual Refund Testing Guide

This guide provides step-by-step instructions to manually test all refund success paths using the actual API endpoints.

## Prerequisites

1. Start the server: `npm run dev`
2. Have a user account with some credits (can use the frontend or create via API)
3. Use API testing tool like Postman, curl, or the frontend

## Test Scenarios

### Test 1: Pure Daily Credits Refund (Timeout Scenario)

**Setup**: User with 10 daily credits used, 0 balance (40 daily remaining)

```bash
# 1. Register/login to get user with credits
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser1", "password": "test123", "email": "test1@example.com"}'

# 2. Login to get session
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "testuser1", "password": "test123"}' \
  -c cookies.txt

# 3. Check initial credits
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt

# 4. Start image transformation (should reserve 4 credits from daily)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=1"

# 5. Check credits after reservation (should show 4 credits deducted from daily)
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt

# 6. Wait for timeout or failure, then check credits again
# Credits should be refunded back to daily (not converted to balance)
```

**Expected Result**: 
- After reservation: dailyCreditsUsed increases by 4
- After refund: dailyCreditsUsed returns to original value, balance stays 0

### Test 2: Pure Balance Credits Refund

**Setup**: User with 50 daily credits used (maxed), 100 balance

```bash
# Update user to have maxed daily credits
# Use database or admin endpoint to set dailyCreditsUsed=50, creditsBalance=100

# Start transformation (should use balance credits)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=1"

# Check credits - should show balance reduced by 4
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt
```

**Expected Result**:
- After reservation: balance decreases by 4, daily stays at 50
- After refund: balance returns to 100, daily stays at 50

### Test 3: Mixed Daily + Balance Credits Refund

**Setup**: User with 48 daily credits used (2 remaining), 100 balance

```bash
# Start transformation requiring 4 credits (2 from daily, 2 from balance)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=1"
```

**Expected Result**:
- After reservation: dailyCreditsUsed=50, balance=98
- After refund: dailyCreditsUsed=48, balance=100

### Test 4: Abuse Prevention Test

**Setup**: User with 10 daily credits used, 20 balance

```bash
# Start 2-image transformation (8 credits, should come from daily since 40 available)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=2"
```

**Expected Result**:
- After reservation: dailyCreditsUsed=18, balance=20 (unchanged)
- After refund: dailyCreditsUsed=10, balance=20 (NO conversion to balance!)

### Test 5: Video Credits Refund (Gen4-Aleph)

**Setup**: User with 0 daily used, 100 balance

```bash
# Start 3-second Gen4-Aleph video (54 credits: 50 from daily, 4 from balance)
curl -X POST http://localhost:5000/api/video/gen4-aleph \
  -b cookies.txt \
  -F "video=@/path/to/test/video.mp4" \
  -F "options={\"prompt\":\"test transformation\",\"clipSeconds\":3}"
```

**Expected Result**:
- After reservation: dailyCreditsUsed=50, balance=96
- After refund: dailyCreditsUsed=0, balance=100

### Test 6: Prediction Creation Failure Refund (Deterministic)

**Setup**: Use dev endpoint to force prediction creation failure

```bash
# Step 1: Enable creation failure injection
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forceCreateFailure": true}'

# Step 2: Start transformation (will fail during prediction creation)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=1"

# Step 3: Check credits immediately - should be refunded instantly
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt

# Step 4: Disable injection for other tests
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forceCreateFailure": false}'
```

**Expected Result**:
- Credits should be reserved initially
- Credits should be immediately refunded when prediction creation fails
- Operation status should be marked as failed in database
- Error message should indicate "TEST: Injected prediction creation failure"

### Test 7: Invalid Output Format Refund (Deterministic)

**Setup**: Use dev endpoint to force invalid output format

```bash
# Step 1: Enable invalid output injection
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forceInvalidOutput": true}'

# Step 2: Start transformation (will succeed but produce invalid output)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=1"

# Step 3: Check credits after failure - should be refunded
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt

# Step 4: Disable injection for other tests
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forceInvalidOutput": false}'
```

**Expected Result**:
- Credits should be reserved initially
- Prediction should succeed but output validation should fail
- Credits should be refunded when invalid output is detected
- Error message should indicate "Invalid output format from AI service"

### Test 8: Prediction Status Failed Refund (Deterministic)

**Setup**: Use dev endpoint to force prediction to report failed status

```bash
# Step 1: Enable prediction failure injection
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forcePredictionFailure": true}'

# Step 2: Start transformation (will succeed initially, then fail during status check)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=1"

# Step 3: Check status (will trigger failure injection) 
curl -X GET http://localhost:5000/api/status/OPERATION_ID_HERE \
  -b cookies.txt

# Step 4: Check credits after failure - should be refunded
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt

# Step 5: Disable injection for other tests
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forcePredictionFailure": false}'
```

**Expected Result**:
- Credits should be reserved initially during transformation
- Status check should trigger prediction failure injection
- Credits should be refunded when prediction failure is detected
- Error message should indicate "TEST: Injected prediction failure in status check"

### Test 9: Timeout Simulation Refund (Deterministic)

**Setup**: Use dev endpoint to simulate timeout during status polling

```bash
# Step 1: Enable timeout injection
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forceTimeout": true}'

# Step 2: Start transformation (will succeed initially)
curl -X POST http://localhost:5000/api/transform \
  -b cookies.txt \
  -F "image=@/path/to/test/image.jpg" \
  -F "style=vibrant" \
  -F "num_images=1"

# Step 3: Check status (will trigger timeout simulation)
# Note: This will take 10+ seconds due to artificial delay
curl -X GET http://localhost:5000/api/status/OPERATION_ID_HERE \
  -b cookies.txt

# Step 4: Check credits after timeout - should be refunded
curl -X GET http://localhost:5000/api/auth/me \
  -b cookies.txt

# Step 5: Disable injection for other tests
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forceTimeout": false}'
```

**Expected Result**:
- Credits should be reserved initially during transformation
- Status check should trigger timeout simulation (10 second delay)
- Client should eventually timeout and trigger error handling
- Credits should be refunded when timeout is detected

### Test 10: Concurrent Operations (Race Condition Test)

**Setup**: Test multiple simultaneous operations to verify no overcommit

```bash
# Create user with exactly 10 credits available
# Start 3 simultaneous 4-credit operations (12 credits needed, but only 10 available)

# Terminal 1:
curl -X POST http://localhost:5000/api/transform \
  -b cookies1.txt \
  -F "image=@/path/to/test1.jpg" \
  -F "style=vibrant" \
  -F "num_images=1" &

# Terminal 2 (immediately):
curl -X POST http://localhost:5000/api/transform \
  -b cookies1.txt \
  -F "image=@/path/to/test2.jpg" \
  -F "style=vibrant" \
  -F "num_images=1" &

# Terminal 3 (immediately):
curl -X POST http://localhost:5000/api/transform \
  -b cookies1.txt \
  -F "image=@/path/to/test3.jpg" \
  -F "style=vibrant" \
  -F "num_images=1" &

wait
```

**Expected Result**:
- Only 2 operations should succeed (8 credits used)
- 1 operation should fail with insufficient credits error
- No overcommit should occur
- Database row locking should prevent race conditions

### Test 9: Double Refund Prevention

**Setup**: Verify that operations can't be refunded twice

```bash
# This requires direct database access or admin endpoint
# 1. Start an operation that will fail
# 2. Let it refund naturally
# 3. Try to manually trigger refund again (should be prevented)

# Check operation status in database:
SELECT id, status, "creditsDeducted" FROM operations WHERE id = 'operation_id_here';

# If creditsDeducted = false, second refund should be skipped
```

## Monitoring Refunds

### Using Dev Endpoints (Recommended)

```bash
# Get specific operation details
curl -X GET http://localhost:5000/api/dev/operation/OPERATION_ID_HERE \
  -b cookies.txt

# Get recent operations for a user
curl -X GET http://localhost:5000/api/dev/user/USER_ID_HERE/operations?limit=5 \
  -b cookies.txt

# Set up user credit state for testing
curl -X POST http://localhost:5000/api/dev/set-user-credits \
  -H "Content-Type: application/json" \
  -d '{"userId": USER_ID, "dailyCreditsUsed": 10, "creditsBalance": 20, "dailyCreditsCap": 50}' \
  -b cookies.txt

# Enable/disable test injection
curl -X POST http://localhost:5000/api/dev/set-test-injection \
  -H "Content-Type: application/json" \
  -d '{"forceCreateFailure": true, "forceInvalidOutput": false}' \
  -b cookies.txt
```

### Alternative: Direct Database Queries

```sql
-- View recent operations and their credit allocations (using correct camelCase column names)
SELECT 
  id, 
  status, 
  "creditsPlanned",
  "dailyPortionReserved",
  "balancePortionReserved",
  "creditsDeducted",
  "createdAt",
  "completedAt",
  "failedAt"
FROM operations 
ORDER BY "createdAt" DESC 
LIMIT 10;
```

### Check User Credits

```sql
-- View user credit status (using correct camelCase column names)
SELECT 
  username,
  "dailyCreditsUsed",
  "creditsBalance",
  "dailyCreditsCap"
FROM users 
WHERE username = 'testuser1';
```

## Test Results Log

Document your findings for each test:

| Test | Initial Daily Used | Initial Balance | Reserved Daily | Reserved Balance | After Refund Daily | After Refund Balance | ✅/❌ |
|------|-------------------|-----------------|----------------|------------------|-------------------|---------------------|--------|
| Pure Daily | 10 | 0 | 4 | 0 | 10 | 0 | |
| Pure Balance | 50 | 100 | 0 | 4 | 50 | 100 | |
| Mixed | 48 | 100 | 2 | 2 | 48 | 100 | |
| Abuse Prevention | 10 | 20 | 8 | 0 | 10 | 20 | |
| Video | 0 | 100 | 50 | 4 | 0 | 100 | |
| Creation Failure | varies | varies | varies | varies | original | original | |
| Invalid Output | varies | varies | varies | varies | original | original | |
| Concurrent Ops | 2 | 0 | 8 | 0 | varies | 0 | |
| Double Refund | varies | varies | 0 | 0 | unchanged | unchanged | |

## Success Criteria

✅ **All tests pass if**:
1. Credits are reserved correctly during operation creation
2. Refunds restore the exact original credit split
3. Daily credits are never converted to balance credits
4. No double refunds occur
5. Mixed scenarios work correctly

❌ **Critical failure if**:
- Daily credits get converted to balance (abuse vulnerability)
- Credits are not refunded on failures
- Wrong amounts are refunded
- Double refunds occur