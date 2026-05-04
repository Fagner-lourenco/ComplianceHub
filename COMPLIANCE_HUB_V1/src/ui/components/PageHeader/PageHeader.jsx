import { Link } from 'react-router-dom';
import './PageHeader.css';

export default function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    metric,
    backAction,
    compact = false,
    className = '',
}) {
    if (process.env.NODE_ENV !== 'production' && !title) {
        console.error('PageHeader: `title` prop is required');
    }

    return (
        <header
            className={['page-header', compact && 'page-header--compact', className]
                .filter(Boolean)
                .join(' ')}
        >
            <div className="page-header__content">
                {eyebrow && (
                    <span className="page-header__eyebrow">{eyebrow}</span>
                )}
                <div className="page-header__title-row">
                    <h1 className="page-header__title">{title}</h1>
                    {backAction && (
                        backAction.onClick
                            ? <button type="button" className="page-header__back" onClick={backAction.onClick}>{backAction.label ?? 'Voltar'}</button>
                            : backAction.to && <Link className="page-header__back" to={backAction.to}>{backAction.label ?? 'Voltar'}</Link>
                    )}
                </div>
                {description && (
                    <p className="page-header__description">{description}</p>
                )}
            </div>

            {(actions || metric) && (
                <div className="page-header__aside">
                    {metric && (
                        <div className="page-header__metric">
                            <strong>{metric.value}</strong>
                            <span>{metric.label}</span>
                        </div>
                    )}
                    {actions && (
                        <div className="page-header__actions">{actions}</div>
                    )}
                </div>
            )}
        </header>
    );
}
