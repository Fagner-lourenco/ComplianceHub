import './ScoreBar.css';

export default function ScoreBar({ score = 0 }) {
    const color = score >= 70 ? 'red' : score >= 30 ? 'yellow' : 'green';
    return (
        <div className="score-bar" title={`Score: ${score}/100`}>
            <div className="score-bar__track">
                <div
                    className={`score-bar__fill score-bar__fill--${color}`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
            </div>
            <span className={`score-bar__value score-bar__value--${color}`}>{score}</span>
        </div>
    );
}
