import { hashPassword, verifyPassword } from './bcrypt.helper';

describe('bcrypt helper', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('s3cret');
    expect(hash).not.toEqual('s3cret');
    expect(await verifyPassword('s3cret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });
});
