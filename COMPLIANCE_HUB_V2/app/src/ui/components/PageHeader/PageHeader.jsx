import './PageHeader.css';

/**
 * Shared page header — provides consistent title/subtitle/metrics/actions layout
 * for ops and client pages. Pages should stop rolling their own `__header` block.
 */
export default function PageHeader({ eyebrow, title, subtitle, metrics, actions }) {
    return (
        <header className="page-header">
            <div className="page-header__main">
                {eyebrow && <span className="page-header__eyebrow">{eyebrow}</span>}
                {title && <h1 className="page-header__title">{title}</h1>}
                {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
            </div>
            {metrics && metrics.length > 0 && (
                <dl className="page-header__metrics">
                    {metrics.map((metric) => (
                        <div key={metric.label} className="page-header__metric">
                            <dt className="page-header__metric-label">{metric.label}</dt>
                            <dd className="page-header__metric-value" data-testid={metric.testId}>
                                {metric.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            {actions && (
                <div className="page-header__actions">{actions}</div>
            )}
        </header>
    );
}
