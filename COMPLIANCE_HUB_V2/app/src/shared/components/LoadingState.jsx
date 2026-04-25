export default function LoadingState({ rows = 5, columns = 4 }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm" role="status" aria-live="polite" aria-label="Carregando">
      {/* Header skeleton */}
      <div className="flex items-center gap-3 border-b border-gray-50 pb-3">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={`h-${i}`}
            className="h-3 flex-1 animate-pulse rounded bg-gray-100"
            style={{ maxWidth: i === 0 ? '40%' : '100%' }}
          />
        ))}
      </div>
      {/* Body skeleton */}
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`r-${r}`} className="flex items-center gap-3">
            {Array.from({ length: columns }).map((_, c) => (
              <div
                key={`c-${c}`}
                className="h-3 flex-1 animate-pulse rounded bg-gray-100"
                style={{ animationDelay: `${(r * columns + c) * 60}ms` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
