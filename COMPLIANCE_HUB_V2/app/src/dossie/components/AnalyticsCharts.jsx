import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#ff8417', '#a44167', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#6b7280'];

function ChartCard({ title, children, action }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

export function StatusBarChart({ data }) {
  const chartData = Object.entries(data || {}).map(([name, value]) => ({
    name: name === 'arquivamento' ? 'Arquivamento' : 'Em Tramitação',
    value,
  }));

  return (
    <ChartCard title="Status de processos">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
            formatter={(value) => [value, 'Processos']}
          />
          <Bar dataKey="value" fill="#ff8417" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function TribunalPieChart({ data }) {
  const chartData = (data || []).map((item) => {
    const label = item.label || '—';
    return {
      name: label.length > 20 ? label.slice(0, 20) + '...' : label,
      value: item.value,
    };
  });

  return (
    <ChartCard title="Quantidade de processos por tribunais">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={70}
            paddingAngle={3}
            dataKey="value"
            label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
            labelStyle={{ fontSize: 10 }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function SubjectsPieChart({ data }) {
  const chartData = (data || []).map((item) => {
    const label = item.label || '—';
    return {
      name: label.length > 25 ? label.slice(0, 25) + '...' : label,
      value: item.count,
    };
  });

  return (
    <ChartCard title="Principais assuntos">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend
            verticalAlign="middle"
            align="right"
            layout="vertical"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 10 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function GenericStats({ area }) {
  const total = area.sources?.length || 0;
  const withResults = area.sourcesWithResults || 0;
  const withoutResults = total - withResults;
  const unavailable = area.sources?.filter(s => s.status === 'unavailable').length || 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-center">
        <p className="text-[22px] font-bold text-emerald-700">{withResults}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Com resultado</p>
      </div>
      <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-center">
        <p className="text-[22px] font-bold text-amber-700">{withoutResults}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-amber-600">Sem resultado</p>
      </div>
      <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-center">
        <p className="text-[22px] font-bold text-red-700">{unavailable}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">Indisponível</p>
      </div>
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-center">
        <p className="text-[22px] font-bold text-gray-700">{total}</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Total de fontes</p>
      </div>
    </div>
  );
}
