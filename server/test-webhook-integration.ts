/**
 * Test webhook integration with new credit system
 */

import { db } from "./storage";
import { users, userBilling, creditLedger } from "../shared/schema";
import { eq } from "drizzle-orm";
import { creditDelta } from "./services/credits";

async function testWebhookIntegration() {
  console.log('🧪 Testing webhook integration with new credit system...');
  
  try {
    // Test 1: Verify credit system can handle webhook-style operations
    const TEST_USER_ID = 998;
    
    // Clean up any existing test data
    await db.delete(creditLedger).where(eq(creditLedger.userId, TEST_USER_ID));
    await db.delete(userBilling).where(eq(userBilling.userId, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    
    // Create test user
    await db.insert(users).values({
      id: TEST_USER_ID,
      email: "webhook@test.com",
      username: "webhook_test",
      password: "test_hash",
      plan: "trial",
      creditsBalance: 0,
    });
    
    // Simulate webhook credit pack purchase
    const creditPackResult = await creditDelta(
      TEST_USER_ID,
      500, // Medium pack
      'credit_pack',
      'checkout_session_webhook_test',
      { pack: 'medium', sessionId: 'cs_test_123' }
    );
    
    console.log('Credit pack simulation result:', creditPackResult);
    
    // Verify credits were added
    if (creditPackResult.credits !== 500) {
      throw new Error(`Expected 500 credits, got ${creditPackResult.credits}`);
    }
    
    // Test 2: Verify billing record creation (as webhook would do)
    await db.insert(userBilling).values({
      userId: TEST_USER_ID,
      plan: 'basic',
      status: 'active',
      version: 1,
    });
    
    // Test 3: Verify subscription credit grant simulation
    const subscriptionResult = await creditDelta(
      TEST_USER_ID,
      1000, // Basic plan monthly credits
      'subscription_grant',
      'sub_webhook_test_period_start',
      { subscriptionId: 'sub_test_123', plan: 'basic' }
    );
    
    console.log('Subscription credit grant result:', subscriptionResult);
    
    // Verify total credits
    if (subscriptionResult.credits !== 1500) { // 500 + 1000
      throw new Error(`Expected 1500 total credits, got ${subscriptionResult.credits}`);
    }
    
    // Clean up
    await db.delete(creditLedger).where(eq(creditLedger.userId, TEST_USER_ID));
    await db.delete(userBilling).where(eq(userBilling.userId, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    
    console.log('✅ Webhook integration test passed');
    return true;
    
  } catch (error) {
    console.error('❌ Webhook integration test failed:', error);
    return false;
  }
}

// Run test
testWebhookIntegration().catch(console.error);