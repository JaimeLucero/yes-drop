'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAiSettings, fetchAiSettings, saveAiSettings, type AiProvider } from '@/lib/api'

const PROVIDER_OPTIONS: { provider: AiProvider; label: string; defaultModel: string }[] = [
  { provider: 'gemini', label: 'Google Gemini', defaultModel: 'gemini-2.5-flash' },
  { provider: 'anthropic', label: 'Anthropic Claude', defaultModel: 'claude-haiku-5-5' },
  { provider: 'openai', label: 'OpenAI', defaultModel: 'gpt-4o-mini' },
]

const AI_SETTINGS_QUERY_KEY = ['ai-settings']

function labelForProvider(provider: AiProvider | null): string {
  return PROVIDER_OPTIONS.find((option) => option.provider === provider)?.label ?? 'AI provider'
}

/** Bring-your-own-key AI setup for the settings page. The key is write-only: it is never shown again. */
export function AiProviderCard() {
  const queryClient = useQueryClient()
  const { data: aiSettings, isLoading } = useQuery({ queryKey: AI_SETTINGS_QUERY_KEY, queryFn: fetchAiSettings })
  const [provider, setProvider] = useState<AiProvider>('gemini')
  const [model, setModel] = useState(PROVIDER_OPTIONS[0].defaultModel)
  const [apiKey, setApiKey] = useState('')

  const saveMutation = useMutation({
    mutationFn: () => saveAiSettings({ provider, model: model.trim(), api_key: apiKey.trim() }),
    onSuccess: async () => {
      setApiKey('')
      await queryClient.invalidateQueries({ queryKey: AI_SETTINGS_QUERY_KEY })
      toast.success('AI key saved.')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not save the AI key'),
  })

  const removeMutation = useMutation({
    mutationFn: deleteAiSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: AI_SETTINGS_QUERY_KEY })
      toast.success('AI key removed.')
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : 'Could not remove the AI key'),
  })

  function handleProviderChange(nextProvider: AiProvider) {
    setProvider(nextProvider)
    const nextOption = PROVIDER_OPTIONS.find((option) => option.provider === nextProvider)
    if (nextOption) setModel(nextOption.defaultModel)
  }

  const canSave = !saveMutation.isPending && apiKey.trim().length > 0 && model.trim().length > 0

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">AI compose</p>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Checking…</p>
          ) : aiSettings?.configured ? (
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              {labelForProvider(aiSettings.provider)} ({aiSettings.model})
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Add your own key to draft requests from a sentence.</p>
          )}
        </div>
        {aiSettings?.configured && (
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Remove key
          </button>
        )}
      </div>

      <div className="mt-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted-foreground">
            Provider
            <select
              value={provider}
              onChange={(event) => handleProviderChange(event.target.value as AiProvider)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            >
              {PROVIDER_OPTIONS.map((option) => (
                <option key={option.provider} value={option.provider}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            Model
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
        <label className="block text-xs text-muted-foreground">
          API key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={aiSettings?.configured ? 'Paste a new key to replace the saved one' : 'Paste your API key'}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Your key is encrypted and used only to run AI compose for you. Usage is billed to your own provider
          account. Emails, links and phone numbers are removed from your text before it is sent, but names are not,
          so avoid confidential details.
        </p>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={!canSave}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? 'Saving…' : aiSettings?.configured ? 'Replace key' : 'Save key'}
        </button>
      </div>
    </div>
  )
}
