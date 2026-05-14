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

const intFmt = (n: number) => Math.round(n).toLocaleString()

export function VideosPublishedChart(props: Props) {
  return (
    <YouTubeMetricChart
      title="Videos Published"
      metricKey="videos_published"
      color="#FF3FBF"
      format={intFmt}
      {...props}
    />
  )
}
