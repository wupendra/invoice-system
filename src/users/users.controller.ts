import {
  Body, Controller, Get, Param, ParseIntPipe, Post, Render, Res,
} from '@nestjs/common';
import { Response } from 'express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get() @Render('pages/users/list')
  async list(@CurrentUser() user: AuthUser) {
    const users = await this.svc.list();
    return { title: 'Users', layout: 'layouts/main', user, isAdmin: true, users };
  }

  @Get('new') @Render('pages/users/form')
  newForm(@CurrentUser() user: AuthUser) {
    return {
      title: 'New user', layout: 'layouts/main', user, isAdmin: true,
      action: '/users/new', target: { email: '', role: 'viewer' }, isCreate: true,
    };
  }

  @Post('new')
  async create(@Body() dto: CreateUserDto, @Res() res: Response) {
    await this.svc.create(dto.email, dto.password, dto.role);
    return res.redirect('/users');
  }

  @Get(':id/edit') @Render('pages/users/form')
  async editForm(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    const target = await this.svc.findOne(id);
    return {
      title: `Edit ${target.email}`, layout: 'layouts/main', user, isAdmin: true,
      action: `/users/${id}/edit`, target, isCreate: false,
    };
  }

  @Post(':id/edit')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @Res() res: Response,
  ) {
    await this.svc.update(id, dto);
    return res.redirect('/users');
  }
}
