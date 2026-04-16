import { Body, Controller, Get, Post, Render, Res } from '@nestjs/common';
import { Response } from 'express';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

@Controller('settings')
@Roles('admin')
export class SettingsController {
  constructor(private readonly svc: SettingsService) {}

  @Get() @Render('pages/settings/form')
  async showForm(@CurrentUser() user: AuthUser) {
    const settings = await this.svc.get();
    // NOTE: render-model key must NOT be 'settings' — Express's app.settings.views
    // is shadowed by it and view resolution breaks. Always pass as 'appSettings'.
    return { title: 'Settings', layout: 'layouts/main', user, isAdmin: true, appSettings: settings };
  }

  @Post()
  async save(@Body() dto: UpdateSettingsDto, @Res() res: Response) {
    await this.svc.update(dto);
    return res.redirect('/settings');
  }
}
