import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { verifyPassword } from './bcrypt.helper';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    const user = await this.users.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (!(await verifyPassword(password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const token = await this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
    return { token, user };
  }
}
