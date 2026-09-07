import React, { useState, useEffect, useCallback } from 'react'
import { Header } from '../components/Header'
import { 
  Trash2, 
  RotateCcw, 
  FileText, 
  Folder as FolderIcon, 
  RefreshCw, 
  Sparkles
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatUserError } from '../lib/errorHandler'
import type { Folder, FileItem } from '../types/database'

interface DeletedFolder extends Folder {
  batches?: { name: string } | null
  subjects?: { name: string } | null
}

interface DeletedFile extends FileItem {
  folders?: { name: string; batch_id?: string; subject_id?: string } | null
}

export const TrashPage: React.FC = () => {
  const [deletedFolders, setDeletedFolders] = useState<DeletedFolder[]>([])
  const [deletedFiles, setDeletedFiles] = useState<DeletedFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const fetchTrash = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      return
    }

    setIsLoading(true)
    try {
      // 1. Fetch soft-deleted folders with associated batch and subject metadata
      const { data: fData, error: fErr } = await supabase
        .from('folders')
        .select('*, batches(name), subjects(name)')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false })

      if (fErr) throw fErr

      // 2. Fetch soft-deleted files with folder metadata
      const { data: fileData, error: fileErr } = await supabase
        .from('files')
        .select('*, folders(name, batch_id, subject_id)')
        .eq('is_deleted', true)
        .order('updated_at', { ascending: false })

      if (fileErr) throw fileErr

      setDeletedFolders((fData as DeletedFolder[]) || [])
      setDeletedFiles((fileData as DeletedFile[]) || [])
    } catch (err: any) {
      console.error('[TrashPage] Fetch error:', err)
      alert(formatUserError(err, 'Failed to load trash'))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTrash()
  }, [fetchTrash])

  const formatBytes = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  // Restore folder (and reactivate any nested files)
  const handleRestoreFolder = async (folder: DeletedFolder) => {
    setActionLoadingId(folder.id)
    try {
      if (isSupabaseConfigured()) {
        const { error: fErr } = await supabase
          .from('folders')
          .update({ is_deleted: false })
          .eq('id', folder.id)

        if (fErr) throw fErr

        // Also restore files inside this folder
        await supabase
          .from('files')
          .update({ is_deleted: false })
          .eq('folder_id', folder.id)
      }

      alert(`Folder "${folder.name}" and its documents were restored successfully.`)
      await fetchTrash()
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to restore folder'))
    } finally {
      setActionLoadingId(null)
    }
  }

  // Restore file
  const handleRestoreFile = async (file: DeletedFile) => {
    setActionLoadingId(file.id)
    try {
      if (isSupabaseConfigured()) {
        // Also ensure parent folder is restored if it was deleted
        if (file.folder_id) {
          await supabase
            .from('folders')
            .update({ is_deleted: false })
            .eq('id', file.folder_id)
        }

        const { error } = await supabase
          .from('files')
          .update({ is_deleted: false })
          .eq('id', file.id)

        if (error) throw error
      }

      alert(`File "${file.name}" was restored successfully.`)
      await fetchTrash()
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to restore file'))
    } finally {
      setActionLoadingId(null)
    }
  }

  // Purge single file permanently (both storage binary and database row)
  const handlePurgeFile = async (file: DeletedFile) => {
    if (!confirm(`Permanently delete "${file.name}"? This action cannot be undone and will purge the file from cloud storage.`)) {
      return
    }

    setActionLoadingId(file.id)
    try {
      if (isSupabaseConfigured()) {
        // 1. Delete physical PDF binary from Supabase Storage
        if (file.storage_path) {
          await supabase.storage
            .from('course-materials')
            .remove([file.storage_path])
        }

        // 2. Delete database row
        const { error } = await supabase
          .from('files')
          .delete()
          .eq('id', file.id)

        if (error) throw error
      }

      alert(`"${file.name}" was permanently deleted.`)
      await fetchTrash()
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to purge file'))
    } finally {
      setActionLoadingId(null)
    }
  }

  // Purge single folder permanently (and its files)
  const handlePurgeFolder = async (folder: DeletedFolder) => {
    if (!confirm(`Permanently delete folder "${folder.name}" and all its documents? This action cannot be undone.`)) {
      return
    }

    setActionLoadingId(folder.id)
    try {
      if (isSupabaseConfigured()) {
        // 1. Gather all files in this folder to clean up storage
        const { data: folderFiles } = await supabase
          .from('files')
          .select('storage_path')
          .eq('folder_id', folder.id)

        const paths = (folderFiles || [])
          .map((f) => f.storage_path)
          .filter(Boolean) as string[]

        if (paths.length > 0) {
          await supabase.storage.from('course-materials').remove(paths)
        }

        // 2. Delete files rows
        await supabase.from('files').delete().eq('folder_id', folder.id)

        // 3. Delete folder row
        const { error } = await supabase.from('folders').delete().eq('id', folder.id)
        if (error) throw error
      }

      alert(`Folder "${folder.name}" and all contents were permanently purged.`)
      await fetchTrash()
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to purge folder'))
    } finally {
      setActionLoadingId(null)
    }
  }

  // Empty Trash permanently
  const handlePermanentPurge = async () => {
    const totalCount = deletedFolders.length + deletedFiles.length
    if (!confirm(`Permanently purge all ${totalCount} item(s) in trash? This will remove all files from cloud storage and database permanently.`)) {
      return
    }

    setIsLoading(true)
    try {
      if (isSupabaseConfigured()) {
        // 1. Gather all storage paths from deleted files
        const storagePaths = deletedFiles
          .map((f) => f.storage_path)
          .filter(Boolean) as string[]

        if (storagePaths.length > 0) {
          await supabase.storage.from('course-materials').remove(storagePaths)
        }

        // 2. Delete all soft-deleted files
        const { error: filesErr } = await supabase
          .from('files')
          .delete()
          .eq('is_deleted', true)

        if (filesErr) throw filesErr

        // 3. Delete all soft-deleted folders
        const { error: foldersErr } = await supabase
          .from('folders')
          .delete()
          .eq('is_deleted', true)

        if (foldersErr) throw foldersErr
      }

      alert('Trash emptied permanently.')
      await fetchTrash()
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to empty trash'))
    } finally {
      setIsLoading(false)
    }
  }

  const totalItems = deletedFolders.length + deletedFiles.length

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Trash & Content Recovery"
        subtitle="Review soft-deleted folders and files. Restore items back to active courses or purge permanently."
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button 
              className="btn-secondary" 
              onClick={fetchTrash}
              disabled={isLoading}
              title="Refresh Trash"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            {totalItems > 0 && (
              <button 
                className="btn-danger" 
                onClick={handlePermanentPurge}
                disabled={isLoading}
              >
                <Trash2 size={16} />
                Empty Trash ({totalItems})
              </button>
            )}
          </div>
        }
      />

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {isLoading && totalItems === 0 ? (
          <div
            className="card"
            style={{
              padding: '60px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <RefreshCw size={36} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              Checking trash and recoverable items...
            </p>
          </div>
        ) : totalItems === 0 ? (
          <div
            className="card"
            style={{
              padding: '60px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--success)'
              }}
            >
              <Sparkles size={32} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Trash is Clean & Empty</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px' }}>
              Any folders or documents you remove from Content Manager will be safely stored here for recovery before permanent purging.
            </p>
          </div>
        ) : (
          <>
            {/* Soft-Deleted Folders */}
            {deletedFolders.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    SOFT-DELETED FOLDERS ({deletedFolders.length})
                  </h4>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="table-container">
                    <thead>
                      <tr>
                        <th style={{ width: '45%' }}>Folder Name</th>
                        <th style={{ width: '25%' }}>Batch & Subject</th>
                        <th style={{ width: '15%' }}>Deleted Date</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedFolders.map((f) => {
                        const isActing = actionLoadingId === f.id
                        return (
                          <tr key={f.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FolderIcon size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                                <div>
                                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{f.name}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span className="badge" style={{ backgroundColor: 'var(--surface-raised)', fontSize: '11px' }}>
                                  {f.batches?.name || 'All Batches'}
                                </span>
                                {f.subjects?.name && (
                                  <span className="badge" style={{ backgroundColor: 'var(--surface-raised)', fontSize: '11px' }}>
                                    {f.subjects.name}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              {new Date(f.updated_at).toLocaleDateString(undefined, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => handleRestoreFolder(f)}
                                  disabled={isActing}
                                  title="Restore folder and contained documents"
                                >
                                  <RotateCcw size={13} />
                                  Restore
                                </button>
                                <button
                                  className="btn-danger"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  onClick={() => handlePurgeFolder(f)}
                                  disabled={isActing}
                                  title="Permanently Purge"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Soft-Deleted Files */}
            {deletedFiles.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                    SOFT-DELETED DOCUMENTS ({deletedFiles.length})
                  </h4>
                </div>
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="table-container">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Document Name</th>
                        <th style={{ width: '20%' }}>Parent Folder</th>
                        <th style={{ width: '10%' }}>Size</th>
                        <th style={{ width: '15%' }}>Deleted Date</th>
                        <th style={{ width: '15%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deletedFiles.map((file) => {
                        const isActing = actionLoadingId === file.id
                        return (
                          <tr key={file.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <FileText size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{file.name}</div>
                                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    v{file.version} • {file.storage_path ? file.storage_path.split('/').pop() : ''}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="badge" style={{ backgroundColor: 'var(--surface-raised)', fontSize: '11px' }}>
                                {file.folders?.name || 'Folder Root'}
                              </span>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {formatBytes(file.file_size_bytes)}
                            </td>
                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              {new Date(file.updated_at).toLocaleDateString(undefined, {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '6px 12px', fontSize: '12px' }}
                                  onClick={() => handleRestoreFile(file)}
                                  disabled={isActing}
                                  title="Restore document"
                                >
                                  <RotateCcw size={13} />
                                  Restore
                                </button>
                                <button
                                  className="btn-danger"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  onClick={() => handlePurgeFile(file)}
                                  disabled={isActing}
                                  title="Permanently Purge"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
