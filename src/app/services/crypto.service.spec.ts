import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CryptoService);
  });

  it('encrypts and decrypts data with passphrase', async () => {
    const payload = {
      message: 'hello',
      nested: { value: 42 },
    };

    const encrypted = await service.encrypt(payload, 'test-passphrase');
    expect(encrypted.algorithm).toBe('AES-GCM');
    expect(encrypted.cipherText).toBeTruthy();

    const decrypted = await service.decrypt<typeof payload>(encrypted, 'test-passphrase');
    expect(decrypted).toEqual(payload);
  });

  it('throws when passphrase is empty', async () => {
    await expect(service.encrypt({ ok: true }, '')).rejects.toThrowError();
  });

  it('fails decryption with wrong passphrase', async () => {
    const encrypted = await service.encrypt({ secret: 'text' }, 'correct');
    await expect(service.decrypt(encrypted, 'wrong')).rejects.toThrowError();
  });
});
