import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import puppeteer, { Browser } from 'puppeteer';

@Injectable()
export class PdfService implements OnModuleDestroy {
  private browser?: Browser;
  constructor(private readonly config: ConfigService) {}

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });
    }
    return this.browser;
  }

  async renderHtmlToBuffer(html: string): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const buf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      });
      return Buffer.from(buf);
    } finally {
      await page.close();
    }
  }

  async writeBufferToDisk(buf: Buffer, fileName: string): Promise<string> {
    const dir = resolve(this.config.get<string>('PDF_STORAGE_DIR') || './storage/invoices');
    const path = join(dir, fileName);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, buf);
    return path;
  }

  async onModuleDestroy() { await this.shutdown(); }

  async shutdown() {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }
}
