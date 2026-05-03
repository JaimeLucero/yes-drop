'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createRequest, uploadFile } from '@/lib/api'
import { Upload, ChevronLeft, AlertCircle, File, CheckCircle, Moon, Sun } from 'lucide-react'

export default function NewRequestPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [approverEmail, setApproverEmail] = useState('')
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [isDark, setIsDark] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    const newDarkState = !isDark
    setIsDark(newDarkState)

    if (newDarkState) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  const mutation = useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      router.push('/dashboard')
    },
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    await uploadFileHandler(selectedFile)
  }

  const uploadFileHandler = async (selectedFile: File) => {
    setUploading(true)
    try {
      const url = await uploadFile(selectedFile)
      setFileUrl(url)
      setFile(selectedFile)
    } catch (err) {
      console.error('Upload failed:', err)
    } finally {
      setUploading(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => {
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      await uploadFileHandler(droppedFile)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      approver_email: approverEmail,
      title,
      message: message || undefined,
      file_url: fileUrl || undefined,
    })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-white dark:bg-card sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 font-semibold group"
            >
              <ChevronLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 hover:bg-secondary rounded-lg transition-colors text-foreground"
              aria-label="Toggle theme"
            >
              {mounted && isDark ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Create Request</h1>
            <p className="text-foreground/60 mt-1">Send an approval request in seconds</p>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Approver Email */}
          <div className="group">
            <label htmlFor="approver_email" className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Approver Email <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                id="approver_email"
                type="email"
                value={approverEmail}
                onChange={(e) => setApproverEmail(e.target.value)}
                placeholder="approver@example.com"
                required
                className="w-full px-5 py-3 bg-background border-2 border-border rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <p className="text-xs text-foreground/50 mt-2">The email address of the person who needs to approve this request</p>
          </div>

          {/* Title */}
          <div className="group">
            <label htmlFor="title" className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Request Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Q3 2024 Budget Approval"
              required
              className="w-full px-5 py-3 bg-background border-2 border-border rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <p className="text-xs text-foreground/50 mt-2">A clear, concise title for this approval request</p>
          </div>

          {/* Message */}
          <div className="group">
            <label htmlFor="message" className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Message <span className="text-foreground/50 font-normal text-xs">(optional)</span>
            </label>
            <textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add any context or details that will help the approver make a decision..."
              rows={5}
              className="w-full px-5 py-3 bg-background border-2 border-border rounded-xl text-foreground placeholder:text-foreground/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
            <p className="text-xs text-foreground/50 mt-2">Provide context to help your approver make a decision</p>
          </div>

          {/* File Upload */}
          <div className="group">
            <label className="block text-sm font-heading font-semibold text-foreground mb-3 uppercase tracking-wide">
              Attachments <span className="text-foreground/50 font-normal text-xs">(optional)</span>
            </label>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all ${
                dragOver
                  ? 'border-primary bg-primary/10 scale-105'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-primary/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                disabled={uploading}
                className="hidden"
              />

              {!file && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="text-accent font-semibold hover:text-accent/80 transition-colors"
                    >
                      Click to upload
                    </button>
                    <span className="text-foreground/60 mx-2">or drag and drop</span>
                  </div>
                  <p className="text-xs text-foreground/50 font-medium">PNG, JPG, PDF, Excel, Word, or any file up to 10MB</p>
                </div>
              )}

              {uploading && (
                <div className="space-y-3">
                  <div className="flex justify-center">
                    <div className="inline-block animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full"></div>
                  </div>
                  <p className="text-sm text-foreground/60 font-medium">Uploading...</p>
                </div>
              )}

              {file && fileUrl && (
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <div className="p-4 bg-gradient-to-br from-emerald-100/50 to-emerald-50/50 dark:from-emerald-950/40 dark:to-emerald-950/20 rounded-xl">
                      <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{file.name}</p>
                    <p className="text-xs text-foreground/50 mt-2">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFile(null)
                      setFileUrl(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-sm text-primary hover:text-primary/80 transition-colors font-semibold"
                  >
                    Replace file
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {mutation.isError && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600 dark:text-red-400">{String(mutation.error)}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-8 border-t-2 border-border">
            <button
              type="submit"
              disabled={mutation.isPending || !approverEmail || !title}
              className="group inline-flex items-center justify-center px-8 py-3 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {mutation.isPending ? (
                <>
                  <div className="inline-block animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Creating...
                </>
              ) : (
                'Send Request'
              )}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="inline-flex items-center justify-center px-8 py-3 bg-secondary text-secondary-foreground font-semibold rounded-xl border border-border hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}