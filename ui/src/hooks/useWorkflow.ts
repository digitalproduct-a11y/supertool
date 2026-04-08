import { useState } from 'react'
import type { WorkflowResponse, WorkflowRequest } from '../types'

interface UseWorkflowReturn {
  run: (request: WorkflowRequest) => Promise<WorkflowResponse>
  isRunning: boolean
}

export function useWorkflow(webhookUrlOverride?: string): UseWorkflowReturn {
  const [isRunning, setIsRunning] = useState(false)

  async function run(request: WorkflowRequest): Promise<WorkflowResponse> {
    const webhookUrl = webhookUrlOverride || import.meta.env.VITE_WEBHOOK_URL
    if (!webhookUrl) {
      return {
        success: false,
        error: 'execution_error',
        message: 'VITE_WEBHOOK_URL is not configured.',
      }
    }

    setIsRunning(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000) // 2 min timeout

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      })

      const data = await response.json() as Record<string, unknown>
      // Normalize subTitle → subtitle (n8n returns camelCase subTitle)
      if (data.subTitle !== undefined && data.subtitle === undefined) {
        data.subtitle = data.subTitle
      }
      return data as unknown as WorkflowResponse
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          success: false,
          error: 'execution_error',
          message: 'The request timed out. The workflow may still be running — please try again.',
        }
      }
      return {
        success: false,
        error: 'execution_error',
        message: 'Network error. Please check your connection and try again.',
      }
    } finally {
      clearTimeout(timeout)
      setIsRunning(false)
    }
  }

  return { run, isRunning }
}
