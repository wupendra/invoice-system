import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { hashPassword } from '../../src/auth/bcrypt.helper';
import { DataSource } from 'typeorm';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

export async function bootstrapTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  app.useStaticAssets(join(__dirname, '..', '..', 'public'), { prefix: '/public/' });
  app.setBaseViewsDir(join(__dirname, '..', '..', 'views'));
  app.setViewEngine('hbs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const hbs = require('hbs');
  hbs.registerPartials(join(__dirname, '..', '..', 'views', 'partials'));
  hbs.registerHelper('numFmt', (v: string | number) =>
    Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  hbs.registerHelper('nl2br', (s: string) => (s ?? '').toString().replace(/\n/g, '<br>'));
  hbs.registerHelper('json', (v: unknown) => JSON.stringify(v ?? null));
  hbs.registerHelper('eq', (a: unknown, b: unknown) => String(a) === String(b));
  hbs.registerHelper('padNum', (n: number) => String(n).padStart(3, '0'));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

export async function ensureUser(app: INestApplication, email: string, password: string, role: 'admin' | 'viewer') {
  const ds = app.get(DataSource);
  await ds.query(`DELETE FROM users WHERE email = ?`, [email]);
  const hash = await hashPassword(password);
  await ds.query(`INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)`, [email, hash, role]);
}

export async function loginAndGetCookie(app: INestApplication, email: string, password: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/login')
    .send({ email, password })
    .expect(302);
  const setCookie = res.headers['set-cookie'];
  if (!setCookie) throw new Error('No Set-Cookie returned from /login');
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  const aq = arr.find((c: string) => c.startsWith('aq_token='));
  if (!aq) throw new Error('aq_token cookie missing');
  return aq.split(';')[0];
}
