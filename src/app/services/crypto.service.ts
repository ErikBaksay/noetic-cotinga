import { Injectable } from '@angular/core';
import { EncryptedPayload } from '../models/domain.models';

const DEFAULT_ITERATIONS = 210_000;

@Injectable({ providedIn: 'root' })
export class CryptoService {
  async encrypt<T>(data: T, passphrase: string): Promise<EncryptedPayload> {
    this.assertPassphrase(passphrase);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = DEFAULT_ITERATIONS;
    const key = await this.deriveKey(passphrase, salt, iterations);
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    const ivBuffer = this.toArrayBuffer(iv);

    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      key,
      encoded,
    );

    return {
      cipherText: this.toBase64(new Uint8Array(encryptedBuffer)),
      iv: this.toBase64(iv),
      salt: this.toBase64(salt),
      iterations,
      algorithm: 'AES-GCM',
    };
  }

  async decrypt<T>(payload: EncryptedPayload, passphrase: string): Promise<T> {
    this.assertPassphrase(passphrase);

    const iv = this.fromBase64(payload.iv);
    const salt = this.fromBase64(payload.salt);
    const cipherText = this.fromBase64(payload.cipherText);
    const key = await this.deriveKey(passphrase, salt, payload.iterations);
    const ivBuffer = this.toArrayBuffer(iv);
    const cipherTextBuffer = this.toArrayBuffer(cipherText);

    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer,
      },
      key,
      cipherTextBuffer,
    );

    const decoded = new TextDecoder().decode(new Uint8Array(decryptedBuffer));
    return JSON.parse(decoded) as T;
  }

  private async deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
    const passphraseBytes = new TextEncoder().encode(passphrase);
    const keyMaterial = await crypto.subtle.importKey('raw', passphraseBytes, 'PBKDF2', false, ['deriveKey']);

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: this.toArrayBuffer(salt),
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256,
      },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private assertPassphrase(passphrase: string): void {
    if (!passphrase.trim()) {
      throw new Error('Passphrase is required.');
    }
  }

  private toBase64(bytes: Uint8Array): string {
    let binary = '';
    bytes.forEach((value) => {
      binary += String.fromCharCode(value);
    });

    return btoa(binary);
  }

  private fromBase64(value: string): Uint8Array {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  private toArrayBuffer(value: Uint8Array): ArrayBuffer {
    return value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
  }
}
