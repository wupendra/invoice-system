import { PdfService } from './pdf.service';

describe('PdfService', () => {
  let svc: PdfService;
  beforeAll(() => {
    process.env.PDF_STORAGE_DIR = process.env.PDF_STORAGE_DIR || './storage/invoices';
    svc = new PdfService({ get: (k: string) => process.env[k] } as any);
  });

  afterAll(async () => { await svc.shutdown(); });

  it('renders a simple HTML to a PDF buffer with %PDF- header', async () => {
    const buf = await svc.renderHtmlToBuffer('<html><body><h1>Hi</h1></body></html>');
    expect(buf.length).toBeGreaterThan(500);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  }, 60_000);
});
