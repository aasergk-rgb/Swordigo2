import { describe, expect, it } from 'vitest';
import { viewFor } from '../src/config';

// The view always matches the window's shape (up to the limits), so there are no black bars.
describe('viewFor', () => {
  it('keeps 270 high and follows the width for common shapes', () => {
    expect(viewFor(1920, 1080)).toEqual({ w: 480, h: 270 });
    expect(viewFor(1024, 768)).toEqual({ w: 360, h: 270 });
    expect(viewFor(800, 800)).toEqual({ w: 270, h: 270 });
    expect(viewFor(2400, 1080)).toEqual({ w: 600, h: 270 });
  });

  it('shows less height on very wide windows instead of going past the widest rooms', () => {
    const v = viewFor(2000, 830);
    expect(v.w).toBe(640);
    expect(v.h).toBe(266);
    expect(viewFor(3000, 1000)).toEqual({ w: 640, h: 214 });
  });

  it('sizes a portrait window as if turned sideways', () => {
    expect(viewFor(1080, 1920)).toEqual(viewFor(1920, 1080));
  });

  it('never goes below the limits', () => {
    expect(viewFor(5000, 1000).h).toBe(200);
    expect(viewFor(0, 0)).toEqual({ w: 480, h: 270 });
  });
});
