import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../entities/user.entity';
import { hashPassword } from '../auth/bcrypt.helper';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>) {}

  list() { return this.repo.find({ order: { email: 'ASC' } }); }

  async findOne(id: number): Promise<User> {
    const u = await this.repo.findOne({ where: { id } });
    if (!u) throw new NotFoundException(`User ${id} not found`);
    return u;
  }

  async create(email: string, password: string, role: UserRole): Promise<User> {
    const passwordHash = await hashPassword(password);
    return this.repo.save(this.repo.create({ email, passwordHash, role }));
  }

  async update(id: number, fields: { email: string; role: UserRole; password?: string }): Promise<User> {
    const u = await this.findOne(id);
    u.email = fields.email; u.role = fields.role;
    if (fields.password) u.passwordHash = await hashPassword(fields.password);
    return this.repo.save(u);
  }
}
