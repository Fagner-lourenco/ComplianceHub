import { memo } from 'react';
import './ScoreBar.css';

function ScoreBar({ score = 0, audience = 'client' }) {
    const isOps = audience === 'ops';
    const emptyLabel = isOps ? 'Nível de atenção não calculado' : 'Nível de atenção não calculado';
    const scoreLabel = 'Nível de atenção';

    if (score == null) {
        return (
            <span className="score-bar score-bar--empty" title={emptyLabel}>
                —
            </span>
        );
    }
    const clamped = Math.min(100, Math.max(0, score));
    const color = clamped >= 70 ? 'red' : clamped >= 30 ? 'yellow' : 'green';
    return (
        <div
            className="score-bar"
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${scoreLabel}: ${clamped} de 100`}
            title={`${scoreLabel}: ${clamped}/100`}
        >
            <div className="score-bar__track">
                <div
                    className={`score-bar__fill score-bar__fill--${color}`}
                    style={{ width: `${clamped}%` }}
                />
            </div>
            <span className={`score-bar__value score-bar__value--${color}`}>{clamped}</span>
        </div>
    );
}

export default memo(ScoreBar);
