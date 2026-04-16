import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  const root = process.cwd();
  app.useStaticAssets(join(root, 'public'), { prefix: '/public/' });
  app.setBaseViewsDir(join(root, 'views'));
  app.setViewEngine('hbs');

  // hbs partials/layouts
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const hbs = require('hbs');
  hbs.registerPartials(join(root, 'views', 'partials'));
  hbs.registerHelper('numFmt', (v: string | number) =>
    Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  );
  hbs.registerHelper('nl2br', (s: string) => (s ?? '').toString().replace(/\n/g, '<br>'));
  hbs.registerHelper('json', (v: unknown) => new (require('hbs')).SafeString(JSON.stringify(v ?? null)));
  hbs.registerHelper('eq', (a: unknown, b: unknown) => String(a) === String(b));
  hbs.registerHelper('padNum', (n: number) => String(n).padStart(3, '0'));

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = Number(config.get('APP_PORT'));
  await app.listen(port);
}
bootstrap();
