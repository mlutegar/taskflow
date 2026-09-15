import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './apiClient';

const TOKEN_KEY = 'taskflow.authToken';
const USER_KEY = 'taskflow.authUser';

function mockFetchOnce({ ok = true, status = 200, body = {} }) {
  global.fetch.mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  global.fetch = vi.fn();
});

describe('api.get', () => {
  it('returns parsed JSON on successful GET', async () => {
    mockFetchOnce({ body: { id: 1, title: 'Task A' } });

    const result = await api.get('/tasks');

    expect(result).toEqual({ id: 1, title: 'Task A' });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/tasks'),
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('sets Authorization header when token exists in localStorage', async () => {
    localStorage.setItem(TOKEN_KEY, 'my-jwt-token');
    mockFetchOnce({ body: { ok: true } });

    await api.get('/tasks');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBe('Bearer my-jwt-token');
  });

  it('does not set Authorization header when no token', async () => {
    mockFetchOnce({ body: { ok: true } });

    await api.get('/tasks');

    const [, options] = fetch.mock.calls[0];
    expect(options.headers['Authorization']).toBeUndefined();
  });

  it('throws generic error message on non-ok response without error field', async () => {
    mockFetchOnce({ ok: false, status: 500, body: {} });

    await expect(api.get('/tasks')).rejects.toThrow('Erro 500');
  });

  it('returns null on 204 No Content', async () => {
    mockFetchOnce({ ok: true, status: 204, body: null });

    const result = await api.delete('/tasks/1');
    expect(result).toBeNull();
  });
});

describe('refresh reativo em 401', () => {
  it('renova o token e repete a requisição uma vez', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');

    // 1) requisição original → 401
    mockFetchOnce({ ok: false, status: 401, body: { error: 'Token inválido ou expirado.' } });
    // 2) /auth/refresh → novo token
    mockFetchOnce({ ok: true, status: 200, body: { token: 'fresh-token', user: { id: 'u1' } } });
    // 3) retry da requisição original → sucesso
    mockFetchOnce({ ok: true, status: 200, body: { id: 7 } });

    const result = await api.get('/protected');

    expect(result).toEqual({ id: 7 });
    expect(fetch).toHaveBeenCalledTimes(3);
    // token atualizado no localStorage
    expect(localStorage.getItem(TOKEN_KEY)).toBe('fresh-token');
    // retry usou o novo token
    const [, retryOpts] = fetch.mock.calls[2];
    expect(retryOpts.headers['Authorization']).toBe('Bearer fresh-token');
  });

  it('quando o refresh falha, encerra a sessão e emite session-expired', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'u1' }));
    const onExpired = vi.fn();
    window.addEventListener('taskflow:session-expired', onExpired);

    mockFetchOnce({ ok: false, status: 401, body: { error: 'Token inválido ou expirado.' } });
    mockFetchOnce({ ok: false, status: 401, body: { message: 'Token inválido.' } }); // /auth/refresh falha

    await expect(api.get('/protected')).rejects.toThrow('Sua sessão expirou. Entre novamente.');

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(USER_KEY)).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener('taskflow:session-expired', onExpired);
  });

  it('não tenta refresh para a própria rota /auth/refresh', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    mockFetchOnce({ ok: false, status: 401, body: { error: 'Token inválido.' } });

    await expect(api.post('/auth/refresh')).rejects.toThrow('Token inválido.');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('falha de REDE no refresh mantém a sessão (erro transitório)', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    localStorage.setItem(USER_KEY, JSON.stringify({ id: 'u1' }));
    const onExpired = vi.fn();
    window.addEventListener('taskflow:session-expired', onExpired);

    // 1) requisição original → 401
    mockFetchOnce({ ok: false, status: 401, body: { error: 'Token inválido ou expirado.' } });
    // 2) /auth/refresh → erro de rede (fetch rejeita)
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/protected')).rejects.toThrow('Sem conexão para renovar a sessão. Tente novamente.');

    // Sessão preservada — NÃO desloga por instabilidade de rede.
    expect(localStorage.getItem(TOKEN_KEY)).toBe('expired-token');
    expect(localStorage.getItem(USER_KEY)).not.toBeNull();
    expect(onExpired).not.toHaveBeenCalled();
    window.removeEventListener('taskflow:session-expired', onExpired);
  });

  it('5xx no refresh também é tratado como transitório', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    mockFetchOnce({ ok: false, status: 401, body: {} });
    mockFetchOnce({ ok: false, status: 503, body: {} }); // /auth/refresh 5xx

    await expect(api.get('/protected')).rejects.toThrow('Sem conexão para renovar a sessão. Tente novamente.');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('expired-token');
  });

  it('single-flight: dois 401 simultâneos disparam apenas 1 refresh', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');

    let refreshCalls = 0;
    global.fetch = vi.fn((url) => {
      if (String(url).includes('/auth/refresh')) {
        refreshCalls++;
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ token: 'fresh', user: { id: 'u1' } }) });
      }
      // Requisições protegidas: 401 na 1ª rodada, 200 após ter token novo.
      const isFresh = localStorage.getItem(TOKEN_KEY) === 'fresh';
      return Promise.resolve({
        ok: isFresh,
        status: isFresh ? 200 : 401,
        json: () => Promise.resolve(isFresh ? { ok: true } : { error: 'expirado' }),
      });
    });

    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1); // single-flight
  });

  it('retry ainda 401 propaga o erro do servidor', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired-token');
    mockFetchOnce({ ok: false, status: 401, body: { error: 'expirado' } });          // original
    mockFetchOnce({ ok: true, status: 200, body: { token: 'fresh', user: { id: 'u1' } } }); // refresh ok
    mockFetchOnce({ ok: false, status: 401, body: { message: 'Sem permissão.' } });  // retry ainda 401

    await expect(api.get('/protected')).rejects.toThrow('Sem permissão.');
  });
});

describe('api.post', () => {
  it('sends body as JSON and returns created resource', async () => {
    const newTask = { title: 'New task', priority: 1 };
    mockFetchOnce({ ok: true, status: 201, body: { id: 42, ...newTask } });

    const result = await api.post('/tasks', newTask);

    expect(result).toEqual({ id: 42, ...newTask });
    const [, options] = fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body).toBe(JSON.stringify(newTask));
    expect(options.headers['Content-Type']).toBe('application/json');
  });
});

describe('network timeout', () => {
  it('throws timeout error when AbortController aborts the request', async () => {
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
    // Anexa o handler de rejeição ANTES de avançar os timers, para não gerar
    // "unhandled rejection" no intervalo entre o abort e a asserção.
    const assertion = expect(promise).rejects.toThrow('Timeout: servidor não respondeu a tempo');
    await vi.advanceTimersByTimeAsync(9_001);
    await assertion;
    vi.useRealTimers();
  }, 10_000);

  it('throws network error for general fetch failures (e.g. offline)', async () => {
    global.fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(api.get('/tasks')).rejects.toThrow('Failed to fetch');
  });
});
