import React from 'react'

export function ControlPanel() {
  return (
    <div className="w-64 bg-white border-r border-neutral-200 p-6 flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600 mb-4">
          Controls
        </p>
        <div className="space-y-3 text-sm font-mono text-neutral-700">
          <div className="flex items-center gap-2">
            <span className="bg-cyan-100 text-cyan-900 px-2 py-1 rounded text-xs font-bold">F8</span>
            <span>Start Listening</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-900 px-2 py-1 rounded text-xs font-bold">F9</span>
            <span>Fire Response</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-red-100 text-red-900 px-2 py-1 rounded text-xs font-bold">F10</span>
            <span>Kill Switch</span>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-600">
          Status
        </p>
        <p className="text-xs text-neutral-500 mt-2">Ready to listen</p>
      </div>
    </div>
  )
}
