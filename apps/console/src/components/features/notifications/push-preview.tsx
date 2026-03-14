'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bell } from 'lucide-react'

interface PushPreviewProps {
  title: string
  body: string
  appName: string
}

export function PushPreview({ title, body, appName }: PushPreviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview do Push</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto w-[280px]">
          {/* Phone frame */}
          <div className="rounded-[2rem] border-2 border-white/10 bg-black p-3">
            {/* Notch */}
            <div className="mx-auto mb-4 h-5 w-24 rounded-full bg-white/10" />
            {/* Status bar */}
            <div className="mb-3 flex justify-between px-2 text-xs text-muted-foreground">
              <span>9:41</span>
              <span>100%</span>
            </div>
            {/* Push notification card */}
            <div className="rounded-2xl bg-white/10 p-3 backdrop-blur-xl">
              <div className="flex items-start gap-2">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500">
                  <Bell className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-white/60">{appName}</span>
                    <span className="shrink-0 text-[10px] text-white/40">agora</span>
                  </div>
                  <p className="mt-0.5 text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs text-white/70 line-clamp-2">{body}</p>
                </div>
              </div>
            </div>
            {/* Spacer for phone body */}
            <div className="h-[300px]" />
            {/* Home indicator */}
            <div className="mx-auto h-1 w-28 rounded-full bg-white/20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
