import { useState, useRef } from 'react'
import { Download, Upload } from 'lucide-react'
import { api } from '@/api/client'
import { toast } from 'sonner'

export function BackupPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const handleExport = async () => {
    try {
      const blob = await api.exportBackup()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'quadlet-backup.tar.gz'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup exported')
    } catch (e: any) {
      toast.error(e.message || 'Export failed')
    }
  }

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setImporting(true)
    try {
      await api.importBackup(file)
      toast.success('Backup restored')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e: any) {
      toast.error(e.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">
        Backup & Restore
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-medium text-text-primary">Export Backup</h3>
          <p className="text-xs text-text-secondary">
            Download all quadlet files and settings as a tar.gz archive.
          </p>
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20">
            <Download size={14} /> Export
          </button>
        </div>

        <div className="border border-border rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-medium text-text-primary">Import Backup</h3>
          <p className="text-xs text-text-secondary">
            Restore quadlet files from a previously exported backup.
          </p>
          <input ref={fileRef} type="file" accept=".tar.gz,.tgz"
            className="hidden" onChange={handleImport} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 disabled:opacity-50">
            <Upload size={14} /> {importing ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  )
}
