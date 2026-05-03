'use client'

import { useState } from 'react'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Requests', color: 'bg-gray-500' },
  { value: 'draft', label: 'Drafts', color: 'bg-gray-400' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-500' },
  { value: 'pending', label: 'Sent', color: 'bg-amber-500' },
  { value: 'approved', label: 'Approved', color: 'bg-emerald-500' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-500' },
] as const

export type RequestStatusFilter = typeof STATUS_OPTIONS[number]['value']

interface RequestFiltersProps {
  onFilterChange?: (status: RequestStatusFilter) => void
}

export function RequestFilters({ onFilterChange }: RequestFiltersProps) {
  const [selected, setSelected] = useState<RequestStatusFilter>('all')

  const handleChange = (status: RequestStatusFilter) => {
    setSelected(status)
    onFilterChange?.(status)
  }

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {STATUS_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => handleChange(option.value)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            selected === option.value
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${option.color}`} />
          {option.label}
        </button>
      ))}
    </div>
  )
}
