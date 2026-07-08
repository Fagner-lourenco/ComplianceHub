import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';

const require = createRequire(import.meta.url);

const {
  classifyCriminalMateriality,
  isCriminalMaterial,
  requiresCriminalAttention,
} = require('./criminalMateriality');

describe('criminalMateriality', () => {
  it('marks defendant violent criminal case as material', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'ACAO PENAL',
      assunto: 'Violencia Domestica Contra a Mulher',
      specificRole: 'Reu',
      isDefendant: true,
    });

    expect(result).toMatchObject({
      isCriminal: true,
      isMaterial: true,
      requiresAttention: true,
      roleCategory: 'DEFENDANT',
    });
    expect(isCriminalMaterial(result)).toBe(true);
  });

  it('keeps traffic crime with defendant role as attention but not contraindicating material', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'ACAO PENAL',
      assunto: 'CONDUZIR VEICULO AUTOMOTOR SOB A INFLUENCIA DE ALCOOL OU OUTRA SUBSTANCIA PSICOATIVA (ART.306 - CTB)',
      specificRole: 'Reu',
      isDefendant: true,
    });

    expect(result).toMatchObject({
      isMaterial: false,
      requiresAttention: true,
      exclusionReason: 'TRANSITO',
    });
    expect(requiresCriminalAttention(result)).toBe(true);
  });

  it('keeps criminal rogatory letter with defendant role as attention unless it is mere citation/intimation noise', () => {
    const substantive = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'Carta Precatoria Criminal',
      assunto: 'Aplicacao, Revovacao, Cumprimento / Medidas de Seguranca',
      specificRole: 'Reu',
      isDefendant: true,
    });
    expect(substantive).toMatchObject({
      isMaterial: true,
      requiresAttention: true,
      exclusionReason: null,
    });

    const noise = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'Carta Precatoria Criminal',
      assunto: 'Intimacao ou Notificacao / Atos Processuais',
      specificRole: 'Reu',
      isDefendant: true,
    });
    expect(noise).toMatchObject({
      isMaterial: false,
      requiresAttention: true,
      exclusionReason: 'CARTA_PRECATORIA_NOISE',
    });
  });

  it('marks neutral role in serious criminal case as attention but not material', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'ACAO PENAL DE COMPETENCIA DO JURI',
      assunto: 'HOMICIDIO QUALIFICADO',
      specificRole: 'INTERESSADO',
      isDefendant: false,
      isVictim: false,
      isWitness: false,
    });

    expect(result).toMatchObject({
      isMaterial: false,
      requiresAttention: true,
      roleCategory: 'OTHER',
    });
  });

  it('does not treat victim or witness criminal matches as material', () => {
    expect(classifyCriminalMateriality({
      isCriminal: true,
      specificRole: 'Vitima',
      isVictim: true,
    }).isMaterial).toBe(false);
    expect(classifyCriminalMateriality({
      isCriminal: true,
      specificRole: 'Testemunha',
      isWitness: true,
    }).isMaterial).toBe(false);
  });

  it('does not classify civil process (isCriminal=false) as criminal even with crime keyword in assunto', () => {
    const result = classifyCriminalMateriality({
      isCriminal: false,
      area: 'CIVEL',
      classe: 'Procedimento Comum',
      assunto: 'Indenizacao - Furto de veiculo',
      specificRole: 'Reu',
      isDefendant: true,
    });

    expect(result.isCriminal).toBe(false);
    expect(result.isMaterial).toBe(false);
    expect(result.requiresAttention).toBe(false);
  });

  it('does not classify labor plaintiff with "ameaca" in assunto as criminal material', () => {
    const result = classifyCriminalMateriality({
      isCriminal: false,
      area: 'LABOR',
      classe: 'Acao Trabalhista - Rito Ordinario',
      assunto: 'Rescisao Indireta - Ameaca',
      specificRole: 'Reclamante',
      isDefendant: false,
      roleClassification: { category: 'PLAINTIFF', riskLevel: 'HIGH', reason: 'Autor/Reclamante em acao trabalhista' },
    });

    expect(result.isCriminal).toBe(false);
    expect(result.isMaterial).toBe(false);
    expect(result.requiresAttention).toBe(false);
  });

  it('does not treat high-risk role from non-criminal area as material role', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'ACAO PENAL',
      assunto: 'ESTELIONATO',
      specificRole: 'Reclamante',
      isDefendant: false,
      roleClassification: { category: 'PLAINTIFF', riskLevel: 'HIGH', reason: 'Autor/Reclamante em acao trabalhista' },
    });

    expect(result.isMaterial).toBe(false);
  });

  it('uses canonical criminal indicator when isCriminal flag is absent', () => {
    const result = classifyCriminalMateriality({
      classe: 'Procedimento Especial',
      assunto: 'ESTELIONATO',
      specificRole: 'Reu',
      isDefendant: true,
    });

    expect(result.isCriminal).toBe(true);
    expect(result.isMaterial).toBe(true);
  });

  it('honors provider isMaterialRisk signal as material role', () => {
    const result = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'ACAO PENAL',
      assunto: 'HOMICIDIO QUALIFICADO',
      specificRole: 'Interessado',
      isDefendant: false,
      isMaterialRisk: true,
    });

    expect(result.isMaterial).toBe(true);
  });

  it('classifies compound victim/witness role strings as low risk', () => {
    const victim = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'ACAO PENAL',
      assunto: 'ESTELIONATO',
      specificRole: 'VITIMA DE ESTELIONATO',
    });
    expect(victim.isLowRiskRole).toBe(true);
    expect(victim.requiresAttention).toBe(false);
    expect(victim.isMaterial).toBe(false);

    const witness = classifyCriminalMateriality({
      isCriminal: true,
      classe: 'ACAO PENAL',
      assunto: 'ROUBO MAJORADO',
      specificRole: 'TESTEMUNHA DE DEFESA',
    });
    expect(witness.isLowRiskRole).toBe(true);
    expect(witness.requiresAttention).toBe(false);
  });
});
