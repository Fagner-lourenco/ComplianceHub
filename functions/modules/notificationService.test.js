/**
 * Testes para notificationService.js
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isPrivateOrLocalIp,
  normalizeIp,
  getRequestIp,
  sanitizeGeoText,
  lookupIpLocation,
  createCaseCompletedNotifications,
  createNewSolicitationNotifications,
} from './notificationService';

// Mock do fetch global
const originalFetch = global.fetch;

describe('isPrivateOrLocalIp', () => {
  it('detecta localhost', () => {
    expect(isPrivateOrLocalIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrLocalIp('::1')).toBe(true);
  });

  it('detecta IPs privados classe A', () => {
    expect(isPrivateOrLocalIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrLocalIp('10.255.255.255')).toBe(true);
  });

  it('detecta IPs privados classe B', () => {
    expect(isPrivateOrLocalIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrLocalIp('172.31.255.255')).toBe(true);
    expect(isPrivateOrLocalIp('172.15.0.1')).toBe(false);
    expect(isPrivateOrLocalIp('172.32.0.1')).toBe(false);
  });

  it('detecta IPs privados classe C', () => {
    expect(isPrivateOrLocalIp('192.168.0.1')).toBe(true);
    expect(isPrivateOrLocalIp('192.168.255.255')).toBe(true);
  });

  it('rejeita IPs publicos', () => {
    expect(isPrivateOrLocalIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrLocalIp('200.200.200.200')).toBe(false);
  });

  it('lida com input vazio', () => {
    expect(isPrivateOrLocalIp('')).toBe(false);
    expect(isPrivateOrLocalIp(null)).toBe(false);
    expect(isPrivateOrLocalIp(undefined)).toBe(false);
  });
});

describe('normalizeIp', () => {
  it('normaliza IPv6 mapeado em IPv4', () => {
    expect(normalizeIp('::ffff:192.168.1.1')).toBe('192.168.1.1');
  });

  it('seleciona primeiro IP publico em lista', () => {
    expect(normalizeIp('10.0.0.1, 200.200.200.200, 192.168.1.1')).toBe('200.200.200.200');
  });

  it('fallback para primeiro IP se todos sao privados', () => {
    expect(normalizeIp('10.0.0.1, 192.168.1.1')).toBe('10.0.0.1');
  });

  it('retorna null para input vazio', () => {
    expect(normalizeIp('')).toBeNull();
    expect(normalizeIp(null)).toBeNull();
  });

  it('retorna IP publico normalizado', () => {
    expect(normalizeIp('  200.200.200.200  ')).toBe('200.200.200.200');
  });
});

describe('getRequestIp', () => {
  it('extrai IP de x-forwarded-for', () => {
    const req = {
      headers: { 'x-forwarded-for': '200.200.200.200' },
    };
    expect(getRequestIp(req)).toBe('200.200.200.200');
  });

  it('extrai IP de req.ip', () => {
    const req = {
      headers: {},
      ip: '200.200.200.200',
    };
    expect(getRequestIp(req)).toBe('200.200.200.200');
  });

  it('retorna null quando nao ha IP', () => {
    const req = { headers: {} };
    expect(getRequestIp(req)).toBeNull();
  });

  it('ignora IPs privados e pega o proximo', () => {
    const req = {
      headers: {
        'x-forwarded-for': '10.0.0.1, 200.200.200.200',
      },
    };
    expect(getRequestIp(req)).toBe('200.200.200.200');
  });
});

describe('sanitizeGeoText', () => {
  it('remove caracteres HTML', () => {
    expect(sanitizeGeoText('Sao Paulo<script>')).toBe('Sao Pauloscript');
  });

  it('normaliza espacos', () => {
    expect(sanitizeGeoText('  Sao   Paulo  ')).toBe('Sao Paulo');
  });

  it('trunca no maxLength', () => {
    const long = 'a'.repeat(100);
    expect(sanitizeGeoText(long, 10)).toBe('a'.repeat(10));
  });

  it('lida com valores nulos', () => {
    expect(sanitizeGeoText(null)).toBe('');
    expect(sanitizeGeoText(undefined)).toBe('');
  });
});

describe('lookupIpLocation', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('retorna erro para IP privado', async () => {
    const result = await lookupIpLocation('127.0.0.1');
    expect(result.lookupOk).toBe(false);
    expect(result.reason).toBe('private_or_local_ip');
  });

  it('retorna erro para IP nulo', async () => {
    const result = await lookupIpLocation(null);
    expect(result.lookupOk).toBe(false);
    expect(result.reason).toBe('private_or_local_ip');
  });

  it('retorna dados geograficos em sucesso', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        city: 'Sao Paulo',
        region: 'Sao Paulo',
        region_code: 'SP',
        country_name: 'Brazil',
        country_code: 'BR',
      }),
    });

    const result = await lookupIpLocation('200.200.200.200');
    expect(result.lookupOk).toBe(true);
    expect(result.city).toBe('Sao Paulo');
    expect(result.regionCode).toBe('SP');
    expect(result.countryCode).toBe('BR');
    expect(result.provider).toBe('ipapi.co');
  });

  it('retorna erro em HTTP nao-ok', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
    });

    const result = await lookupIpLocation('200.200.200.200');
    expect(result.lookupOk).toBe(false);
    expect(result.reason).toBe('http_429');
  });

  it('retorna erro em timeout', async () => {
    global.fetch.mockImplementationOnce(() =>
      new Promise((_, reject) => {
        const error = new Error('Timeout');
        error.name = 'AbortError';
        reject(error);
      })
    );

    const result = await lookupIpLocation('200.200.200.200');
    expect(result.lookupOk).toBe(false);
    expect(result.reason).toBe('timeout');
  });

  it('retorna erro em falha de rede', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await lookupIpLocation('200.200.200.200');
    expect(result.lookupOk).toBe(false);
    expect(result.reason).toBe('lookup_failed');
  });
});

describe('createCaseCompletedNotifications', () => {
  const makeCaseComm = (overrides = {}) => ({
    findClientNotificationRecipientsForCase: vi.fn().mockResolvedValue([]),
    createNotification: vi.fn().mockResolvedValue('notif-id-1'),
    NOTIFICATION_TYPES: { CASE_COMPLETED: 'CASE_COMPLETED' },
    ...overrides,
  });

  it('retorna array vazio quando nao ha recipients', async () => {
    const caseComm = makeCaseComm();
    const result = await createCaseCompletedNotifications('case-1', { tenantId: 't1' }, caseComm);
    expect(result).toEqual([]);
    expect(caseComm.findClientNotificationRecipientsForCase).toHaveBeenCalledWith({ tenantId: 't1' });
  });

  it('cria notificacoes para cada recipient', async () => {
    const caseComm = makeCaseComm({
      findClientNotificationRecipientsForCase: vi.fn().mockResolvedValue([
        { uid: 'u1' },
        { uid: 'u2' },
      ]),
    });
    const caseData = { tenantId: 't1', candidateName: 'Joao' };
    const result = await createCaseCompletedNotifications('case-1', caseData, caseComm);

    expect(result).toEqual(['notif-id-1', 'notif-id-1']);
    expect(caseComm.createNotification).toHaveBeenCalledTimes(2);
    expect(caseComm.createNotification).toHaveBeenNthCalledWith(1, {
      tenantId: 't1',
      recipientUid: 'u1',
      type: 'CASE_COMPLETED',
      title: 'Análise concluída',
      message: 'A análise de Joao já está disponível.',
      targetUrl: '/client/relatorio/case-1',
      caseId: 'case-1',
      candidateName: 'Joao',
      source: { kind: 'system', caseId: 'case-1', event: 'case_completed' },
    });
  });

  it('continua quando um recipient falha', async () => {
    const caseComm = makeCaseComm({
      findClientNotificationRecipientsForCase: vi.fn().mockResolvedValue([
        { uid: 'u1' },
        { uid: 'u2' },
      ]),
      createNotification: vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('notif-id-2'),
    });
    const result = await createCaseCompletedNotifications('case-1', { tenantId: 't1' }, caseComm);
    expect(result).toEqual(['notif-id-2']);
  });
});

describe('createNewSolicitationNotifications', () => {
  const makeCaseComm = (overrides = {}) => ({
    findOpsNotificationRecipientsForTenant: vi.fn().mockResolvedValue([]),
    createNotification: vi.fn().mockResolvedValue('notif-id-1'),
    NOTIFICATION_TYPES: { NEW_CLIENT_SOLICITATION: 'NEW_CLIENT_SOLICITATION' },
    ...overrides,
  });

  it('retorna array vazio quando nao ha recipients', async () => {
    const caseComm = makeCaseComm();
    const result = await createNewSolicitationNotifications('case-1', { tenantId: 't1' }, caseComm);
    expect(result).toEqual([]);
    expect(caseComm.findOpsNotificationRecipientsForTenant).toHaveBeenCalledWith('t1');
  });

  it('cria notificacoes para cada recipient', async () => {
    const caseComm = makeCaseComm({
      findOpsNotificationRecipientsForTenant: vi.fn().mockResolvedValue([
        { uid: 'u1' },
      ]),
    });
    const caseData = { tenantId: 't1', candidateName: 'Joao', tenantName: 'Acme' };
    const result = await createNewSolicitationNotifications('case-1', caseData, caseComm);

    expect(result).toEqual(['notif-id-1']);
    expect(caseComm.createNotification).toHaveBeenCalledWith({
      tenantId: 't1',
      recipientUid: 'u1',
      type: 'NEW_CLIENT_SOLICITATION',
      title: 'Nova solicitação recebida',
      message: 'Acme enviou uma nova análise.',
      targetUrl: '/ops/caso/case-1',
      caseId: 'case-1',
      candidateName: 'Joao',
      source: { kind: 'system', caseId: 'case-1', event: 'new_client_solicitation' },
    });
  });

  it('tenta ate 3 vezes em caso de falha', async () => {
    const caseComm = makeCaseComm({
      findOpsNotificationRecipientsForTenant: vi.fn().mockResolvedValue([
        { uid: 'u1' },
      ]),
      createNotification: vi.fn().mockRejectedValue(new Error('fail')),
    });
    const result = await createNewSolicitationNotifications('case-1', { tenantId: 't1' }, caseComm);
    expect(result).toEqual([]);
    expect(caseComm.createNotification).toHaveBeenCalledTimes(3);
  });

  it('usa nome sanitizado sem caracteres especiais', async () => {
    const caseComm = makeCaseComm({
      findOpsNotificationRecipientsForTenant: vi.fn().mockResolvedValue([
        { uid: 'u1' },
      ]),
    });
    const caseData = { tenantId: 't1', candidateName: '<Joao>', tenantName: '"Acme"' };
    await createNewSolicitationNotifications('case-1', caseData, caseComm);

    const call = caseComm.createNotification.mock.calls[0][0];
    expect(call.candidateName).toBe('Joao');
    expect(call.message).toBe('Acme enviou uma nova análise.');
  });
});
