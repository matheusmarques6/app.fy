'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Home, Grid3X3, Tag, User } from 'lucide-react'
import { appConfig } from '@/lib/mock-data'

export function PhoneMockup() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mx-auto w-[260px]">
          <div className="rounded-[2rem] border-2 border-white/10 bg-black p-3">
            {/* Notch */}
            <div className="mx-auto mb-3 h-5 w-24 rounded-full bg-white/10" />
            {/* Status bar */}
            <div className="mb-2 flex justify-between px-2 text-xs text-muted-foreground">
              <span>9:41</span>
              <span>100%</span>
            </div>
            {/* Header */}
            <div
              className="rounded-t-xl p-4 text-center"
              style={{ backgroundColor: appConfig.primaryColor }}
            >
              <h3 className="text-lg font-bold text-white">{appConfig.appName}</h3>
            </div>
            {/* Content area */}
            <div className="space-y-2 bg-[#1a1a1a] p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
            {/* Bottom nav */}
            <div className="flex items-center justify-around rounded-b-xl bg-[#121214] py-2">
              {[
                { icon: Home, label: 'Inicio' },
                { icon: Grid3X3, label: 'Categorias' },
                { icon: Tag, label: 'Ofertas' },
                { icon: User, label: 'Conta' },
              ].map((item) => (
                <div key={item.label} className="flex flex-col items-center gap-0.5">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
            {/* Home indicator */}
            <div className="mx-auto mt-2 h-1 w-28 rounded-full bg-white/20" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
