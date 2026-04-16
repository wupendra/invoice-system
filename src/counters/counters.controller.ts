import { Controller, Get, Post, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { CountersService } from './counters.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('settings/counter')
@Roles('admin')
export class CountersController {
  constructor(private readonly counters: CountersService) {}

  @Get() @Render('pages/settings/counter')
  async show(@CurrentUser() user: AuthUser) {
    const year = new Date().getFullYear();
    const last = await this.counters.getCurrent(year);
    return {
      title: `Invoice counter ${year}`,
      layout: 'layouts/main',
      user,
      isAdmin: true,
      year,
      lastNumber: last,
      nextNumber: String(last + 1).padStart(3, '0'),
    };
  }

  @Post('reset')
  async reset(@Res() res: Response) {
    await this.counters.reset(new Date().getFullYear());
    return res.redirect('/settings/counter');
  }
}
