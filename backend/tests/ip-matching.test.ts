import { describe, it, expect } from 'vitest';

// Копия функции из security.routes.ts (можешь экспортировать её явно)
function ipMatchesCidr(ip: string | null, cidr: string): boolean {
  if (!ip) return false;
  if (!cidr.includes('/')) return ip === cidr;

  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  if (!Number.isFinite(bits)) return false;

  const ipToLong = (s: string) =>
    s.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

describe('ipMatchesCidr', () => {
  it('точное совпадение IP без CIDR', () => {
    expect(ipMatchesCidr('10.0.0.5', '10.0.0.5')).toBe(true);
    expect(ipMatchesCidr('10.0.0.6', '10.0.0.5')).toBe(false);
  });

  it('IPv4 /24', () => {
    expect(ipMatchesCidr('192.168.1.55', '192.168.1.0/24')).toBe(true);
    expect(ipMatchesCidr('192.168.2.1', '192.168.1.0/24')).toBe(false);
  });

  it('/32 = точный', () => {
    expect(ipMatchesCidr('8.8.8.8', '8.8.8.8/32')).toBe(true);
    expect(ipMatchesCidr('8.8.4.4', '8.8.8.8/32')).toBe(false);
  });

  it('null ip — false', () => {
    expect(ipMatchesCidr(null, '10.0.0.0/8')).toBe(false);
  });

  it('битый CIDR — false', () => {
    expect(ipMatchesCidr('10.0.0.1', 'not-a-cidr')).toBe(false);
  });
});