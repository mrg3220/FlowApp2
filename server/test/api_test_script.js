
const API_URL = 'http://localhost:3001/api';

async function test() {
  console.log('🚀 Starting API Test Script...\n');

  // 1. Login as Owner
  console.log('🔑 Logging in as owner@flowapp.com...');
  let loginRes;
  try {
    loginRes = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@flowapp.com', password: 'owner123' })
    });
  } catch (err) {
    console.error('❌ Connection failed. Is the server running on port 5000?');
    process.exit(1);
  }

  if (!loginRes.ok) {
    console.error('❌ Login failed:', await loginRes.text());
    process.exit(1);
  }

  const { token, user } = await loginRes.json();
  console.log(`✅ Login successful! Welcome ${user.firstName} (${user.role}).Token acquired.\n`);

  const headers = { 'Authorization': `Bearer ${token}` };

  // 2. Test Schools Endpoint
  console.log('🏫 Testing GET /api/schools...');
  const schoolsRes = await fetch(`${API_URL}/schools`, { headers });
  const schoolsWrapper = await schoolsRes.json();
  
  if (schoolsRes.status === 200) {
    if (schoolsWrapper.data && Array.isArray(schoolsWrapper.data)) {
      const schools = schoolsWrapper.data;
      console.log(`✅ [PASS] Returns Object with Data Array. Count: ${schools.length}`);
      if (schools.length > 0) {
        console.log(`   Sample: ${schools[0].name} (ID: ${schools[0].id})`);
      }
    } else if (Array.isArray(schoolsWrapper)) {
       console.log(`⚠️ [WARN] Returns raw Array (Legacy format). Count: ${schoolsWrapper.length}`);
    } else {
      console.error('❌ [FAIL] Expected { data: [] }, got:', typeof schoolsWrapper);
      console.log('   Response:', JSON.stringify(schoolsWrapper, null, 2));
    }
  } else {
    console.error(`❌ [FAIL] Status ${schoolsRes.status}`);
  }
  console.log('');

  // 3. Test Other Endpoints (Smoke Test)
  const endpoints = [
    { name: 'Classes', path: '/classes' },
    { name: 'Sessions', path: '/sessions' },
    { name: 'Students', path: '/users?role=STUDENT' }, // Assuming filtering by role works or just users
    { name: 'Enrollments', path: '/enrollments' }, // Might fail if query params required?
    { name: 'Events', path: '/events' }
  ];

  for (const ep of endpoints) {
    console.log(`👉 Testing GET ${ep.path}...`);
    const res = await fetch(`${API_URL}${ep.path}`, { headers });
    if (res.ok) {
        const data = await res.json();
        const isArray = Array.isArray(data);
        // Some endpoints like /enrollments might return wrapped data? Let's see.
        console.log(`✅ [PASS] Status ${res.status} | Type: ${isArray ? 'Array' : typeof data} | ${isArray ? 'Count: ' + data.length : 'Object Keys: ' + Object.keys(data).join(', ')}`);
    } else {
        console.log(`❌ [FAIL] Status ${res.status} - ${res.statusText}`);
        try { console.log('   Error:', await res.text()); } catch(e){}
    }
  }
}

test();
