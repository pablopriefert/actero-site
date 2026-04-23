import { useState } from 'react'

const MAX = 5
const MAX_SIZE = 5 * 1024 * 1024

export default function AttachmentUploader({ onChange }) {
  const [paths, setPaths] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function handleFiles(files) {
    if (paths.length + files.length > MAX) return setErr(`Max ${MAX} images`)
    setBusy(true); setErr(null)

    const newPaths = [...paths]
    for (const file of files) {
      if (file.size > MAX_SIZE) { setErr(`"${file.name}" depasse 5 Mo`); continue }
      if (!file.type.startsWith('image/')) { setErr(`"${file.name}" n'est pas une image`); continue }
      const dataUrl = await new Promise(r => {
        const reader = new FileReader()
        reader.onload = () => r(reader.result)
        reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/portal/upload-attachment', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data_url: dataUrl, filename: file.name }),
      })
      if (resp.ok) {
        const { path } = await resp.json()
        newPaths.push(path)
      } else {
        setErr('Upload echoue')
      }
    }
    setPaths(newPaths); onChange?.(newPaths); setBusy(false)
  }

  return (
    <div>
      <label className="block text-sm mb-2">Photos (optionnel, max 5 × 5 Mo)</label>
      <input type="file" multiple accept="image/*" disabled={busy}
        onChange={e => handleFiles([...e.target.files])}
        className="block text-sm" />
      {paths.length > 0 && (
        <ul className="mt-2 text-xs text-[#5A5A5A]">
          {paths.map(p => <li key={p}>✓ {p.split('/').pop()}</li>)}
        </ul>
      )}
      {err && <p className="text-red-600 text-xs mt-1">{err}</p>}
    </div>
  )
}
