import './ScoreBar.css';

export default function ScoreBar({ score = 0 }) {
    const clamped = Math.min(100, Math.max(0, score));
    const color = clamped >= 70 ? 'red' : clamped >= 30 ? 'yellow' : 'green';
    return (
        <div
            className="score-bar"
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Score de risco: ${clamped} de 100`}
            title={`Score: ${clamped}/100`}
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
