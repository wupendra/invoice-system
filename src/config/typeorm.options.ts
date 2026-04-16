import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function buildTypeOrmOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    type: 'mysql',
    host: config.get<string>('DB_HOST'),
    port: Number(config.get<string>('DB_PORT')),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASS') || '',
    database: config.get<string>('DB_NAME'),
    entities: [__dirname + '/../entities/*.entity.{ts,js}'],
    migrations: [__dirname + '/../../migrations/*.{ts,js}'],
    synchronize: false,
    charset: 'utf8mb4',
    logging: ['error', 'warn'],
  };
}
