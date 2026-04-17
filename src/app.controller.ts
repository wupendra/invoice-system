import { Controller, Get, Render } from '@nestjs/common';
import { CurrentUser, AuthUser } from './common/decorators/current-user.decorator';
import { InvoicesService } from './invoices/invoices.service';

@Controller()
export class AppController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get() @Render('pages/dashboard')
  async dashboard(@CurrentUser() user: AuthUser) {
    const recent = (await this.invoices.list({})).slice(0, 10);
    return {
      title: 'Dashboard', layout: 'layouts/main',
      user, isAdmin: user.role === 'admin', recent,
    };
  }
}
