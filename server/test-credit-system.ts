/**
 * Credit System Migration Test
 * Tests all core credit system functionality to ensure migration is successful
 */

import { db } from "./storage";
import { users, userBilling, creditLedger, creditHolds } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import { 
  getBalance, 
  creditDelta, 
  reserveCredits, 
  commitHold, 
  cancelHold 
} from "./services/credits";

// Test user data
const TEST_USER_ID = 999;
const TEST_EMAIL = "test@example.com";
const TEST_USERNAME = "test_user";

async function setupTestUser() {
  console.log("🔧 Setting up test user...");
  
  // Clean up any existing test data
  await db.delete(creditHolds).where(eq(creditHolds.userId, TEST_USER_ID));
  await db.delete(creditLedger).where(eq(creditLedger.userId, TEST_USER_ID));
  await db.delete(userBilling).where(eq(userBilling.userId, TEST_USER_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  
  // Create test user
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    username: TEST_USERNAME,
    password: "test_password_hash", // Required field
    plan: "trial",
    creditsBalance: 0,
  });
  
  // Create test billing record
  await db.insert(userBilling).values({
    userId: TEST_USER_ID,
    plan: "trial",
    status: "active",
    version: 1,
  });
  
  console.log("✅ Test user created");
}

async function testGetBalance() {
  console.log("\n🧪 Testing getBalance function...");
  
  const balance = await getBalance(TEST_USER_ID);
  console.log("Balance result:", balance);
  
  // Should have zero balance initially
  if (balance.credits !== 0) {
    throw new Error(`Expected 0 credits, got ${balance.credits}`);
  }
  
  if (balance.plan !== "trial") {
    throw new Error(`Expected 'trial' plan, got ${balance.plan}`);
  }
  
  console.log("✅ getBalance test passed");
}

async function testCreditDelta() {
  console.log("\n🧪 Testing creditDelta function...");
  
  // Add credits
  const addResult = await creditDelta(
    TEST_USER_ID, 
    100, 
    'credit_pack', 
    'test_add_credits',
    { test: 'add_credits' }
  );
  console.log("Add credits result:", addResult);
  
  // Verify balance increased
  const balance1 = await getBalance(TEST_USER_ID);
  if (balance1.credits !== 100) {
    throw new Error(`Expected 100 credits after add, got ${balance1.credits}`);
  }
  
  // Subtract credits  
  const subResult = await creditDelta(
    TEST_USER_ID, 
    -30, 
    'generation_cost', 
    'test_subtract_credits',
    { test: 'subtract_credits' }
  );
  console.log("Subtract credits result:", subResult);
  
  // Verify balance decreased
  const balance2 = await getBalance(TEST_USER_ID);
  if (balance2.credits !== 70) {
    throw new Error(`Expected 70 credits after subtract, got ${balance2.credits}`);
  }
  
  // Test idempotency - same ledger key should not duplicate
  const duplicateResult = await creditDelta(
    TEST_USER_ID, 
    50, 
    'credit_pack', 
    'test_add_credits', // Same key as before
    { test: 'duplicate_attempt' }
  );
  console.log("Duplicate attempt result:", duplicateResult);
  
  const balance3 = await getBalance(TEST_USER_ID);
  if (balance3.credits !== 70) {
    throw new Error(`Idempotency failed: Expected 70 credits, got ${balance3.credits}`);
  }
  
  console.log("✅ creditDelta test passed");
}

