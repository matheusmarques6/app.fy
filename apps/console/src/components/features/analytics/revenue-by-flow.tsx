'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { revenueByFlow } from '@/lib/mock-data'

export function RevenueByFlow() {
  const data = revenueByFlow.map((item) => ({
    ...item,
    revenueFormatted: item.revenue / 100,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Receita por Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <XAxis
                type="number"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 12 }}
                tickFormatter={(v: number) => `R$${v}`}
              />
              <YAxis
                type="category"
                dataKey="flow"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                width={140}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#121214',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  color: '#fff',
                }}
                formatter={(value: number) => [
                  `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  'Receita',
                ]}
              />
              <Bar dataKey="revenueFormatted" fill="#A855F7" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
