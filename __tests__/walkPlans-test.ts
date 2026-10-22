import {
  EXPRESS_PEAK_PRICE,
  EXPRESS_PRICE,
  SUBSCRIPTION_MONTHLY,
  TRIAL_PRICE,
  batchSlots,
  clockLabel,
  formatMoney,
  slotRange,
  tierFare,
} from '../src/booking/walkPlans';

/** A local time on an arbitrary day. */
const at = (hours: number, minutes = 0) => new Date(2026, 0, 15, hours, minutes);

describe('tierFare', () => {
  test('subscription is 26 walks at ₹120, itemised as one line', () => {
    expect(tierFare('subscription')).toEqual({
      total: 3120,
      lines: [{ label: '26 society walks × ₹120', amount: 3120 }],
    });
    expect(SUBSCRIPTION_MONTHLY).toBe(3120);
  });

  test('trial is a flat ₹99', () => {
    expect(tierFare('trial')).toEqual({
      total: TRIAL_PRICE,
      lines: [{ label: '15-min Meet & Greet co-walk', amount: 99 }],
    });
  });

  test('express is ₹299 outside peak hours', () => {
    for (const time of [at(6, 59), at(9), at(12), at(16, 59), at(19), at(23, 30)]) {
      const fare = tierFare('express', time);
      expect(fare.total).toBe(EXPRESS_PRICE);
      expect(fare.lines).toEqual([{ label: 'SOS Express walk (30 min)', amount: 299 }]);
    }
  });

  test('express adds the peak squeeze-in 7–9 AM and 5–7 PM', () => {
    for (const time of [at(7), at(8, 59), at(17), at(18, 59)]) {
      const fare = tierFare('express', time);
      expect(fare.total).toBe(EXPRESS_PEAK_PRICE);
      expect(fare.lines).toEqual([
        { label: 'SOS Express walk (30 min)', amount: 299 },
        { label: 'Peak-hour batch squeeze-in', amount: 50 },
      ]);
    }
  });

  test('line items always add up to the total', () => {
    for (const fare of [tierFare('subscription'), tierFare('trial'), tierFare('express', at(8))]) {
      expect(fare.lines.reduce((sum, line) => sum + line.amount, 0)).toBe(fare.total);
    }
  });
});

describe('batchSlots', () => {
  test('morning batch: 30-minute starts from 6:00 that end by 9:30', () => {
    expect(batchSlots('morning')).toEqual([360, 390, 420, 450, 480, 510, 540]);
  });

  test('evening batch: 30-minute starts from 5:00 PM that end by 8:30 PM', () => {
    expect(batchSlots('evening')).toEqual([1020, 1050, 1080, 1110, 1140, 1170, 1200]);
  });
});

describe('clockLabel', () => {
  test.each([
    [0, '12:00 AM'],
    [420, '7:00 AM'],
    [690, '11:30 AM'],
    [720, '12:00 PM'],
    [1230, '8:30 PM'],
    [1439, '11:59 PM'],
  ])('%i → %s', (minute, label) => {
    expect(clockLabel(minute)).toBe(label);
  });

  test('wraps around midnight and rounds to the minute', () => {
    expect(clockLabel(1440)).toBe('12:00 AM');
    expect(clockLabel(-30)).toBe('11:30 PM');
    expect(clockLabel(420.4)).toBe('7:00 AM');
  });
});

describe('slotRange', () => {
  test('shares AM/PM when both ends fall in the same half of the day', () => {
    expect(slotRange(420)).toBe('7:00 – 7:30 AM');
    expect(slotRange(1020)).toBe('5:00 – 5:30 PM');
  });

  test('spells out both halves across noon', () => {
    expect(slotRange(690)).toBe('11:30 AM – 12:00 PM');
  });

  test('takes a custom length', () => {
    expect(slotRange(420, 15)).toBe('7:00 – 7:15 AM');
  });
});

describe('formatMoney', () => {
  test.each([
    [0, '₹0'],
    [99, '₹99'],
    [350, '₹350'],
    [1250, '₹1,250'],
    [12.5, '₹12.50'],
    [100000, '₹1,00,000'],
    [12345678, '₹1,23,45,678'],
    [999.999, '₹1,000'],
    [-1250, '-₹1,250'],
  ])('%p → %s', (amount, text) => {
    expect(formatMoney(amount)).toBe(text);
  });
});
