import './KpiCard.css';

export default function KpiCard({ label, value, color = 'neutral', onClick }) {
    return (
        <button className={`kpi-card kpi-card--${color}`} onClick={onClick}>
            <div className="kpi-card__value">{value}</div>
            <div className="kpi-card__label">{label}</div>
        </button>
    );
}
