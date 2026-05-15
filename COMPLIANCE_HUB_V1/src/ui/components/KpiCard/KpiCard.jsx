import { memo } from 'react';
import './KpiCard.css';

function KpiCard({ label, value, color = 'neutral', onClick }) {
    const Component = onClick ? 'button' : 'div';
    const props = onClick
        ? { type: 'button', onClick, 'aria-label': `${label}: ${value}` }
        : { 'aria-label': `${label}: ${value}` };

    return (
        <Component className={`kpi-card kpi-card--${color}`} {...props}>
            <div className="kpi-card__value">{value}</div>
            <div className="kpi-card__label">{label}</div>
        </Component>
    );
}

export default memo(KpiCard);
