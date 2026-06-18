import { memo } from 'react';
import './RiskChip.css';

function buildConfig(audience) {
    const isOps = audience === 'ops';
    return {
        // Criminal / General risk
        NEGATIVE: { label: isOps ? 'Negativo' : 'Sem apontamento', icon: 'OK', color: 'green' },
        NEGATIVE_PARTIAL: { label: isOps ? 'Negativo' : 'Sem apontamento', icon: 'OK', color: 'green' },
        POSITIVE: { label: isOps ? 'Positivo' : 'Com apontamento', icon: '!', color: 'red' },
        INCONCLUSIVE: { label: 'Inconclusivo', icon: '?', color: 'blue' },
        INCONCLUSIVE_HOMONYM: { label: 'Inconclusivo', icon: '?', color: 'blue' },
        INCONCLUSIVE_LOW_COVERAGE: { label: 'Inconclusivo', icon: '?', color: 'blue' },
        NOT_FOUND: { label: 'Não encontrado', icon: '-', color: 'gray' },
        HIGH_COVERAGE: { label: 'Cobertura alta', icon: 'OK', color: 'green' },
        PARTIAL_COVERAGE: { label: 'Cobertura parcial', icon: '!', color: 'yellow' },
        LOW_COVERAGE: { label: 'Cobertura reduzida', icon: '?', color: 'gray' },
        // Perfis públicos
        LOW: { label: 'Baixo', icon: 'OK', color: 'green' },
        MEDIUM: { label: 'Médio', icon: '!', color: 'yellow' },
        HIGH: { label: 'Alto', icon: '!', color: 'red' },
        UNKNOWN: { label: 'N/A', icon: '?', color: 'gray' },
        // Social
        APPROVED: { label: 'Aprovado', icon: 'OK', color: 'green' },
        NEUTRAL: { label: 'Neutro', icon: '-', color: 'gray' },
        CONCERN: { label: 'Atenção', icon: '!', color: 'yellow' },
        CONTRAINDICATED: { label: 'Contraindicado', icon: '!', color: 'red' },
        // Digital
        CLEAN: { label: 'Limpo', icon: 'OK', color: 'green' },
        ALERT: { label: 'Alerta', icon: '!', color: 'yellow' },
        CRITICAL: { label: 'Crítico', icon: '!', color: 'red' },
        NOT_CHECKED: { label: 'Não verificado', icon: '?', color: 'gray' },
        // Conflict
        YES: { label: 'Sim', icon: '!', color: 'red' },
        NO: { label: 'Não', icon: 'OK', color: 'green' },
        // Verdict
        FIT: { label: 'Apto', icon: 'OK', color: 'green' },
        ATTENTION: { label: 'Atenção', icon: '!', color: 'yellow' },
        NOT_RECOMMENDED: { label: 'Não recomendado', icon: '!', color: 'red' },
        PENDING: { label: 'Pendente', icon: '...', color: 'gray' },
        // Risk Level
        GREEN: { label: 'Verde', icon: 'OK', color: 'green' },
        YELLOW: { label: 'Amarelo', icon: '!', color: 'yellow' },
        RED: { label: 'Vermelho', icon: '!', color: 'red' },
    };
}

function RiskChip({ value, size = 'sm', showIcon = true, bold = false, audience = 'client' }) {
    const CONFIG = buildConfig(audience);
    const cfg = CONFIG[value] || { label: value || '-', icon: '?', color: 'gray' };

    return (
        <span className={`risk-chip risk-chip--${cfg.color} risk-chip--${size} ${bold ? 'risk-chip--bold' : ''}`} aria-label={cfg.label}>
            {showIcon && <span className="risk-chip__icon" aria-hidden="true">{cfg.icon}</span>}
            <span className="risk-chip__label">{cfg.label}</span>
        </span>
    );
}

export default memo(RiskChip);
