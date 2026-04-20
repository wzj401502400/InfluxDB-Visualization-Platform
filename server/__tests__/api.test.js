/**
 * API Integration Tests
 *
 * Tests Express REST endpoints using supertest.
 * Global `fetch` is mocked to avoid real InfluxDB / Grafana calls.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';

// --------------- Mock global fetch BEFORE importing app ---------------
const originalFetch = global.fetch;
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Dynamic import so the mock is in place when modules initialize
const { default: app } = await import('../server.js');

// --------------- Helpers ---------------

/** Build a mock Response object that matches Node.js fetch API shape */
const mockResponse = (body, { status = 200, headers = {} } = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 200 ? 'OK' : `HTTP ${status}`,
  headers: { get: (key) => headers[key.toLowerCase()] || null },
  json: () => Promise.resolve(body),
  text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  body: null,
});

const MOCK_USER = { id: 'u1', name: 'dev' };
const MOCK_BUCKETS = {
  buckets: [
    { id: 'b1', name: 'devbucket', orgID: 'org1' },
    { id: 'b2', name: 'testbucket', orgID: 'org1' },
  ],
};

/** Configure mockFetch to respond to InfluxDB login endpoints */
function mockInfluxLogin() {
  mockFetch.mockImplementation((url) => {
    const u = typeof url === 'string' ? url : url.toString();
    if (u.includes('/api/v2/me'))      return Promise.resolve(mockResponse(MOCK_USER));
    if (u.includes('/api/v2/buckets')) return Promise.resolve(mockResponse(MOCK_BUCKETS));
    return Promise.resolve(mockResponse({ message: 'not found' }, { status: 404 }));
  });
}

/** Create a supertest agent that already holds a valid session cookie */
async function loginAgent() {
  mockInfluxLogin();
  const agent = request.agent(app);
  await agent.post('/auth/login').send({ url: 'http://localhost:8086', token: 'test-token' });
  mockFetch.mockReset();
  return agent;
}

// --------------- Tests ---------------

describe('Health Check', () => {
  it('GET /healthz returns 200', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.text).toBe('ok');
  });
});

describe('Auth – POST /auth/login', () => {
  beforeEach(() => mockFetch.mockReset());

  it('returns 400 when URL and token are missing', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/required/i);
  });

  it('returns 400 for an invalid URL format', async () => {
    const res = await request(app).post('/auth/login').send({ url: 'not-a-url', token: 'tok' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/invalid url/i);
  });

  it('returns 200 and sets session cookie on valid credentials', async () => {
    mockInfluxLogin();
    const res = await request(app)
      .post('/auth/login')
      .send({ url: 'http://localhost:8086', token: 'test-token' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.user).toHaveProperty('name', 'dev');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c) => c.startsWith('sid='))).toBe(true);
  });
});

describe('Auth – POST /auth/logout', () => {
  it('returns 200 with ok:true', async () => {
    const res = await request(app).post('/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

describe('Protected endpoints – without session', () => {
  it('GET /api/buckets returns 401', async () => {
    const res = await request(app).get('/api/buckets');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toBe('unauthorized');
  });

  it('GET /api/measurements returns 401', async () => {
    const res = await request(app).get('/api/measurements?bucketId=b1');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });
});

describe('Protected endpoints – with session', () => {
  let agent;

  beforeAll(async () => {
    agent = await loginAgent();
  });

  beforeEach(() => mockFetch.mockReset());

  it('GET /api/buckets returns bucket list', async () => {
    mockFetch.mockResolvedValue(mockResponse(MOCK_BUCKETS));
    const res = await agent.get('/api/buckets');
    expect(res.status).toBe(200);
    expect(res.body.buckets).toHaveLength(2);
  });

  it('POST /api/query/spec returns 400 when time.start is missing', async () => {
    const res = await agent.post('/api/query/spec').send({ spec: {} });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/time\.start/);
  });
});

describe('Dashboard creation – POST /api/create-filtered-dashboard', () => {
  it('returns 400 when measurement is missing (single-measurement mode)', async () => {
    const res = await request(app)
      .post('/api/create-filtered-dashboard')
      .send({ field: 'mem' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 400 when fields are missing (cross-measurement mode)', async () => {
    const res = await request(app)
      .post('/api/create-filtered-dashboard')
      .send({ isCrossMeasurement: true });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});

// --------------- Cleanup ---------------
afterAll(() => {
  global.fetch = originalFetch;
});
