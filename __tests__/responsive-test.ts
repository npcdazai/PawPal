import { breakpoints, designSize, matchesMedia, scaleDown } from '../src/theme/responsive';

/** The supported phones at their stock densities, in dp. */
const QHD = { width: 1440 / 3.5, height: 3120 / 3.5 };
const FHD = { width: 1080 / 2.625, height: 2340 / 2.625 };
const HD = { width: 720 / 2, height: 1560 / 2 };

const compact = { maxWidth: breakpoints.compactWidth - 0.001 };
const short = { maxHeight: breakpoints.shortHeight - 0.001 };

describe('matchesMedia', () => {
  test('QHD+ and FHD+ phones share the regular layout', () => {
    for (const phone of [QHD, FHD]) {
      expect(matchesMedia(compact, phone)).toBe(false);
      expect(matchesMedia(short, phone)).toBe(false);
    }
  });

  test('HD+ phones are compact and short', () => {
    expect(matchesMedia(compact, HD)).toBe(true);
    expect(matchesMedia(short, HD)).toBe(true);
  });

  test('every bound must hold, inclusively', () => {
    const query = { minWidth: 360, maxWidth: 411, minHeight: 780 };
    expect(matchesMedia(query, { width: 360, height: 780 })).toBe(true);
    expect(matchesMedia(query, { width: 411, height: 2000 })).toBe(true);
    expect(matchesMedia(query, { width: 412, height: 891 })).toBe(false);
    expect(matchesMedia(query, { width: 400, height: 779 })).toBe(false);
    expect(matchesMedia({}, { width: 1, height: 1 })).toBe(true);
  });
});

describe('scaleDown', () => {
  test('keeps the designed size on the design phone and anything bigger', () => {
    expect(scaleDown(220, designSize.height, designSize.height)).toBe(220);
    expect(scaleDown(220, 1200, designSize.height)).toBe(220);
  });

  test('shrinks in proportion on an HD+ phone', () => {
    expect(scaleDown(220, HD.height, designSize.height)).toBe(193);
    expect(scaleDown(140, HD.width, designSize.width)).toBe(123);
  });

  test('never goes below the floor', () => {
    expect(scaleDown(200, 300, designSize.height)).toBe(170);
    expect(scaleDown(200, 300, designSize.height, 0.5)).toBe(100);
  });
});
