/**
 * Test billing endpoints to ensure they work with new credit system
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

async function testPlansEndpoint() {
  console.log('🧪 Testing /api/billing/plans endpoint...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/billing/plans`);
    const data = await response.json();
    
    console.log('Plans response:', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      throw new Error('Plans endpoint did not return success');
    }
    
    if (!data.plans || !data.creditPacks) {
      throw new Error('Plans or creditPacks missing from response');
    }
    
    console.log('✅ Plans endpoint test passed');
    return true;
  } catch (error) {
    console.error('❌ Plans endpoint test failed:', error);
    return false;
  }
}

async function testHealthEndpoint() {
  console.log('🧪 Testing server health...');
  
  try {
    const response = await fetch(`${BASE_URL}/api/health`);
    if (response.ok) {
      console.log('✅ Server is healthy');
      return true;
    } else {
      console.log('⚠️ Server health check failed');
      return false;
    }
  } catch (error) {
    console.error('❌ Server health check failed:', error);
    return false;
  }
}

async function runBillingTests() {
  console.log('🚀 Starting Billing Endpoints Tests\n');
  
  const healthOk = await testHealthEndpoint();
  if (!healthOk) {
    console.log('❌ Server is not responding, skipping billing tests');
    return;
  }
  
  const plansOk = await testPlansEndpoint();
  
  if (plansOk) {
    console.log('\n🎉 All billing endpoint tests passed!');
  } else {
    console.log('\n❌ Some billing endpoint tests failed');
  }
}

// Run tests
runBillingTests().catch(console.error);