import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { CustomersService } from './customers.service';
import { CustomerDto } from './dto/customer.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('customers')
export class CustomersController {
  constructor(private readonly svc: CustomersService) {}

  @Get() @Render('pages/customers/list')
  async list(@CurrentUser() user: AuthUser, @Query('q') q?: string) {
    const customers = await this.svc.list(q);
    return { title: 'Customers', layout: 'layouts/main', user, isAdmin: user.role === 'admin', customers, q: q ?? '' };
  }

  @Roles('admin') @Get('new') @Render('pages/customers/form')
  newForm(@CurrentUser() user: AuthUser) {
    return {
      title: 'New customer', layout: 'layouts/main', user, isAdmin: true,
      action: '/customers/new', customer: { ccEmails: [] }, ccEmailsText: '',
    };
  }

  @Roles('admin') @Post('new')
  async createSubmit(@Body() dto: CustomerDto, @Res() res: Response) {
    const created = await this.svc.create(dto);
    return res.redirect(`/customers/${created.id}`);
  }

  @Get(':id') @Render('pages/customers/detail')
  async detail(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const customer = await this.svc.findOne(id);
    return { title: customer.companyName, layout: 'layouts/main', user, isAdmin: user.role === 'admin', customer };
  }

  @Roles('admin') @Get(':id/edit') @Render('pages/customers/form')
  async editForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const customer = await this.svc.findOne(id);
    return {
      title: `Edit ${customer.companyName}`, layout: 'layouts/main', user, isAdmin: true,
      action: `/customers/${id}/edit`, customer, ccEmailsText: customer.ccEmails.map((e) => e.email).join('\n'),
    };
  }

  @Roles('admin') @Post(':id/edit')
  async editSubmit(@Param('id', ParseIntPipe) id: number, @Body() dto: CustomerDto, @Res() res: Response) {
    await this.svc.update(id, dto);
    return res.redirect(`/customers/${id}`);
  }
}
