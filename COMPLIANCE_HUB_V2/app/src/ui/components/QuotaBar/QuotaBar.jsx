import './QuotaBar.css';

function getZone(count, limit) {
    if (!limit) return 'none';
    const ratio = count / limit;
    if (ratio >= 1) return 'exceeded';
    if (ratio >= 0.8) return 'warning';
    return 'ok';
}

export default function QuotaBar({ label, count = 0, limit, allowExceedance, compact = false }) {
    if (!limit) return null;

    const zone = getZone(count, limit);
    const percent = Math.min((count / limit) * 100, 100);
    const exceeded = count > limit;
    const exceedCount = exceeded ? count - limit : 0;

    return (
        <div className={`quota-bar ${compact ? 'quota-bar--compact' : ''}`}>
            <div className="quota-bar__header">
                <span className="quota-bar__label">{label}</span>
                <span className={`quota-bar__count quota-bar__count--${zone}`}>
                    {count}/{limit}
                </span>
            </div>
            <div
                className="quota-bar__track"
                role="progressbar"
                aria-valuenow={count}
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-label={`${label}: ${count} de ${limit}`}
            >
                <div
                    className={`quota-bar__fill quota-bar__fill--${zone}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
            {exceeded && (
                <span className="quota-bar__excess">
                    {allowExceedance
                        ? `+${exceedCount} excedente${exceedCount !== 1 ? 's' : ''}`
                        : 'Limite atingido'}
                </span>
            )}
        </div>
    );
}

export function QuotaSummaryCard({ quota }) {
    if (!quota || !quota.hasLimits) return null;

    return (
        <div className="quota-summary-card">
            <div className="quota-summary-card__title">Consumo de Consultas</div>
            <QuotaBar
                label="Hoje"
                count={quota.dailyCount}
                limit={quota.dailyLimit}
                allowExceedance={quota.allowDailyExceedance}
            />
            <QuotaBar
                label="Mes"
                count={quota.monthlyCount}
                limit={quota.monthlyLimit}
                allowExceedance={quota.allowMonthlyExceedance}
            />
        </div>
    );
}
