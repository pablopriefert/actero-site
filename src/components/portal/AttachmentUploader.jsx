import { useCallback, useRef, useState } from 'react'
import { Paperclip, CheckCircle2, X, Loader2 } from 'lucide-react'

const MAX = 5
const MAX_SIZE = 5 * 1024 * 1024

/**
 * AttachmentUploader — drag-drop image upload for portal tickets.
 *
 * Public API preserved: `onChange(paths)` fires with the list of storage paths
 * after each successful upload. Endpoint unchanged: POST /api/portal/upload-attachment.
 *
 * UX:
 *  - Dropzone with dashed border + hover state, Paperclip icon, FR prompt.
 *  - Thumbnails grid (64×64) with Lucide CheckCircle2 overlay when uploaded.
 *  - Each thumb has an X remove button (visible ≥32px, 44px hitSlop via p-1.5).
 *  - Errors announced via role="alert" aria-live="polite".
 *  - Tailwind v4, portal cream palette (#F4F0E6), primary var(--portal-primary).
 */
export default function AttachmentUploader({ onChange }) {
  const inputRef = useRef(null)
  const [items, setItems] = useState([]) // [{ id, name, preview, path|null, uploading, error }]
  const [err, setErr] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const syncChange = useCallback((list) => {
    const paths = list.filter(i => i.path).map(i => i.path)
    onChange?.(paths)
  }, [onChange])

  const uploadOne = useCallback(async (item) => {
    try {
      // Read as data URL for the existing endpoint
      const dataUrl = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result)
        reader.onerror = () => rej(new Error('read-failed'))
        reader.readAsDataURL(item.file)
      })
      const resp = await fetch('/api/portal/upload-attachment', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data_url: dataUrl, filename: item.name }),
      })
      if (!resp.ok) throw new Error('upload-failed')
      const { path } = await resp.json()
      return { ...item, path, uploading: false, error: null }
    } catch (e) {
      return { ...item, uploading: false, error: 'Upload echoue' }
    }
  }, [])

  const handleFiles = useCallback(async (files) => {
    if (!files || !files.length) return
    setErr(null)

    // Cap at MAX
    const currentCount = items.length
    const accepted = []
    for (const file of files) {
      if (currentCount + accepted.length >= MAX) {
        setErr(`Maximum ${MAX} images autorisees`)
        break
      }
      if (!file.type.startsWith('image/')) {
        setErr(`"${file.name}" n'est pas une image`)
        continue
      }
      if (file.size > MAX_SIZE) {
        setErr(`"${file.name}" depasse 5 Mo`)
        continue
      }
      accepted.push(file)
    }

    if (!accepted.length) return

    // Optimistic insert with previews
    const newItems = accepted.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      preview: URL.createObjectURL(file),
      file,
      path: null,
      uploading: true,
      error: null,
    }))

    setItems(prev => {
      const next = [...prev, ...newItems]
      return next
    })

    // Upload sequentially (endpoint is small / keeps request count predictable)
    for (const item of newItems) {
      // eslint-disable-next-line no-await-in-loop
      const result = await uploadOne(item)
      setItems(prev => {
        const next = prev.map(i => (i.id === item.id ? result : i))
        syncChange(next)
        return next
      })
      if (result.error) setErr(result.error)
    }
  }, [items.length, syncChange, uploadOne])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer?.files?.length) {
      handleFiles([...e.dataTransfer.files])
    }
  }, [handleFiles])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }, [isDragging])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const removeItem = useCallback((id) => {
    setItems(prev => {
      const target = prev.find(i => i.id === id)
      if (target?.preview) {
        try { URL.revokeObjectURL(target.preview) } catch { /* noop */ }
      }
      const next = prev.filter(i => i.id !== id)
      syncChange(next)
      return next
    })
  }, [syncChange])

  const canAdd = items.length < MAX
  const primary = 'var(--portal-primary, #1F3A12)'

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-[#1F3A12]">
        Photos (optionnel, max {MAX} × 5 Mo)
      </label>

      {/* Dropzone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        disabled={!canAdd}
        aria-label={`Zone de dépôt, ${MAX} images max, 5 Mo chacune`}
        className={`w-full flex flex-col items-center justify-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed transition-colors ${
          isDragging
            ? 'border-[color:var(--portal-primary,#1F3A12)] bg-[#EAE3D1]'
            : 'border-[#C9BFA6] bg-[#F4F0E6] hover:border-[color:var(--portal-primary,#1F3A12)] hover:bg-[#EEE7D4]'
        } ${!canAdd ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <Paperclip className="w-6 h-6" style={{ color: primary }} aria-hidden="true" />
        <span className="text-sm font-medium" style={{ color: primary }}>
          Glisser vos images ou cliquer
        </span>
        <span className="text-xs text-[#5A5A5A]">
          {items.length}/{MAX} images
        </span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            handleFiles([...e.target.files])
            e.target.value = ''
          }}
        />
      </button>

      {/* Thumbnails grid */}
      {items.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Images à envoyer">
          {items.map(item => (
            <li key={item.id} className="relative">
              <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#C9BFA6] bg-[#F4F0E6]">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <img
                  src={item.preview}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
                {item.uploading && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-white animate-spin" aria-hidden="true" />
                  </div>
                )}
                {!item.uploading && item.path && (
                  <div className="absolute bottom-0.5 right-0.5 bg-white rounded-full p-0.5 shadow">
                    <CheckCircle2 className="w-3.5 h-3.5" style={{ color: primary }} aria-label="Envoi réussi" />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                aria-label={`Retirer ${item.name}`}
                className="absolute -top-2 -right-2 p-1.5 rounded-full bg-white border border-[#C9BFA6] shadow-sm hover:bg-red-50 hover:border-red-200 transition-colors"
                style={{ lineHeight: 0 }}
              >
                <X className="w-3.5 h-3.5 text-[#5A5A5A]" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Errors — SR-announced */}
      {err && (
        <p role="alert" aria-live="polite" className="text-xs text-red-600">
          {err}
        </p>
      )}
    </div>
  )
}
