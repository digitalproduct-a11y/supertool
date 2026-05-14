import type { YouTubeDashboardRow } from '../../utils/youtubeDashboardUtils'
import { YouTubeMetricChart } from './YouTubeMetricChart'

interface Props {
  data: YouTubeDashboardRow[]
  prevData?: YouTubeDashboardRow[]
  showComparison?: boolean
  targetValue?: number | null
  targetLabel?: string
  showTargets?: boolean
}

const usdFmt = (n: number) => `$${n.toFixed(2)}`

export function YouTubeRevenueChart(props: Props) {
  return (
    <YouTubeMetricChart
      title="REVENUE (USD)"
      metricKey="revenue"
      color="#0055EE"
      format={usdFmt}
      {...props}
    />
  )
}
