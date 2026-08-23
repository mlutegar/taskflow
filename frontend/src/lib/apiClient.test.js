import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing apiClient
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { api } from './apiClient';
import { supabase } from './supabase';

function mockFetchOk(body, status = 200) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    status,
    json: () => Promise.resolve(body),
  });
}

function mockFetchError(status, errorBody) {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: () => Promise.resolve(errorBody),
  });
}

describe('api.get', () => {
  beforeEach(() => {
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  it('returns parsed JSON on successful GET', async () => {
    const payload = { id: 1, title: 'Task A' };
    mockFetchOk(payload);

    const result = await api.get('/tasks');

    expect(result).toEqual(payload);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tasks'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('sets Authorization header when token exists via supabase session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({
      data: { session: { access_token: 'my-jwt-token' } },
    });
    mockFetchOk({ ok: true });

    await api.get('/tasks');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('does not set Authorization header when no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    mockFetchOk({ ok: true });

    await api.get('/tasks');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('throws on 401 response with server error message', async () => {
    mockFetchError(401, { error: 'Unauthorized' });

    await expect(api.get('/protected')).rejects.toThrow('Unauthorized');
  });

  it('throws generic error message on non-ok response without error field', async () => {
    mockFetchError(500, {});

    await expect(api.get('/tasks')).rejects.toThrow('Erro 500');
  });

  it('returns null on 204 No Content', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: () => Promise.resolve(null),
    });

    const result = await api.delete('/tasks/1');
    expect(result).toBeNull();
  });
});

describe('api.post', () => {
  it('sends body as JSON and returns created resource', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    const newTask = { title: 'New task', priority: 1 };
    const created = { id: 42, ...newTask };
    mockFetchOk(created, 201);

    const result = await api.post('/tasks', newTask);

    expect(result).toEqual(created);
    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify(newTask));
    expect(options.headers['Content-Type']).toBe('application/json');
  });
});

describe('network timeout', () => {
  it('throws timeout error when AbortController aborts the request', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    global.fetch.mockImplementationOnce((_url, { signal }) => {
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('AbortError');
          err.name = 'AbortError';
          reject(err);
        });
      });
    });

    vi.useFakeTimers();
    const promise = api.get('/slow-endpoint');
    await vi.advanceTimersByTimeAsync(9_001);
    vi.useRealTimers();

    await expect(promise).rejects.toThrow('Timeout: servidor não respondeu em 9s');
  }, 10_000);

  it('throws network error for general fetch failures (e.g. offline)', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/tasks')).rejects.toThrow('Failed to fetch');
  });
});
