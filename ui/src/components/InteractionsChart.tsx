import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DashboardRow } from '../utils/dashboardUtils'

interface InteractionsChartProps {
  data: DashboardRow[]
}

export function InteractionsChart({ data }: InteractionsChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 h-96 flex items-center justify-center">
        <p className="text-neutral-500">No data available</p>
      </div>
    )
  }

  const chartData = data.map((row) => ({
    date: row.date,
    total_interactions: row.total_interactions,
    reactions: row.reactions,
    comments: row.comments,
    shares: row.shares,
  }))

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-neutral-950 mb-4">Interactions</h2>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            interval={Math.max(0, Math.floor(data.length / 7) - 1)}
          />
          <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft' }} />
          <Tooltip labelFormatter={(label) => `Date: ${label}`} />
          <Legend />
          <Line type="monotone" dataKey="total_interactions" stroke="#FF3FBF" name="Total" strokeWidth={2} />
          <Line type="monotone" dataKey="reactions" stroke="#00E5D4" name="Reactions" strokeWidth={1.5} />
          <Line type="monotone" dataKey="comments" stroke="#0055EE" name="Comments" strokeWidth={1.5} />
          <Line type="monotone" dataKey="shares" stroke="#F05A35" name="Shares" strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
