import { Body, Controller, Get, Post, Render, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';

@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Get('login') @Render('pages/login')
  showLogin() {
    return { title: 'Login', layout: 'layouts/main' };
  }

  @Public() @Post('login')
  async doLogin(@Body() dto: LoginDto, @Res() res: Response) {
    try {
      const { token } = await this.auth.login(dto.email, dto.password);
      res.cookie('aq_token', token, {
        httpOnly: true,
        secure: process.env.COOKIE_SECURE === 'true',
        sameSite: 'lax',
      });
      return res.redirect('/');
    } catch {
      return res.render('pages/login', {
        title: 'Login', layout: 'layouts/main',
        error: 'Invalid email or password',
        email: dto.email,
      });
    }
  }

  @Public() @Post('logout')
  logout(@Res() res: Response, @Req() _req: Request) {
    res.clearCookie('aq_token');
    return res.redirect('/login');
  }
}