async function testReservationSystem() {
  console.log("\n🧪 Testing credit reservation system...");
  
  // Reserve credits
  const holdId = await reserveCredits(TEST_USER_ID, 25, 'test_reservation');
  console.log("Hold ID:", holdId);
  
  if (!holdId) {
    throw new Error("Failed to create hold");
  }
  
  // Verify balance shows reserved credits
  const balance1 = await getBalance(TEST_USER_ID);
  const availableCredits = balance1.credits - balance1.held;
  if (availableCredits !== 45) { // 70 - 25 held
    throw new Error(`Expected 45 available credits, got ${availableCredits}`);
  }
  
  // Commit the hold
  const commitResult = await commitHold(holdId, 'test_commit', { test: 'commit' });
  console.log("Commit result:", commitResult);
  
  // Verify credits were deducted
  const balance2 = await getBalance(TEST_USER_ID);
  if (balance2.credits !== 45 || balance2.held !== 0) {
    throw new Error(`Expected 45 credits, 0 held after commit. Got ${balance2.credits} credits, ${balance2.held} held`);
  }
  
  // Test cancellation
  const holdId2 = await reserveCredits(TEST_USER_ID, 10, 'test_cancellation');
  if (!holdId2) {
    throw new Error("Failed to create second hold");
  }
  
  const cancelResult = await cancelHold(holdId2);
  console.log("Cancel result:", cancelResult);
  
  // Verify hold was released
  const balance3 = await getBalance(TEST_USER_ID);
  if (balance3.credits !== 45 || balance3.held !== 0) {
    throw new Error(`Expected 45 credits, 0 held after cancel. Got ${balance3.credits} credits, ${balance3.held} held`);
  }
  
  console.log("✅ Reservation system test passed");
}

async function testConcurrencyControl() {
  console.log("\n🧪 Testing optimistic concurrency control...");
  
  // Simulate concurrent updates
  const promises = Array.from({ length: 5 }, (_, i) => 
    creditDelta(
      TEST_USER_ID, 
      10, 
      'concurrent_test', 
      `concurrent_${i}`,
      { iteration: i }
    )
  );
  
  const results = await Promise.all(promises);
  console.log("Concurrent update results:", results.map(r => r.success));
  
  // Verify final balance
  const finalBalance = await getBalance(TEST_USER_ID);
  if (finalBalance.credits !== 95) { // 45 + (5 * 10)
    throw new Error(`Expected 95 credits after concurrent updates, got ${finalBalance.credits}`);
  }
  
  console.log("✅ Concurrency control test passed");
}

async function testErrorHandling() {
  console.log("\n🧪 Testing error handling...");
  
  // Test insufficient funds
  try {
    await reserveCredits(TEST_USER_ID, 1000, 'insufficient_funds_test');
    throw new Error("Should have failed with insufficient funds");
  } catch (error) {
    if ((error as Error).message.includes('Insufficient credits')) {
      console.log("✅ Insufficient funds error handled correctly");
    } else {
      throw error;
    }
  }
  
  // Test invalid hold commit
  try {
    await commitHold('invalid-hold-id', 'invalid_test', {});
    throw new Error("Should have failed with invalid hold ID");
  } catch (error) {
    if ((error as Error).message.includes('Hold not found')) {
      console.log("✅ Invalid hold ID error handled correctly");
    } else {
      throw error;
    }
  }
  
  console.log("✅ Error handling test passed");
}

async function cleanup() {
  console.log("\n🧹 Cleaning up test data...");
  
  await db.delete(creditHolds).where(eq(creditHolds.userId, TEST_USER_ID));
  await db.delete(creditLedger).where(eq(creditLedger.userId, TEST_USER_ID));
  await db.delete(userBilling).where(eq(userBilling.userId, TEST_USER_ID));
  await db.delete(users).where(eq(users.id, TEST_USER_ID));
  
  console.log("✅ Cleanup completed");
}

async function runTests() {
  try {
    console.log("🚀 Starting Credit System Migration Tests\n");
    
    await setupTestUser();
    await testGetBalance();
    await testCreditDelta();
    await testReservationSystem();
    await testConcurrencyControl();
    await testErrorHandling();
    
    console.log("\n🎉 All credit system tests passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    throw error;
  } finally {
    await cleanup();
  }
}

export { runTests };

// Run tests if called directly
runTests().catch(console.error);