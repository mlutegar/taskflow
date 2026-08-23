import { describe, it, expect, beforeEach } from 'vitest';
import { storageGet, storageSet, storageRemove, storageGetInt, storageSetInt, storageAppend } from './storage';

const PREFIX = 'taskflow.';

describe('storageGet', () => {
  it('returns defaultValue when key is missing', () => {
    expect(storageGet('nonexistent')).toBeNull();
    expect(storageGet('nonexistent', 'fallback')).toBe('fallback');
    expect(storageGet('nonexistent', 42)).toBe(42);
  });

  it('returns parsed JSON value when key exists', () => {
    localStorage.setItem(PREFIX + 'myKey', JSON.stringify({ hello: 'world' }));
    expect(storageGet('myKey')).toEqual({ hello: 'world' });
  });

  it('returns defaultValue on corrupted JSON', () => {
    localStorage.setItem(PREFIX + 'broken', '{ invalid json :::');
    expect(storageGet('broken', 'default')).toBe('default');
  });

  it('handles array values correctly', () => {
    localStorage.setItem(PREFIX + 'arr', JSON.stringify([1, 2, 3]));
    expect(storageGet('arr')).toEqual([1, 2, 3]);
  });
});

describe('storageSet', () => {
  it('stores a value and returns true on success', () => {
    const result = storageSet('foo', { x: 1 });
    expect(result).toBe(true);
    expect(localStorage.setItem).toHaveBeenCalledWith(PREFIX + 'foo', JSON.stringify({ x: 1 }));
  });

  it('storageSet and storageGet round-trip for various types', () => {
    const cases = [
      ['str', 'hello'],
      ['num', 99],
      ['bool', false],
      ['obj', { a: 1, b: [2, 3] }],
      ['arr', [10, 20, 30]],
      ['null', null],
    ];
    for (const [key, value] of cases) {
      // Ensure getItem returns what setItem stored
      localStorage.setItem.mockImplementation((k, v) => {
        localStorage.getItem.mockImplementation((kk) => (kk === k ? v : null));
      });
      storageSet(key, value);
      expect(storageGet(key)).toEqual(value);
    }
  });

  it('returns false when localStorage throws (e.g. quota exceeded)', () => {
    localStorage.setItem.mockImplementationOnce(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });
    const result = storageSet('bigKey', 'bigValue');
    expect(result).toBe(false);
  });
});

describe('storageRemove', () => {
  it('removes the key from localStorage', () => {
    localStorage.setItem(PREFIX + 'toDelete', '"value"');
    storageRemove('toDelete');
    expect(localStorage.removeItem).toHaveBeenCalledWith(PREFIX + 'toDelete');
  });

  it('does not throw when key does not exist', () => {
    expect(() => storageRemove('missing')).not.toThrow();
  });
});

describe('storageGetInt', () => {
  it('returns defaultValue (0) when key is missing', () => {
    expect(storageGetInt('missing')).toBe(0);
    expect(storageGetInt('missing', 5)).toBe(5);
  });

  it('parses integer values correctly', () => {
    localStorage.setItem(PREFIX + 'count', '42');
    expect(storageGetInt('count')).toBe(42);
  });

  it('returns defaultValue for non-integer raw strings', () => {
    localStorage.setItem(PREFIX + 'bad', 'notanumber');
    expect(storageGetInt('bad', -1)).toBe(-1);
  });
});

describe('storageSetInt', () => {
  it('stores integer as string', () => {
    storageSetInt('n', 7);
    expect(localStorage.setItem).toHaveBeenCalledWith(PREFIX + 'n', '7');
  });
});

describe('storageAppend', () => {
  it('creates array from scratch and appends item', () => {
    localStorage.getItem.mockReturnValue(null);
    storageAppend('list', 'a');
    expect(localStorage.setItem).toHaveBeenCalledWith(PREFIX + 'list', JSON.stringify(['a']));
  });

  it('respects maxLen by trimming old entries', () => {
    localStorage.getItem.mockReturnValue(JSON.stringify([1, 2, 3]));
    storageAppend('list', 4, 3);
    expect(localStorage.setItem).toHaveBeenCalledWith(PREFIX + 'list', JSON.stringify([2, 3, 4]));
  });
});
