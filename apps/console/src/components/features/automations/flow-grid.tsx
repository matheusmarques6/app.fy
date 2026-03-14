'use client'

import { useState } from 'react'
import { automationFlows } from '@/lib/mock-data'
import type { AutomationFlow } from '@/types'
import { FlowCard } from './flow-card'
import { FlowDetailSheet } from './flow-detail-sheet'

export function FlowGrid() {
  const [flows, setFlows] = useState(automationFlows)
  const [selectedFlow, setSelectedFlow] = useState<AutomationFlow | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleToggle = (id: string) => {
    setFlows((prev) =>
      prev.map((f) => (f.id === id ? { ...f, isEnabled: !f.isEnabled } : f)),
    )
  }

  const handleClick = (flow: AutomationFlow) => {
    setSelectedFlow(flow)
    setSheetOpen(true)
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {flows.map((flow) => (
          <FlowCard key={flow.id} flow={flow} onToggle={handleToggle} onClick={handleClick} />
        ))}
      </div>
      <FlowDetailSheet flow={selectedFlow} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}
