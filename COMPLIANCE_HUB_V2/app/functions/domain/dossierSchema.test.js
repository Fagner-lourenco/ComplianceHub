/**
 * Tests for dossierSchema.js
 */

import { describe, it, expect } from 'vitest';
import {
  DOSSIER_SCHEMA_VERSION,
  MACRO_AREAS,
  SECTION_REGISTRY,
  DOSSIER_SCHEMA_REGISTRY,
  DOSSIER_PRESET_REGISTRY,
  SOURCE_STATUS_LABELS,
  resolveSchema,
  resolveSchemaForProduct,
  resolvePreset,
  resolveDossierConfiguration,
  resolveSections,
  resolveMacroAreas,
  buildDossierProjection,
  validateCustomSchema,
} from './dossierSchema.js';

describe('dossierSchema', () => {
  it('has a version string', () => {
    expect(DOSSIER_SCHEMA_VERSION).toBeTypeOf('string');
    expect(DOSSIER_SCHEMA_VERSION).toContain('v2');
  });

  describe('MACRO_AREAS', () => {
    it('has at least 10 macro-areas', () => {
      expect(Object.keys(MACRO_AREAS).length).toBeGreaterThanOrEqual(10);
    });

    it('each macro-area has required fields', () => {
      for (const [key, area] of Object.entries(MACRO_AREAS)) {
        expect(area.areaKey).toBe(key);
        expect(area.label).toBeTruthy();
        expect(area.icon).toBeTruthy();
        expect(area.description).toBeTruthy();
        expect(area.defaultOrder).toBeTypeOf('number');
      }
    });

    it('includes all target dossier areas', () => {
      const required = [
        'juridico', 'cadastro', 'financeiro', 'reguladores',
        'midia_internet', 'listas_restritivas', 'bens_imoveis',
        'profissional', 'socioambiental', 'conflito_interesse',
      ];
      for (const key of required) {
        expect(MACRO_AREAS[key]).toBeDefined();
      }
    });
  });

  describe('SECTION_REGISTRY', () => {
    it('has sections mapped to macro-areas', () => {
      expect(Object.keys(SECTION_REGISTRY).length).toBeGreaterThanOrEqual(15);
    });

    it('each section has required fields', () => {
      for (const [key, section] of Object.entries(SECTION_REGISTRY)) {
        expect(section.sectionKey).toBe(key);
        expect(section.macroArea).toBeTruthy();
        expect(MACRO_AREAS[section.macroArea]).toBeDefined();
        expect(section.label).toBeTruthy();
        expect(Array.isArray(section.sourceKeys)).toBe(true);
      }
    });

    it('juridico sections have analytics enabled', () => {
      const juridicoSections = Object.values(SECTION_REGISTRY)
        .filter((section) => section.macroArea === 'juridico');
      for (const section of juridicoSections) {
        expect(section.analyticsEnabled).toBe(true);
      }
    });
  });

  describe('DOSSIER_SCHEMA_REGISTRY', () => {
    it('has PF schemas', () => {
      expect(DOSSIER_SCHEMA_REGISTRY.dossier_pf_basic).toBeDefined();
      expect(DOSSIER_SCHEMA_REGISTRY.dossier_pf_full).toBeDefined();
      expect(DOSSIER_SCHEMA_REGISTRY.dossier_pf_basic.subjectType).toBe('pf');
    });

    it('has PJ schema', () => {
      expect(DOSSIER_SCHEMA_REGISTRY.dossier_pj).toBeDefined();
      expect(DOSSIER_SCHEMA_REGISTRY.dossier_pj.subjectType).toBe('pj');
    });

    it('has a custom or blank schema', () => {
      expect(DOSSIER_SCHEMA_REGISTRY.custom).toBeDefined();
      expect(DOSSIER_SCHEMA_REGISTRY.custom.isCustomizable).toBe(true);
      expect(DOSSIER_SCHEMA_REGISTRY.custom.isBlank).toBe(true);
    });
  });

  describe('DOSSIER_PRESET_REGISTRY', () => {
    it('covers the standardized UI presets', () => {
      expect(DOSSIER_PRESET_REGISTRY.compliance).toBeDefined();
      expect(DOSSIER_PRESET_REGISTRY.internacional).toBeDefined();
      expect(DOSSIER_PRESET_REGISTRY.financeiro).toBeDefined();
      expect(DOSSIER_PRESET_REGISTRY.investigativo).toBeDefined();
      expect(DOSSIER_PRESET_REGISTRY.juridico).toBeDefined();
      expect(DOSSIER_PRESET_REGISTRY.pld).toBeDefined();
      expect(DOSSIER_PRESET_REGISTRY.rh).toBeDefined();
    });
  });

  describe('SOURCE_STATUS_LABELS', () => {
    it('covers all execution statuses', () => {
      const statuses = [
        'completed_with_findings', 'completed_no_findings',
        'skipped_reuse', 'skipped_policy',
        'failed_retryable', 'failed_final',
        'pending', 'running', 'not_entitled',
      ];
      for (const status of statuses) {
        expect(SOURCE_STATUS_LABELS[status]).toBeDefined();
        expect(SOURCE_STATUS_LABELS[status].label).toBeTruthy();
        expect(SOURCE_STATUS_LABELS[status].variant).toBeTruthy();
      }
    });

    it('matches the new dossier flow vocabulary', () => {
      expect(SOURCE_STATUS_LABELS.completed_no_findings.label).toBe('Nenhum resultado');
      expect(SOURCE_STATUS_LABELS.pending.label).toBe('Criado');
      expect(SOURCE_STATUS_LABELS.running.label).toBe('Processando');
    });
  });

  describe('resolveSchema', () => {
    it('returns a schema for valid key', () => {
      const schema = resolveSchema('dossier_pf_full');
      expect(schema).toBeDefined();
      expect(schema.schemaKey).toBe('dossier_pf_full');
    });

    it('returns null for invalid key', () => {
      expect(resolveSchema('nonexistent')).toBeNull();
    });
  });

  describe('resolveSchemaForProduct', () => {
    it('maps productKey to schema', () => {
      expect(resolveSchemaForProduct('dossier_pf_basic')?.schemaKey).toBe('dossier_pf_basic');
      expect(resolveSchemaForProduct('dossier_pj')?.schemaKey).toBe('dossier_pj');
      expect(resolveSchemaForProduct('dossier_pf_custom')?.schemaKey).toBe('custom');
    });

    it('returns null for unknown product', () => {
      expect(resolveSchemaForProduct('unknown')).toBeNull();
    });
  });

  describe('resolvePreset', () => {
    it('returns a preset for valid key', () => {
      expect(resolvePreset('compliance')?.presetKey).toBe('compliance');
      expect(resolvePreset('rh')?.label).toBe('Recursos Humanos');
    });

    it('returns null for invalid key', () => {
      expect(resolvePreset('unknown')).toBeNull();
    });
  });

  describe('resolveSections', () => {
    it('returns sections for given moduleKeys', () => {
      const sections = resolveSections(['identity_pf', 'criminal', 'kyc']);
      expect(sections.length).toBe(3);
      expect(sections.map((section) => section.sectionKey)).toContain('identity_pf');
      expect(sections.map((section) => section.sectionKey)).toContain('criminal');
      expect(sections.map((section) => section.sectionKey)).toContain('kyc');
    });

    it('sorts by macro-area order', () => {
      const sections = resolveSections(['criminal', 'identity_pf']);
      expect(sections[0].macroArea).toBe('juridico');
      expect(sections[1].macroArea).toBe('cadastro');
    });
  });

  describe('resolveMacroAreas', () => {
    it('groups sections by macro-area', () => {
      const areas = resolveMacroAreas(['identity_pf', 'criminal', 'kyc']);
      expect(areas.length).toBe(3);
      const areaKeys = areas.map((area) => area.areaKey);
      expect(areaKeys).toContain('cadastro');
      expect(areaKeys).toContain('juridico');
      expect(areaKeys).toContain('reguladores');
    });
  });

  describe('buildDossierProjection', () => {
    it('builds a projection with macro-areas', () => {
      const projection = buildDossierProjection({
        schemaKey: 'dossier_pf_basic',
        moduleKeys: ['identity_pf', 'criminal', 'warrants', 'kyc'],
      });

      expect(projection.version).toBe(DOSSIER_SCHEMA_VERSION);
      expect(projection.schemaKey).toBe('dossier_pf_basic');
      expect(projection.macroAreas.length).toBeGreaterThan(0);
      expect(projection.summary.totalSources).toBeGreaterThan(0);
    });

    it('enriches sections with execution status from moduleRuns', () => {
      const projection = buildDossierProjection({
        schemaKey: 'dossier_pf_basic',
        moduleKeys: ['identity_pf', 'criminal'],
        moduleRuns: [
          { moduleKey: 'identity_pf', status: 'completed_with_findings', resultCount: 5 },
          { moduleKey: 'criminal', status: 'completed_no_findings', resultCount: 0 },
        ],
      });

      const cadastroArea = projection.macroAreas.find((area) => area.areaKey === 'cadastro');
      const juridicoArea = projection.macroAreas.find((area) => area.areaKey === 'juridico');
      expect(cadastroArea.sections[0].executionStatus).toBe('completed_with_findings');
      expect(cadastroArea.sections[0].hasFindings).toBe(true);
      expect(cadastroArea.sections[0].resultCount).toBe(5);
      expect(juridicoArea.sections[0].executionStatus).toBe('completed_no_findings');
      expect(juridicoArea.sections[0].statusLabel).toBe('Nenhum resultado');
    });

    it('keeps configured macro-areas visible even before execution', () => {
      const projection = buildDossierProjection({
        schemaKey: 'custom',
        requestedMacroAreaKeys: ['cadastro', 'financeiro'],
        requestedSectionKeys: ['identity_pf'],
      });

      const areaKeys = projection.macroAreas.map((area) => area.areaKey);
      expect(areaKeys).toContain('cadastro');
      expect(areaKeys).toContain('financeiro');
    });
  });

  describe('resolveDossierConfiguration', () => {
    it('builds a canonical config from preset and subject type', () => {
      const config = resolveDossierConfiguration({
        productKey: 'dossier_pf_custom',
        subjectType: 'pf',
        dossierPresetKey: 'rh',
        tag: 'admissao',
      });

      expect(config.dossierPresetKey).toBe('rh');
      expect(config.dossierSchemaKey).toBe('kye_employee');
      expect(config.requestedSectionKeys).toContain('identity_pf');
      expect(config.viewModes).toEqual(['analitico', 'detalhado']);
      expect(config.tag).toBe('admissao');
    });

    it('preserves custom composition fields', () => {
      const config = resolveDossierConfiguration({
        productKey: 'dossier_pf_custom',
        subjectType: 'pf',
        requestedMacroAreaKeys: ['cadastro', 'juridico'],
        requestedSectionKeys: ['identity_pf', 'criminal'],
        requestedSourceKeys: ['source_a'],
        customProfileName: 'Meu perfil',
        customProfileDescription: 'Perfil customizado',
        autoProcessRequested: true,
      });

      expect(config.configurationSource).toBe('custom_profile');
      expect(config.requestedSourceKeys).toEqual(['source_a']);
      expect(config.customProfileName).toBe('Meu perfil');
      expect(config.autoProcessRequested).toBe(true);
      expect(config.isValid).toBe(true);
    });
  });

  describe('validateCustomSchema', () => {
    it('validates a correct custom config', () => {
      const result = validateCustomSchema({
        macroAreas: ['cadastro', 'juridico'],
        sections: ['identity_pf', 'criminal'],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('flags inconsistent sections', () => {
      const result = validateCustomSchema({
        macroAreas: ['cadastro'],
        sections: ['criminal'],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
