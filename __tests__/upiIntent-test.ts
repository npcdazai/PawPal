import { UTR_LENGTH, cleanUtr, isValidUtr, upiPayUrl } from '../src/payments/upiIntent';

const payee = { vpa: 'pawpal@okhdfcbank', name: 'PawPal Pets' };

describe('upiPayUrl', () => {
  test('builds a person-to-person UPI link with a 2-decimal INR amount', () => {
    expect(upiPayUrl(payee, 299, 'PawPal ORDER-1')).toBe(
      'upi://pay?pa=pawpal@okhdfcbank&pn=PawPal%20Pets&am=299.00&cu=INR&tn=PawPal%20ORDER-1'
    );
    expect(upiPayUrl(payee, 12.5, 'x')).toContain('&am=12.50&');
  });

  test('keeps "@" literal but encodes everything else', () => {
    const url = upiPayUrl({ vpa: 'a+b@ybl', name: 'Tom & Jerry=1' }, 1, 'a/b?c');
    expect(url).toContain('pa=a%2Bb@ybl&');
    expect(url).toContain('pn=Tom%20%26%20Jerry%3D1&');
    expect(url).toContain('tn=a%2Fb%3Fc');
  });

  test('caps the note at 50 characters', () => {
    const note = 'n'.repeat(80);
    expect(upiPayUrl(payee, 1, note).endsWith(`tn=${'n'.repeat(50)}`)).toBe(true);
  });

  test('never sends merchant-only fields', () => {
    const url = upiPayUrl(payee, 1, 'note');
    expect(url).not.toMatch(/[?&](tr|mc)=/);
  });
});

describe('UTR helpers', () => {
  test('cleanUtr keeps digits only, up to 12', () => {
    expect(UTR_LENGTH).toBe(12);
    expect(cleanUtr('1234 5678-9012')).toBe('123456789012');
    expect(cleanUtr('UTR: 4321 9876 5432 10')).toBe('432198765432');
    expect(cleanUtr('abc')).toBe('');
  });

  test('isValidUtr accepts exactly 12 digits', () => {
    expect(isValidUtr('123456789012')).toBe(true);
    expect(isValidUtr('12345678901')).toBe(false);
    expect(isValidUtr('1234567890123')).toBe(false);
    expect(isValidUtr('12345678901a')).toBe(false);
    expect(isValidUtr(' 123456789012')).toBe(false);
  });
});
