import { describe, it, expect } from 'vitest';
import {
    isDemoPortalPath,
    getClientPortalBasePath,
    getOpsPortalBasePath,
    buildClientPortalPath,
    buildOpsPortalPath,
} from './portalPaths';

describe('portalPaths', () => {
    describe('isDemoPortalPath', () => {
        it('retorna true para paths /demo/', () => {
            expect(isDemoPortalPath('/demo/client/fila')).toBe(true);
            expect(isDemoPortalPath('/demo/ops/casos')).toBe(true);
            expect(isDemoPortalPath('/demo/')).toBe(true);
        });

        it('retorna false para paths de producao', () => {
            expect(isDemoPortalPath('/client/fila')).toBe(false);
            expect(isDemoPortalPath('/ops/casos')).toBe(false);
            expect(isDemoPortalPath('/')).toBe(false);
        });

        it('retorna false para string vazia ou sem argumento', () => {
            expect(isDemoPortalPath('')).toBe(false);
            expect(isDemoPortalPath()).toBe(false);
        });
    });

    describe('getClientPortalBasePath', () => {
        it('retorna /demo/client para path demo', () => {
            expect(getClientPortalBasePath('/demo/client/fila')).toBe('/demo/client');
        });

        it('retorna /client para path producao', () => {
            expect(getClientPortalBasePath('/client/fila')).toBe('/client');
        });
    });

    describe('getOpsPortalBasePath', () => {
        it('retorna /demo/ops para path demo', () => {
            expect(getOpsPortalBasePath('/demo/ops/casos')).toBe('/demo/ops');
        });

        it('retorna /ops para path producao', () => {
            expect(getOpsPortalBasePath('/ops/casos')).toBe('/ops');
        });
    });

    describe('buildClientPortalPath', () => {
        it('constroi path completo em producao', () => {
            expect(buildClientPortalPath('/client/fila', '/nova')).toBe('/client/nova');
        });

        it('constroi path completo em demo', () => {
            expect(buildClientPortalPath('/demo/client/fila', '/nova')).toBe('/demo/client/nova');
        });

        it('normaliza leaf sem barra inicial', () => {
            expect(buildClientPortalPath('/client/x', 'solicitacoes')).toBe('/client/solicitacoes');
        });

        it('leaf vazio retorna base path', () => {
            expect(buildClientPortalPath('/client/foo', '')).toBe('/client');
            expect(buildClientPortalPath('/client/foo')).toBe('/client');
        });
    });

    describe('buildOpsPortalPath', () => {
        it('constroi path completo em producao', () => {
            expect(buildOpsPortalPath('/ops/fila', '/caso/123')).toBe('/ops/caso/123');
        });

        it('constroi path completo em demo', () => {
            expect(buildOpsPortalPath('/demo/ops/fila', '/caso/123')).toBe('/demo/ops/caso/123');
        });

        it('normaliza leaf sem barra inicial', () => {
            expect(buildOpsPortalPath('/ops/x', 'clientes')).toBe('/ops/clientes');
        });

        it('leaf vazio retorna base path', () => {
            expect(buildOpsPortalPath('/ops/foo', '')).toBe('/ops');
        });
    });
});
