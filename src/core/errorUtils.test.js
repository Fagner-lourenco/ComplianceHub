import { describe, it, expect } from 'vitest';
import { extractErrorMessage, classifyError, getUserFriendlyMessage } from './errorUtils';

describe('errorUtils', () => {
    // ── extractErrorMessage ──────────────────────────────────────────────────

    describe('extractErrorMessage', () => {
        it('retorna default quando error eh null/undefined', () => {
            expect(extractErrorMessage(null)).toBe('Ocorreu um erro inesperado.');
            expect(extractErrorMessage(undefined)).toBe('Ocorreu um erro inesperado.');
        });

        it('aceita default customizado', () => {
            expect(extractErrorMessage(null, 'Falha geral')).toBe('Falha geral');
        });

        it('retorna mensagem segura do error.message', () => {
            const err = { message: 'O CPF informado ja esta cadastrado no sistema.' };
            expect(extractErrorMessage(err)).toBe('O CPF informado ja esta cadastrado no sistema.');
        });

        it('limpa prefixo FirebaseError e Error', () => {
            expect(extractErrorMessage({ message: 'FirebaseError: algo deu errado' }))
                .toBe('algo deu errado');
            expect(extractErrorMessage({ message: 'Error: problema detectado' }))
                .toBe('problema detectado');
        });

        it('rejeita mensagens com stack traces (unsafe)', () => {
            const err = { message: 'at callFunction (/node_modules/firebase)', code: 'internal' };
            expect(extractErrorMessage(err)).toBe(
                'Ocorreu um erro interno no servidor. Tente novamente em alguns instantes.',
            );
        });

        it('rejeita mensagens com enderecos IP', () => {
            const err = { message: 'Connection refused 192.168.1.100:3000' };
            expect(extractErrorMessage(err)).toBe('Ocorreu um erro inesperado.');
        });

        it('rejeita mensagem single-word tecnica (ECONNREFUSED)', () => {
            const err = { message: 'ECONNREFUSED' };
            expect(extractErrorMessage(err)).toBe('Ocorreu um erro inesperado.');
        });

        it('rejeita mensagem single-word ASCII sem contexto', () => {
            const err = { message: 'timeout' };
            expect(extractErrorMessage(err)).toBe('Ocorreu um erro inesperado.');
        });

        it('usa FIREBASE_CODE_MAP para codigos conhecidos quando mensagem eh unsafe', () => {
            expect(extractErrorMessage({ code: 'unauthenticated' }))
                .toBe('Sua sessao expirou. Faca login novamente.');
            expect(extractErrorMessage({ code: 'permission-denied' }))
                .toBe('Voce nao tem permissao para esta acao.');
            expect(extractErrorMessage({ code: 'resource-exhausted' }))
                .toBe('Limite de uso atingido. Tente novamente mais tarde.');
            expect(extractErrorMessage({ code: 'invalid-argument' }))
                .toBe('Dados enviados sao invalidos. Revise os campos e tente novamente.');
            expect(extractErrorMessage({ code: 'not-found' }))
                .toBe('O registro solicitado nao foi encontrado.');
            expect(extractErrorMessage({ code: 'unavailable' }))
                .toBe('Servico temporariamente indisponivel. Tente novamente em alguns instantes.');
            expect(extractErrorMessage({ code: 'deadline-exceeded' }))
                .toBe('O servidor demorou para responder. Tente novamente.');
        });

        it('aceita codigos com prefixo functions/', () => {
            expect(extractErrorMessage({ code: 'functions/unauthenticated' }))
                .toBe('Sua sessao expirou. Faca login novamente.');
        });

        it('usa error.details quando message esta vazia', () => {
            const err = { details: 'Detalhe seguro para o usuario' };
            expect(extractErrorMessage(err)).toBe('Detalhe seguro para o usuario');
        });
    });

    // ── classifyError ────────────────────────────────────────────────────────

    describe('classifyError', () => {
        it('retorna unknown para null', () => {
            expect(classifyError(null)).toEqual({ type: 'unknown', message: '', retryable: false });
        });

        it('classifica erros de autenticacao como auth (nao retentavel)', () => {
            expect(classifyError({ code: 'unauthenticated' })).toMatchObject({ type: 'auth', retryable: false });
            expect(classifyError({ code: 'permission-denied' })).toMatchObject({ type: 'auth', retryable: false });
        });

        it('classifica resource-exhausted como limit (nao retentavel)', () => {
            expect(classifyError({ code: 'resource-exhausted' })).toMatchObject({ type: 'limit', retryable: false });
        });

        it('classifica erros de validacao (nao retentaveis)', () => {
            expect(classifyError({ code: 'invalid-argument' })).toMatchObject({ type: 'validation', retryable: false });
            expect(classifyError({ code: 'failed-precondition' })).toMatchObject({ type: 'validation', retryable: false });
            expect(classifyError({ code: 'already-exists' })).toMatchObject({ type: 'validation', retryable: false });
        });

        it('classifica erros de servidor como retentaveis', () => {
            expect(classifyError({ code: 'unavailable' })).toMatchObject({ type: 'server', retryable: true });
            expect(classifyError({ code: 'deadline-exceeded' })).toMatchObject({ type: 'server', retryable: true });
            expect(classifyError({ code: 'internal' })).toMatchObject({ type: 'server', retryable: true });
        });

        it('detecta erros de rede pela mensagem', () => {
            expect(classifyError({ message: 'Network request failed' })).toMatchObject({ type: 'network', retryable: true });
            expect(classifyError({ message: 'Timeout ao conectar' })).toMatchObject({ type: 'network', retryable: true });
            expect(classifyError({ message: 'ECONNREFUSED 127.0.0.1' })).toMatchObject({ type: 'network', retryable: true });
        });

        it('retorna unknown para erros sem codigo nem padrao de rede', () => {
            expect(classifyError({ message: 'Algo deu errado no sistema.' })).toMatchObject({ type: 'unknown', retryable: false });
        });

        it('inclui mensagem em todas as classificacoes', () => {
            const result = classifyError({ code: 'unauthenticated' });
            expect(result.message).toBeTruthy();
        });
    });

    // ── getUserFriendlyMessage ───────────────────────────────────────────────

    describe('getUserFriendlyMessage', () => {
        it('auth — retorna mensagem direta sem prefixo', () => {
            const msg = getUserFriendlyMessage({ code: 'unauthenticated' }, 'enviar caso');
            expect(msg).toBe('Sua sessao expirou. Faca login novamente.');
        });

        it('limit — retorna mensagem direta sem prefixo', () => {
            const msg = getUserFriendlyMessage({ code: 'resource-exhausted' }, 'enviar caso');
            expect(msg).toBe('Limite de uso atingido. Tente novamente mais tarde.');
        });

        it('validation — inclui prefixo com operationLabel', () => {
            const msg = getUserFriendlyMessage({ code: 'invalid-argument' }, 'salvar o perfil');
            expect(msg).toContain('Nao foi possivel salvar o perfil');
        });

        it('server retentavel — adiciona hint de conexao', () => {
            const msg = getUserFriendlyMessage({ code: 'unavailable' }, 'carregar dados');
            expect(msg).toContain('Verifique sua conexao e tente novamente');
        });

        it('sem operationLabel — usa prefixo generico', () => {
            const msg = getUserFriendlyMessage({ code: 'invalid-argument' });
            expect(msg).toMatch(/^A operacao falhou/);
        });

        it('unknown — combina prefixo com mensagem', () => {
            const msg = getUserFriendlyMessage(
                { message: 'Erro desconhecido no modulo X.' },
                'processar caso',
            );
            expect(msg).toContain('Nao foi possivel processar caso');
        });

        it('error completamente vazio — fallback generico com default message', () => {
            const msg = getUserFriendlyMessage({});
            expect(msg).toContain('A operacao falhou');
            expect(msg).toContain('Ocorreu um erro inesperado');
        });
    });
});
