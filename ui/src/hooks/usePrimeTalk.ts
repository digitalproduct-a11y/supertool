import { useState } from 'react'
import JSZip from 'jszip'
import type { EngagementIdea, PrimeTalkTopic, PrimeTalkAnalysisResult, TopicAngleSelection } from '../types'

export function usePrimeTalk() {
  const [topics, setTopics] = useState<PrimeTalkTopic[]>([])
  const [scriptAnalysis, setScriptAnalysis] = useState<Record<string, unknown> | null>(null)
  const [ideas, setIdeas] = useState<EngagementIdea[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function uploadAndAnalyze(file: File, analyzeWebhookUrl: string): Promise<PrimeTalkAnalysisResult | null> {
    setIsAnalyzing(true)
    setError(null)
    setTopics([])
    setScriptAnalysis(null)

    try {
      // Extract plain text from .docx client-side (docx = ZIP containing word/document.xml)
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)
      const documentXml = await zip.file('word/document.xml')?.async('string')
      if (!documentXml) {
        setError('Could not read script file. Please ensure it is a valid .docx file.')
        setIsAnalyzing(false)
        return null
      }
      const scriptText = documentXml
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<w:p[ >]/g, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()

      const res = await fetch(analyzeWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script_text: scriptText, filename: file.name }),
      })
      const data = await res.json() as PrimeTalkAnalysisResult
      if (!data.success) {
        setError((data as { message: string }).message ?? 'Analysis failed.')
        return data
      }
      setTopics(data.topics)
      setScriptAnalysis(data.script_analysis)
      return data
    } catch {
      setError('Network error during analysis. Please try again.')
      return null
    } finally {
      setIsAnalyzing(false)
    }
  }

  async function generate(selections: TopicAngleSelection[], generateWebhookUrl: string): Promise<void> {
    if (!scriptAnalysis) {
      setError('No script analysis available. Please upload a script first.')
      return
    }
    setIsGenerating(true)
    setError(null)
    setIdeas([])

    try {
      const res = await fetch(generateWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script_analysis: scriptAnalysis,
          selections,
          brand: 'hotspot',
        }),
      })
      const data = await res.json() as { success: boolean; ideas?: EngagementIdea[]; message?: string }
      if (!data.success || !data.ideas) {
        setError(data.message ?? 'Post generation failed.')
        return
      }
      setIdeas(data.ideas)
    } catch {
      setError('Network error during generation. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  function reset() {
    setTopics([])
    setScriptAnalysis(null)
    setIdeas([])
    setError(null)
    setIsAnalyzing(false)
    setIsGenerating(false)
  }

  return {
    topics,
    scriptAnalysis,
    ideas,
    setIdeas,
    isAnalyzing,
    isGenerating,
    error,
    uploadAndAnalyze,
    generate,
    reset,
  }
}
