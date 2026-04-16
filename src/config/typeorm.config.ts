import 'dotenv/config';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { buildTypeOrmOptions } from './typeorm.options';

const config = new ConfigService(process.env as Record<string, string>);
export default new DataSource(buildTypeOrmOptions(config) as any);
