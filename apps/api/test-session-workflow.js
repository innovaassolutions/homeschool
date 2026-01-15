// Simple integration test for session management workflow
// This tests the core session API endpoints without full TypeScript compilation

const axios = require('axios');

const API_BASE = 'http://localhost:8000/api';

// Mock test data
const testChild = {
  id: 'test-child-1',
  ageGroup: 'ages10to13'
};

const testSession = {
  type: 'lesson',
  childId: testChild.id,
  ageGroup: testChild.ageGroup,
  title: 'Test Math Session',
  description: 'Testing session management workflow',
  learningObjectives: [
    {
      description: 'Learn basic addition',
      category: 'knowledge',
      targetLevel: 'beginner'
    }
  ]
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSessionWorkflow() {
  console.log('🧪 Testing Session Management Workflow\n');

  try {
    // Test 1: Create a new session
    console.log('1️⃣ Creating new session...');
    const createResponse = await axios.post(`${API_BASE}/sessions`, testSession, {
      headers: { 'Content-Type': 'application/json' }
    });

    if (createResponse.status === 201) {
      console.log('✅ Session created successfully');
      console.log(`   Session ID: ${createResponse.data.session.id}`);
      console.log(`   State: ${createResponse.data.session.state}`);
    } else {
      throw new Error(`Expected 201, got ${createResponse.status}`);
    }

    const sessionId = createResponse.data.session.id;

    // Test 2: Get session details
    console.log('\n2️⃣ Fetching session details...');
    const getResponse = await axios.get(`${API_BASE}/sessions/${sessionId}`);

    if (getResponse.status === 200) {
      console.log('✅ Session fetched successfully');
      console.log(`   Title: ${getResponse.data.title}`);
      console.log(`   Type: ${getResponse.data.type}`);
      console.log(`   State: ${getResponse.data.state}`);
    } else {
      throw new Error(`Expected 200, got ${getResponse.status}`);
    }

    // Test 3: Start the session
    console.log('\n3️⃣ Starting session...');
    const startResponse = await axios.post(`${API_BASE}/sessions/${sessionId}/start`);

    if (startResponse.status === 200) {
      console.log('✅ Session started successfully');
      console.log(`   State: ${startResponse.data.session.state}`);
      console.log(`   Start time: ${startResponse.data.session.startTime}`);
    } else {
      throw new Error(`Expected 200, got ${startResponse.status}`);
    }

    // Test 4: Pause the session
    console.log('\n4️⃣ Pausing session...');
    await sleep(1000); // Wait a second
    const pauseResponse = await axios.post(`${API_BASE}/sessions/${sessionId}/pause`, {
      reason: 'Testing pause functionality'
    });

    if (pauseResponse.status === 200) {
      console.log('✅ Session paused successfully');
      console.log(`   State: ${pauseResponse.data.session.state}`);
      console.log(`   Pause reason: ${pauseResponse.data.session.pauseReason}`);
    } else {
      throw new Error(`Expected 200, got ${pauseResponse.status}`);
    }

    // Test 5: Resume the session
    console.log('\n5️⃣ Resuming session...');
    const resumeResponse = await axios.post(`${API_BASE}/sessions/${sessionId}/resume`);

    if (resumeResponse.status === 200) {
      console.log('✅ Session resumed successfully');
      console.log(`   State: ${resumeResponse.data.session.state}`);
    } else {
      throw new Error(`Expected 200, got ${resumeResponse.status}`);
    }

    // Test 6: Complete the session
    console.log('\n6️⃣ Completing session...');
    const completeResponse = await axios.post(`${API_BASE}/sessions/${sessionId}/complete`, {
      completionNotes: 'Test completed successfully'
    });

    if (completeResponse.status === 200) {
      console.log('✅ Session completed successfully');
      console.log(`   State: ${completeResponse.data.session.state}`);
      console.log(`   Duration: ${Math.round(completeResponse.data.session.totalDuration / 60)} minutes`);
      console.log(`   Completion notes: ${completeResponse.data.session.completionNotes}`);
    } else {
      throw new Error(`Expected 200, got ${completeResponse.status}`);
    }

    // Test 7: Fetch session stats
    console.log('\n7️⃣ Fetching session statistics...');
    try {
      const statsResponse = await axios.get(`${API_BASE}/sessions/stats?childId=${testChild.id}`);

      if (statsResponse.status === 200) {
        console.log('✅ Session stats fetched successfully');
        console.log(`   Total sessions: ${statsResponse.data.totalSessions}`);
        console.log(`   Completion rate: ${Math.round(statsResponse.data.completionRate * 100)}%`);
      }
    } catch (error) {
      console.log('⚠️ Stats endpoint may not be implemented yet');
    }

    console.log('\n🎉 All session workflow tests passed!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Session creation');
    console.log('   ✅ Session retrieval');
    console.log('   ✅ Session start');
    console.log('   ✅ Session pause');
    console.log('   ✅ Session resume');
    console.log('   ✅ Session completion');
    console.log('   ✅ Full lifecycle workflow');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);

    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Response:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   ⚠️ Could not connect to API server');
      console.error('   Make sure the server is running on http://localhost:8000');
    }

    process.exit(1);
  }
}

// Check if server is reachable first
async function checkServer() {
  try {
    await axios.get(`${API_BASE}/health`);
    console.log('🟢 API server is running\n');
    return true;
  } catch (error) {
    console.log('🔴 API server is not running');
    console.log('   Please start the server with: npm run dev');
    console.log('   Then run this test again\n');
    return false;
  }
}

// Main execution
async function main() {
  console.log('Session Management Integration Test');
  console.log('==================================\n');

  const serverReady = await checkServer();
  if (serverReady) {
    await testSessionWorkflow();
  }
}

main().catch(console.error);