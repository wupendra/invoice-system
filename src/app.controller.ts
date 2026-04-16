import { Controller, Get, Render } from '@nestjs/common';
import { CurrentUser, AuthUser } from './common/decorators/current-user.decorator';

@Controller()
export class AppController {
  @Get() @Render('pages/dashboard')
  dashboard(@CurrentUser() user: AuthUser) {
    return {
      title: 'Dashboard',
      layout: 'layouts/main',
      user,
      isAdmin: user.role === 'admin',
    };
  }
}
