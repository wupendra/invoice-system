import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings } from '../entities/settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class SettingsService {
  constructor(@InjectRepository(Settings) private readonly repo: Repository<Settings>) {}

  async get(): Promise<Settings> {
    const row = await this.repo.findOne({ where: { id: 1 } });
    if (!row) throw new NotFoundException('Settings row missing — re-run migrations');
    return row;
  }

  async update(dto: UpdateSettingsDto): Promise<Settings> {
    const row = await this.get();
    Object.assign(row, dto);
    return this.repo.save(row);
  }
}
