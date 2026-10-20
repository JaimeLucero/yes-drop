'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAiSettings, fetchAiModels, fetchAiSettings, saveAiSettings, type AiProvider } from '@/lib/api'

const PROVIDER_OPTIONS: { provider: AiProvider; label: string; getKeyUrl: string }[] = [
  { provider: 'gemini', label: 'Google Gemini', getKeyUrl: 'https://aistudio.google.com/apikey' },
  { provider: 'anthropic', label: 'Anthropic Claude', getKeyUrl: 'https://platform.claude.com/docs/en/get-api-key' },
  { provider: 'openai', label: 'OpenAI', getKeyUrl: 'https://platform.openai.com/api-keys' },
]

const AI_SETTINGS_QUERY_KEY = ['ai-settings']

function labelForProvider(provider: AiProvider | null): string {
  return PROVIDER_OPTIONS.find((option) => option.provider === provider)?.label ?? 'AI provider'
}

/**
 * Bring-your-own-key AI setup for the settings page. The key is write-only: it is never shown again.
 * A model can only be chosen after the provider has accepted the key, from the models that key can use.
 */
export function AiProviderCard() {
  const queryClient = useQueryClient()
  const { data: aiSettings, isLoading } = useQuery({ queryKey: AI_SETTINGS_QUERY_KEY, queryFn: fetchAiSettings })
  const [provider, setProvider] = useState<AiProvider>('gemini')
  const [apiKey, setApiKey] = useState('')
  const [verifiedModels, setVerifiedModels] = useState<string[] | null>(null)
  const [model, setModel] = useState('')

  function resetVerification() {
    setVerifiedModels(null)
    setModel('')
  }

  const verifyMutation = useMutation({
    mutationFn: () => fetchAiModels(provider, apiKey.trim()),
    onSuccess: (models) => {
      setVerifiedModels(models)
      setModel(models[0] ?? '')
    },
    onError: (error) => {
      resetVerification()
      toast.error(error instanceof Error ? error.message : 'Could not verify the key')
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => saveAiSettings({ provider, model, api_key: apiKey.trim() }),
    onSuccess: async () => {
      setApiKey('')
      resetVerification()
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
    resetVerification()
  }

  function handleApiKeyChange(nextApiKey: string) {
    setApiKey(nextApiKey)
    resetVerification()
  }

  const selectedOption = PROVIDER_OPTIONS.find((option) => option.provider === provider) ?? PROVIDER_OPTIONS[0]
  const isVerified = verifiedModels !== null
  const hasNoUsableModels = isVerified && verifiedModels.length === 0
  const canVerify = !verifyMutation.isPending && apiKey.trim().length > 0
  const canSave = !saveMutation.isPending && isVerified && model.length > 0

  return (
    <section aria-labelledby="ai-provider-heading" className="rounded-xl border border-border bg-card p-5">
      <h2 id="ai-provider-heading" className="font-heading text-lg font-semibold text-foreground">
        AI provider
      </h2>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">
        Choose which AI writes your drafts. YesDrop has no AI account of its own, so you connect yours.
      </p>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <KeyRound className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Compose with AI</p>
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
          API key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => handleApiKeyChange(event.target.value)}
            placeholder={aiSettings?.configured ? 'Paste a new key to replace the saved one' : 'Paste your API key'}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </label>
        <a
          href={selectedOption.getKeyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs text-primary underline"
        >
          Get your {selectedOption.label} API key
        </a>
        <div className="flex items-center gap-3">
          <button
            onClick={() => verifyMutation.mutate()}
            disabled={!canVerify}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {verifyMutation.isPending ? 'Verifying…' : 'Verify key'}
          </button>
          {isVerified && !hasNoUsableModels && (
            <p className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              Key verified. {verifiedModels.length} recent models available.
            </p>
          )}
          {hasNoUsableModels && (
            <p className="text-sm text-amber-600">This key has no models available for text generation.</p>
          )}
        </div>
        <label className="block text-xs text-muted-foreground">
          Model
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={!isVerified || hasNoUsableModels}
            className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground disabled:opacity-50"
          >
            {!isVerified && <option value="">Verify your key to choose a model</option>}
            {verifiedModels?.map((verifiedModel) => (
              <option key={verifiedModel} value={verifiedModel}>
                {verifiedModel}
              </option>
            ))}
          </select>
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
    </section>
  )
}
