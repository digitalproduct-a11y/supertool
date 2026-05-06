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

interface PostsChartProps {
  data: DashboardRow[]
}

export function PostsChart({ data }: PostsChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow p-6 h-96 flex items-center justify-center">
        <p className="text-neutral-500">No data available</p>
      </div>
    )
  }

  const chartData = data.map((row) => ({
    date: row.date,
    photo_posts: row.photo_posts,
    video_posts: row.video_posts,
    text_link_posts: row.text_link_posts,
  }))

  return (
    <div className="bg-white rounded-2xl shadow p-6">
      <h2 className="text-lg font-semibold text-neutral-950 mb-4">Posts Published</h2>
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            interval={Math.max(0, Math.floor(data.length / 7) - 1)}
          />
          <YAxis label={{ value: 'Posts', angle: -90, position: 'insideLeft' }} />
          <Tooltip labelFormatter={(label) => `Date: ${label}`} />
          <Legend />
          <Bar dataKey="photo_posts" stackId="a" fill="#FF3FBF" name="Photo" />
          <Bar dataKey="video_posts" stackId="a" fill="#00E5D4" name="Video" />
          <Bar dataKey="text_link_posts" stackId="a" fill="#0055EE" name="Text Link" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
