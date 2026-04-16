import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { bootstrapTestApp, ensureUser, loginAndGetCookie } from './test-helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootstrapTestApp();
    await ensureUser(app, 'admin-e2e@aquester.com', 'pw-admin-1', 'admin');
    await ensureUser(app, 'viewer-e2e@aquester.com', 'pw-viewer-1', 'viewer');
  });

  afterAll(async () => { await app.close(); });

  it('redirects unauthenticated requests to /login', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(302);
    expect(res.headers.location).toBe('/login');
  });

  it('rejects bad credentials with the login page + error', async () => {
    const res = await request(app.getHttpServer())
      .post('/login')
      .send({ email: 'admin-e2e@aquester.com', password: 'wrong' })
      .expect(200);
    expect(res.text).toContain('Invalid email or password');
  });

  it('logs in admin and renders dashboard', async () => {
    const cookie = await loginAndGetCookie(app, 'admin-e2e@aquester.com', 'pw-admin-1');
    const res = await request(app.getHttpServer())
      .get('/')
      .set('Cookie', cookie)
      .expect(200);
    expect(res.text).toContain('Dashboard');
    expect(res.text).toContain('admin-e2e@aquester.com');
  });

  it('logout clears the cookie', async () => {
    const cookie = await loginAndGetCookie(app, 'admin-e2e@aquester.com', 'pw-admin-1');
    const res = await request(app.getHttpServer())
      .post('/logout')
      .set('Cookie', cookie)
      .expect(302);
    expect(res.headers.location).toBe('/login');
    const cleared = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cleared.find((c) => c.startsWith('aq_token='))).toMatch(/aq_token=;/);
  });
});
