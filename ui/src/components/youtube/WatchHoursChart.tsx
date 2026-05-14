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

const hoursFmt = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M h`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K h`
  return `${n.toFixed(0)} h`
}

export function WatchHoursChart(props: Props) {
  return (
    <YouTubeMetricChart
      title="Watch Hours"
      metricKey="watch_time"
      color="#00E5D4"
      format={hoursFmt}
      {...props}
    />
  )
}
