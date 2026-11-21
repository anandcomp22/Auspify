const http = require('http');
const { Readable, Writable, Duplex } = require('stream');
const app = require('../server');
const assert = require('assert');

console.log('Testing Express routes via In-Process Native Dispatcher...\n');

function dispatch(options = {}) {
  return new Promise((resolve, reject) => {
    const method = options.method || 'GET';
    const url = options.url || '/';
    const headers = options.headers || {};

    const req = new Readable({
      read() {
        if (options.body) {
          this.push(options.body);
        }
        this.push(null);
      }
    });

    req.method = method;
    req.url = url;
    const mockSocket = new Duplex({
      read() {},
      write(chunk, enc, cb) { cb(); }
    });
    mockSocket.remoteAddress = '127.0.0.1';
    mockSocket.encrypted = true;
    req.socket = mockSocket;
    req.connection = mockSocket;
    req.headers = Object.assign({
      host: 'lms.auspify.edu',
      'user-agent': 'Node/TestClient'
    }, headers);

    const resHeaders = {};
    let statusCode = 200;
    const bodyChunks = [];

    const res = new Writable({
      write(chunk, encoding, callback) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        callback();
      }
    });

    res.statusCode = 200;
    res.socket = req.socket;
    res.connection = req.socket;
    res.setHeader = (name, val) => {
      resHeaders[name.toLowerCase()] = val;
    };
    res.getHeader = (name) => resHeaders[name.toLowerCase()];
    res.removeHeader = (name) => { delete resHeaders[name.toLowerCase()]; };

    // Express-specific response methods
    res.status = function(code) {
      this.statusCode = code;
      return this;
    };

    res.writeHead = function(code, headersObj) {
      this.statusCode = code;
      if (headersObj) {
        for (const [k, v] of Object.entries(headersObj)) {
          this.setHeader(k, v);
        }
      }
      return this;
    };

    const originalEnd = res.end;
    res.end = function(chunk, encoding, callback) {
      if (chunk) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
      }
      originalEnd.call(this, callback);
      const fullBody = Buffer.concat(bodyChunks).toString('utf8');
      resolve({
        statusCode: this.statusCode,
        headers: resHeaders,
        body: fullBody
      });
    };

    app.handle(req, res, (err) => {
      if (err) reject(err);
    });
  });
}

async function runTests() {
  try {
    // 1. Landing Page
    const resHome = await dispatch({ url: '/' });
    assert.strictEqual(resHome.statusCode, 200);
    assert(resHome.body.includes('Auspify Engineering LMS') || resHome.body.includes('Distributed Systems'));
    console.log('✓ GET / returned 200 OK');

    // 2. Privacy Policy
    const resPrivacy = await dispatch({ url: '/privacy' });
    assert.strictEqual(resPrivacy.statusCode, 200);
    assert(resPrivacy.body.includes('Privacy Policy'));
    console.log('✓ GET /privacy returned 200 OK');

    // 4. Terms & Conditions
    const resTerms = await dispatch({ url: '/terms' });
    assert.strictEqual(resTerms.statusCode, 200);
    assert(resTerms.body.includes('Terms and Conditions'));
    console.log('✓ GET /terms returned 200 OK');

    // 5. Custom Domain Portal
    const resDomain = await dispatch({ url: '/settings/domain' });
    assert.strictEqual(resDomain.statusCode, 200);
    assert(resDomain.body.includes('lms.auspify.edu'));
    console.log('✓ GET /settings/domain returned 200 OK');

    // 6. Course Catalog
    const resCourses = await dispatch({ url: '/courses' });
    assert.strictEqual(resCourses.statusCode, 200);
    assert(resCourses.body.includes('CS-401'));
    console.log('✓ GET /courses returned 200 OK');

    // 7. Course Detail
    const resCourseDetail = await dispatch({ url: '/courses/distributed-systems-architecture' });
    assert.strictEqual(resCourseDetail.statusCode, 200);
    assert(resCourseDetail.body.includes('CS-401: Distributed Systems Architecture'));
    console.log('✓ GET /courses/distributed-systems-architecture returned 200 OK');

    // 8. Public Certificate Verification
    const resCert = await dispatch({ url: '/verify/AUSPIFY-LMS-2026-88F4A19E' });
    assert.strictEqual(resCert.statusCode, 200);
    assert(resCert.body.includes('Julian Reed'));
    assert(resCert.body.includes('AUSPIFY-LMS-2026-88F4A19E'));
    console.log('✓ GET /verify/AUSPIFY-LMS-2026-88F4A19E returned 200 OK (Verified credential)');

    // 9. Public Certificate 404 on invalid
    const resCertInvalid = await dispatch({ url: '/verify/INVALID-SERIAL-999' });
    assert.strictEqual(resCertInvalid.statusCode, 404);
    assert(resCertInvalid.body.includes('VERIFICATION FAILURE'));
    console.log('✓ GET /verify/INVALID-SERIAL-999 returned 404 (Verification failure)');

    // 10. Student Login Simulation
    const loginBody = 'email=student%40auspify.edu&password=StudentPass123%21';
    const resLogin = await dispatch({
      method: 'POST',
      url: '/auth/login',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'content-length': Buffer.byteLength(loginBody)
      },
      body: loginBody
    });
    assert.strictEqual(resLogin.statusCode, 302, 'Login should redirect');
    const setCookie = resLogin.headers['set-cookie'];
    assert(setCookie, 'Session cookie must be set on login');
    const cookieHeader = Array.isArray(setCookie) ? setCookie[0].split(';')[0] : setCookie.split(';')[0];
    console.log('✓ POST /auth/login authenticated successfully.');

    // 11. Authenticated Student Dashboard
    const resDashboard = await dispatch({
      url: '/dashboard/student',
      headers: { 'cookie': cookieHeader }
    });
    assert.strictEqual(resDashboard.statusCode, 200);
    assert(resDashboard.body.includes('Julian Reed'));
    console.log('✓ GET /dashboard/student returned 200 OK with authenticated session.');

    // 12. Authenticated Course Player
    const resPlayer = await dispatch({
      url: '/courses/distributed-systems-architecture/learn/physical-clocks-and-asynchrony',
      headers: { 'cookie': cookieHeader }
    });
    assert.strictEqual(resPlayer.statusCode, 200);
    assert(resPlayer.body.includes('Physical Clocks, NTP Drift, and Network Asynchrony'));
    console.log('✓ GET /courses/distributed-systems-architecture/learn/... returned 200 OK in course player.');

    // 13. Authenticated Quiz View
    const resQuiz = await dispatch({
      url: '/assessments/quiz/1',
      headers: { 'cookie': cookieHeader }
    });
    assert.strictEqual(resQuiz.statusCode, 200);
    assert(resQuiz.body.includes('CS-401 Foundations Examination'));
    console.log('✓ GET /assessments/quiz/1 returned 200 OK.');

    // 14. Authenticated Assignment View
    const resAssignment = await dispatch({
      url: '/assessments/assignment/1',
      headers: { 'cookie': cookieHeader }
    });
    assert.strictEqual(resAssignment.statusCode, 200);
    assert(resAssignment.body.includes('Raft Consensus State Machine Engine'));
    console.log('✓ GET /assessments/assignment/1 returned 200 OK.');

    console.log('\n====================================================');
    console.log('ALL 14 IN-PROCESS ROUTE INTEGRATION TESTS PASSED!');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  }
}

runTests();
