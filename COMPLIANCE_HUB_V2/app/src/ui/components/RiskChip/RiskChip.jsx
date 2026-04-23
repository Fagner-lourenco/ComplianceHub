import './RiskChip.css';

const CONFIG = {
    // Criminal / General risk
    NEGATIVE: { label: 'Negativo', icon: 'OK', color: 'green' },
    NEGATIVE_PARTIAL: { label: 'Negativo parcial', icon: '!', color: 'yellow' },
    POSITIVE: { label: 'Positivo', icon: '!', color: 'red' },
    INCONCLUSIVE: { label: 'Inconclusivo', icon: '?', color: 'blue' },
    INCONCLUSIVE_HOMONYM: { label: 'Inconclusivo por homonimo', icon: '?', color: 'yellow' },
    INCONCLUSIVE_LOW_COVERAGE: { label: 'Inconclusivo por cobertura', icon: '?', color: 'yellow' },
    NOT_FOUND: { label: 'Nao encontrado', icon: '-', color: 'gray' },
    HIGH_COVERAGE: { label: 'Cobertura alta', icon: 'OK', color: 'green' },
    PARTIAL_COVERAGE: { label: 'Cobertura parcial', icon: '!', color: 'yellow' },
    LOW_COVERAGE: { label: 'Cobertura reduzida', icon: '?', color: 'gray' },
    // OSINT
    LOW: { label: 'Baixo', icon: 'OK', color: 'green' },
    MEDIUM: { label: 'Medio', icon: '!', color: 'yellow' },
    HIGH: { label: 'Alto', icon: '!', color: 'red' },
    UNKNOWN: { label: 'N/A', icon: '?', color: 'gray' },
    // Social
    APPROVED: { label: 'Aprovado', icon: 'OK', color: 'green' },
    NEUTRAL: { label: 'Neutro', icon: '-', color: 'gray' },
    CONCERN: { label: 'Atencao', icon: '!', color: 'yellow' },
    CONTRAINDICATED: { label: 'Contraindicado', icon: '!', color: 'red' },
    // Digital
    CLEAN: { label: 'Limpo', icon: 'OK', color: 'green' },
    ALERT: { label: 'Alerta', icon: '!', color: 'yellow' },
    CRITICAL: { label: 'Critico', icon: '!', color: 'red' },
    NOT_CHECKED: { label: 'Nao verificado', icon: '?', color: 'gray' },
    // Conflict
    YES: { label: 'Sim', icon: '!', color: 'red' },
    NO: { label: 'Nao', icon: 'OK', color: 'green' },
    // Verdict
    FIT: { label: 'Apto', icon: 'OK', color: 'green' },
    ATTENTION: { label: 'Atencao', icon: '!', color: 'yellow' },
    NOT_RECOMMENDED: { label: 'Nao Recomendado', icon: '!', color: 'red' },
    PENDING: { label: 'Pendente', icon: '...', color: 'gray' },
    // Risk Level
    GREEN: { label: 'Verde', icon: 'OK', color: 'green' },
    YELLOW: { label: 'Amarelo', icon: '!', color: 'yellow' },
    RED: { label: 'Vermelho', icon: '!', color: 'red' },
};

export default function RiskChip({ value, size = 'sm', showIcon = true, bold = false }) {
    const cfg = CONFIG[value] || { label: value || '-', icon: '?', color: 'gray' };

    return (
        <span className={`risk-chip risk-chip--${cfg.color} risk-chip--${size} ${bold ? 'risk-chip--bold' : ''}`} aria-label={cfg.label}>
            {showIcon && <span className="risk-chip__icon" aria-hidden="true">{cfg.icon}</span>}
            <span className="risk-chip__label">{cfg.label}</span>
        </span>
    );
}
