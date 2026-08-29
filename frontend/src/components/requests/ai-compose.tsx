'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { composeAutomation, type ComposeResult } from '@/lib/api'

const PLACEHOLDER =
  'e.g. Ask my CFO Jane (jane@acme.com) to approve the Q3 marketing budget by Friday, and remind her the day before if she hasn’t replied.'

/**
 * Natural-language "compose with AI" box. On success it hands the generated
 * automation to the parent via onApply, which prefills the editable form.
 * Nothing is sent here; the user reviews and submits the form themselves.
 */
export function AiComposeBox({ onApply }: { onApply: (result: ComposeResult) => void }) {
  const [prompt, setPrompt] = useState('')

  const mutation = useMutation({
    mutationFn: () => composeAutomation(prompt),
    onSuccess: (result) => {
      onApply(result)
      toast.success('Draft ready below. Review and edit before sending.')
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Could not compose the automation')
    },
  })

  const disabled = mutation.isPending || !prompt.trim()

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-5" data-tour="ai-compose">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-heading font-semibold text-foreground">Compose with AI</p>
          <p className="text-xs text-muted-foreground">
            Describe the approval in a sentence and let AI fill out the form.
          </p>
        </div>
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={3}
        disabled={mutation.isPending}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !disabled) mutation.mutate()
        }}
        className="w-full resize-none rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <div className="mt-3 flex items-center justify-between">
        <p className="text-xs text-foreground/50">You can edit everything after generating.</p>
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutation.isPending ? (
            <>
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              Composing…
            </>
          ) : (
            <>
              Compose
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
