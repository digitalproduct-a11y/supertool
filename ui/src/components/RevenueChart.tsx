import {
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { DashboardRow } from '../utils/dashboardUtils'

interface RevenueChartProps {
  data: DashboardRow[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 h-96 flex items-center justify-center">
        <p className="text-neutral-500">No data available</p>
      </div>
    )
  }

  const chartData = data.map((row) => ({
    date: row.date,
    photo_revenue: parseFloat(row.photo_revenue.toString()),
    video_revenue: parseFloat(row.video_revenue.toString()),
    story_revenue: parseFloat(row.story_revenue.toString()),
    text_link_revenue: parseFloat(row.text_link_revenue.toString()),
    bonus_revenue: parseFloat(row.bonus_revenue.toString()),
  }))

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-neutral-950 mb-4">Revenue</h2>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            interval={Math.max(0, Math.floor(data.length / 7) - 1)}
          />
          <YAxis label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            formatter={(value: any) => typeof value === 'number' ? `$${value.toFixed(2)}` : value}
            labelFormatter={(label: any) => `Date: ${label}`}
          />
          <Legend />
          <Bar dataKey="photo_revenue" stackId="a" fill="#FF3FBF" name="Photo" />
          <Bar dataKey="video_revenue" stackId="a" fill="#00E5D4" name="Video" />
          <Bar dataKey="story_revenue" stackId="a" fill="#0055EE" name="Story" />
          <Bar dataKey="text_link_revenue" stackId="a" fill="#F05A35" name="Text Link" />
          <Bar dataKey="bonus_revenue" stackId="a" fill="#9333EA" name="Bonus" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
