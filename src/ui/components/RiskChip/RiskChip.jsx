import './RiskChip.css';

const CONFIG = {
    // Criminal / General risk
    NEGATIVE: { label: 'Negativo', icon: '✅', color: 'green' },
    POSITIVE: { label: 'Positivo', icon: '🔴', color: 'red' },
    INCONCLUSIVE: { label: 'Inconclusivo', icon: '🔷', color: 'blue' },
    NOT_FOUND: { label: 'Não encontrado', icon: '➖', color: 'gray' },
    // OSINT
    LOW: { label: 'Baixo', icon: '✅', color: 'green' },
    MEDIUM: { label: 'Médio', icon: '⚠️', color: 'yellow' },
    HIGH: { label: 'Alto', icon: '🔴', color: 'red' },
    UNKNOWN: { label: 'N/A', icon: '❓', color: 'gray' },
    // Social
    APPROVED: { label: 'Aprovado', icon: '✅', color: 'green' },
    NEUTRAL: { label: 'Neutro', icon: '➖', color: 'gray' },
    CONCERN: { label: 'Atenção', icon: '⚠️', color: 'yellow' },
    CONTRAINDICATED: { label: 'Contraindicado', icon: '🔴', color: 'red' },
    // Digital
    CLEAN: { label: 'Limpo', icon: '✅', color: 'green' },
    ALERT: { label: 'Alerta', icon: '⚠️', color: 'yellow' },
    CRITICAL: { label: 'Crítico', icon: '🔴', color: 'red' },
    NOT_CHECKED: { label: 'Não verificado', icon: '❓', color: 'gray' },
    // Conflict
    YES: { label: 'Sim', icon: '🔴', color: 'red' },
    NO: { label: 'Não', icon: '✅', color: 'green' },
    // Verdict
    FIT: { label: 'Apto', icon: '✅', color: 'green' },
    ATTENTION: { label: 'Atenção', icon: '⚠️', color: 'yellow' },
    NOT_RECOMMENDED: { label: 'Não Recomendado', icon: '🔴', color: 'red' },
    PENDING: { label: 'Pendente', icon: '⏳', color: 'gray' },
    // Risk Level
    GREEN: { label: 'Verde', icon: '🟢', color: 'green' },
    YELLOW: { label: 'Amarelo', icon: '🟡', color: 'yellow' },
    RED: { label: 'Vermelho', icon: '🔴', color: 'red' },
};

export default function RiskChip({ value, size = 'sm', showIcon = true, bold = false }) {
    const cfg = CONFIG[value] || { label: value || '—', icon: '❓', color: 'gray' };

    return (
        <span className={`risk-chip risk-chip--${cfg.color} risk-chip--${size} ${bold ? 'risk-chip--bold' : ''}`} aria-label={cfg.label}>
            {showIcon && <span className="risk-chip__icon" aria-hidden="true">{cfg.icon}</span>}
            <span className="risk-chip__label">{cfg.label}</span>
        </span>
    );
}
