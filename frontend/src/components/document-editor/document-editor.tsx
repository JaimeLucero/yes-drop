'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import SignaturePad from 'signature_pad'
import { format } from 'date-fns'
import { PenLine, Type, CalendarDays, X, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { uploadResponseDocument } from '@/lib/api'

// pdfjs worker (matches installed pdfjs-dist version)
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const RENDER_W = 680

type ItemType = 'sig' | 'sigtext' | 'text' | 'date'
interface Item {
  id: string
  type: ItemType
  page: number
  xPx: number
  yPx: number
  wPx?: number
  hPx?: number
  img?: string
  text?: string
  fontPx?: number
}

interface DocumentEditorProps {
  fileUrl: string
  token: string
  onAttached: (url: string) => void
  onClose: () => void
}

let idCounter = 0
const nextId = () => `i${++idCounter}`

export default function DocumentEditor({ fileUrl, token, onAttached, onClose }: DocumentEditorProps) {
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [items, setItems] = useState<Item[]>([])
  const [signerName, setSignerName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sigOpen, setSigOpen] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ id: string; offX: number; offY: number } | null>(null)

  const pageItems = items.filter((i) => i.page === pageNumber)

  function addItem(partial: Omit<Item, 'id' | 'page' | 'xPx' | 'yPx'>) {
    setItems((prev) => [
      ...prev,
      { id: nextId(), page: pageNumber, xPx: 60, yPx: 80, ...partial },
    ])
  }

  function addSignatureImage(dataUrl: string) {
    const img = new Image()
    img.onload = () => {
      const w = 180
      const h = Math.max(40, Math.round((img.height / img.width) * w))
      setItems((prev) => [
        ...prev,
        { id: nextId(), type: 'sig', page: pageNumber, xPx: 60, yPx: 80, img: dataUrl, wPx: w, hPx: h },
      ])
    }
    img.src = dataUrl
  }

  function addTypedSignature(text: string) {
    addItem({ type: 'sigtext', text, fontPx: 30 })
  }

  function addText() {
    const t = prompt('Text to add')
    if (t && t.trim()) addItem({ type: 'text', text: t.trim(), fontPx: 16 })
  }

  function addDate() {
    addItem({ type: 'date', text: format(new Date(), 'PP'), fontPx: 16 })
  }

  function onPointerDownItem(e: React.PointerEvent, it: Item) {
    e.preventDefault()
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    drag.current = { id: it.id, offX: e.clientX - rect.left - it.xPx, offY: e.clientY - rect.top - it.yPx }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = Math.max(0, e.clientX - rect.left - drag.current.offX)
    const y = Math.max(0, e.clientY - rect.top - drag.current.offY)
    const id = drag.current.id
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, xPx: x, yPx: y } : i)))
  }
  function onPointerUp() {
    drag.current = null
  }

  async function apply() {
    if (!items.length) {
      setError('Add a signature or text first.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const bytes = await fetch(fileUrl).then((r) => r.arrayBuffer())
      const pdfDoc = await PDFDocument.load(bytes)
      const helv = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const obl = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
      const pages = pdfDoc.getPages()
      for (const it of items) {
        const page = pages[it.page - 1]
        if (!page) continue
        const { width: pw, height: ph } = page.getSize()
        const scale = RENDER_W / pw
        const xPt = it.xPx / scale
        if (it.type === 'sig' && it.img) {
          const png = await pdfDoc.embedPng(it.img)
          const wPt = (it.wPx ?? 180) / scale
          const hPt = (it.hPx ?? 60) / scale
          const yPt = ph - it.yPx / scale - hPt
          page.drawImage(png, { x: xPt, y: yPt, width: wPt, height: hPt })
        } else if (it.text) {
          const sizePt = (it.fontPx ?? 16) / scale
          const yPt = ph - it.yPx / scale - sizePt
          page.drawText(it.text, {
            x: xPt,
            y: yPt,
            size: sizePt,
            font: it.type === 'sigtext' ? obl : helv,
            color: rgb(0.1, 0.12, 0.18),
          })
        }
      }
      const out = await pdfDoc.save()
      const blob = new Blob([out as BlobPart], { type: 'application/pdf' })
      const { response_file_url } = await uploadResponseDocument(token, blob, signerName || undefined)
      onAttached(response_file_url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign the document')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="font-heading text-sm font-semibold text-foreground">Sign &amp; edit document</span>
        <div className="ml-2 flex items-center gap-1">
          <button onClick={() => setSigOpen(true)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
            <PenLine className="h-4 w-4" /> Signature
          </button>
          <button onClick={addText} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
            <Type className="h-4 w-4" /> Text
          </button>
          <button onClick={addDate} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-muted">
            <CalendarDays className="h-4 w-4" /> Date
          </button>
        </div>
        <input
          value={signerName}
          onChange={(e) => setSignerName(e.target.value)}
          placeholder="Your name (optional)"
          className="ml-auto w-44 rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
        />
        <button
          onClick={apply}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> {busy ? 'Saving…' : 'Apply & attach'}
        </button>
        <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && <p className="bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-950/30">{error}</p>}

      {/* Page nav */}
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-b border-border py-2 text-sm">
          <button onClick={() => setPageNumber((p) => Math.max(1, p - 1))} disabled={pageNumber <= 1} className="rounded p-1 hover:bg-muted disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-muted-foreground">Page {pageNumber} / {numPages}</span>
          <button onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages} className="rounded p-1 hover:bg-muted disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-muted/40 p-4">
        <div className="mx-auto" style={{ width: RENDER_W }}>
          <div
            ref={wrapRef}
            className="relative shadow-sm"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{ width: RENDER_W }}
          >
            <Document file={fileUrl} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<p className="p-8 text-center text-sm text-muted-foreground">Loading…</p>}>
              <Page pageNumber={pageNumber} width={RENDER_W} renderTextLayer={false} renderAnnotationLayer={false} />
            </Document>
            {pageItems.map((it) => (
              <div
                key={it.id}
                onPointerDown={(e) => onPointerDownItem(e, it)}
                onDoubleClick={() => setItems((prev) => prev.filter((x) => x.id !== it.id))}
                title="Drag to position · double-click to remove"
                className="absolute cursor-move select-none rounded ring-1 ring-primary/40 hover:ring-primary"
                style={{ left: it.xPx, top: it.yPx, touchAction: 'none' }}
              >
                {it.type === 'sig' && it.img ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.img} alt="signature" width={it.wPx} height={it.hPx} draggable={false} />
                ) : (
                  <span
                    style={{
                      fontSize: it.fontPx,
                      fontFamily: it.type === 'sigtext' ? 'cursive' : 'inherit',
                      color: '#1b1f2a',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {it.text}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {sigOpen && (
        <SignatureModal
          onClose={() => setSigOpen(false)}
          onDraw={(d) => {
            addSignatureImage(d)
            setSigOpen(false)
          }}
          onType={(t) => {
            addTypedSignature(t)
            setSigOpen(false)
          }}
        />
      )}
    </div>
  )
}

function SignatureModal({
  onClose,
  onDraw,
  onType,
}: {
  onClose: () => void
  onDraw: (dataUrl: string) => void
  onType: (text: string) => void
}) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw')
  const [typed, setTyped] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)

  useEffect(() => {
    if (mode !== 'draw' || !canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = 460
    canvas.height = 180
    const pad = new SignaturePad(canvas, { penColor: '#1b1f2a' })
    padRef.current = pad
    return () => pad.off()
  }, [mode])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-foreground">Add your signature</h2>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-3 inline-flex rounded-lg border border-border p-0.5 text-sm">
          <button onClick={() => setMode('draw')} className={`rounded-md px-3 py-1 ${mode === 'draw' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Draw</button>
          <button onClick={() => setMode('type')} className={`rounded-md px-3 py-1 ${mode === 'type' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>Type</button>
        </div>

        {mode === 'draw' ? (
          <div>
            <canvas ref={canvasRef} className="w-full rounded-lg border border-border bg-white" style={{ touchAction: 'none' }} />
            <div className="mt-3 flex justify-between">
              <button onClick={() => padRef.current?.clear()} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted">Clear</button>
              <button
                onClick={() => {
                  const pad = padRef.current
                  if (!pad || pad.isEmpty()) return
                  onDraw(pad.toDataURL('image/png'))
                }}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Add signature
              </button>
            </div>
          </div>
        ) : (
          <div>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Type your name"
              className="w-full rounded-lg border border-border bg-card px-3 py-2 focus:border-primary focus:outline-none"
              style={{ fontFamily: 'cursive', fontSize: 24 }}
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => typed.trim() && onType(typed.trim())}
                disabled={!typed.trim()}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                Add signature
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
