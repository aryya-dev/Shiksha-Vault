import React, { useState, useEffect } from 'react'
import { X, HardDrive, Video, FileText, CheckCircle2, RefreshCw } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatUserError } from '../lib/errorHandler'
import type { FileItem } from '../types/database'

interface AddDriveLinkModalProps {
  isOpen: boolean
  onClose: () => void
  currentFolderId: string
  folderName: string
  targetFileToReplace?: FileItem | null
  nextSortOrder?: number
  onFileAdded: (newFile: FileItem) => void
  onFileUpdated?: (updatedFile: FileItem) => void
}

export const AddDriveLinkModal: React.FC<AddDriveLinkModalProps> = ({
  isOpen,
  onClose,
  currentFolderId,
  folderName,
  targetFileToReplace,
  nextSortOrder = 1,
  onFileAdded,
  onFileUpdated
}) => {
  const [driveUrl, setDriveUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState<'video/mp4' | 'application/pdf'>('video/mp4')
  const [sizeMb, setSizeMb] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [extractedId, setExtractedId] = useState('')

  useEffect(() => {
    if (targetFileToReplace) {
      setFileName(targetFileToReplace.name)
      setFileType(
        targetFileToReplace.file_type.toLowerCase().startsWith('video')
          ? 'video/mp4'
          : 'application/pdf'
      )
      if (targetFileToReplace.gdrive_file_id) {
        setDriveUrl(`https://drive.google.com/file/d/${targetFileToReplace.gdrive_file_id}/view`)
        setExtractedId(targetFileToReplace.gdrive_file_id)
      } else {
        setDriveUrl('')
        setExtractedId('')
      }
      if (targetFileToReplace.file_size_bytes) {
        setSizeMb((targetFileToReplace.file_size_bytes / (1024 * 1024)).toFixed(1))
      } else {
        setSizeMb('')
      }
    } else {
      setDriveUrl('')
      setFileName('')
      setFileType('video/mp4')
      setSizeMb('')
      setExtractedId('')
    }
  }, [targetFileToReplace, isOpen])

  if (!isOpen) return null

  // Extract Google Drive File ID from standard Drive URL formats
  const extractDriveId = (input: string): string => {
    const trimmed = input.trim()
    // Pattern 1: /file/d/{id}
    const matchD = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
    if (matchD) return matchD[1]

    // Pattern 2: id={id}
    const matchId = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    if (matchId) return matchId[1]

    // Pattern 3: raw file ID (alphanumeric + _ - with length >= 20)
    if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed

    return ''
  }

  const handleUrlChange = (val: string) => {
    setDriveUrl(val)
    const id = extractDriveId(val)
    setExtractedId(id)

    // Suggest auto title if file name is still empty
    if (!fileName && id) {
      if (val.toLowerCase().includes('pdf')) {
        setFileType('application/pdf')
      } else {
        setFileType('video/mp4')
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = extractDriveId(driveUrl)
    if (!id) {
      alert('Please enter a valid Google Drive file link or File ID.')
      return
    }
    if (!fileName.trim()) {
      alert('Please enter a display name for this material.')
      return
    }

    setIsSubmitting(true)
    const sizeBytes = sizeMb ? Math.round(parseFloat(sizeMb) * 1024 * 1024) : null

    try {
      if (targetFileToReplace) {
        // REPLACE / BUMP VERSION
        const nextVersion = targetFileToReplace.version + 1

        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('files')
            .update({
              name: fileName.trim(),
              storage_path: `gdrive:${id}`,
              storage_provider: 'gdrive',
              gdrive_file_id: id,
              version: nextVersion,
              file_size_bytes: sizeBytes,
              file_type: fileType,
              updated_at: new Date().toISOString()
            })
            .eq('id', targetFileToReplace.id)
            .select()
            .single()

          if (error) throw error
          if (data && onFileUpdated) onFileUpdated(data)
        } else {
          const updated: FileItem = {
            ...targetFileToReplace,
            name: fileName.trim(),
            storage_path: `gdrive:${id}`,
            storage_provider: 'gdrive',
            gdrive_file_id: id,
            version: nextVersion,
            file_size_bytes: sizeBytes,
            file_type: fileType,
            updated_at: new Date().toISOString()
          }
          if (onFileUpdated) onFileUpdated(updated)
        }
      } else {
        // CREATE NEW FILE IN FOLDER
        if (isSupabaseConfigured()) {
          const { data, error } = await supabase
            .from('files')
            .insert({
              folder_id: currentFolderId,
              name: fileName.trim(),
              storage_path: `gdrive:${id}`,
              storage_provider: 'gdrive',
              gdrive_file_id: id,
              version: 1,
              file_size_bytes: sizeBytes,
              file_type: fileType,
              sort_order: nextSortOrder,
              is_deleted: false
            })
            .select()
            .single()

          if (error) throw error
          if (data) onFileAdded(data)
        } else {
          const mockFile: FileItem = {
            id: `file-gdrive-${Date.now()}`,
            folder_id: currentFolderId,
            name: fileName.trim(),
            storage_path: `gdrive:${id}`,
            storage_provider: 'gdrive',
            gdrive_file_id: id,
            version: 1,
            uploaded_by: null,
            file_size_bytes: sizeBytes,
            file_type: fileType,
            uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false
          }
          onFileAdded(mockFile)
        }
      }

      setDriveUrl('')
      setFileName('')
      setSizeMb('')
      setExtractedId('')
      onClose()
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to save Google Drive material'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '520px',
          maxWidth: '100%',
          backgroundColor: '#1A1A1D',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          padding: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60A5FA'
              }}
            >
              {targetFileToReplace ? <RefreshCw size={20} /> : <HardDrive size={20} />}
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {targetFileToReplace ? 'Update / Replace Material Link' : 'Link from Google Drive'}
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {targetFileToReplace
                  ? `Updating version v${targetFileToReplace.version} → v${targetFileToReplace.version + 1}`
                  : `Folder: ${folderName}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Drive URL or ID Input */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Google Drive Share Link or File ID *
            </label>
            <input
              type="text"
              placeholder="e.g. https://drive.google.com/file/d/1BxiMVs0XRA5n.../view"
              className="input-field"
              value={driveUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              required
              autoFocus
            />
            {extractedId && (
              <div
                style={{
                  marginTop: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--success)'
                }}
              >
                <CheckCircle2 size={14} />
                <span>Detected File ID: {extractedId.slice(0, 12)}...{extractedId.slice(-6)}</span>
              </div>
            )}
          </div>

          {/* Material Title */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Display Title *
            </label>
            <input
              type="text"
              placeholder="e.g. 26th August 2026 Biology Class Recording"
              className="input-field"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              required
            />
          </div>

          {/* Format Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Material Format
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setFileType('video/mp4')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: fileType === 'video/mp4' ? '2px solid #A855F7' : '1px solid var(--border)',
                  backgroundColor: fileType === 'video/mp4' ? 'rgba(168, 85, 247, 0.12)' : 'var(--surface-raised)',
                  color: fileType === 'video/mp4' ? '#C084FC' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                <Video size={16} />
                MP4 Lecture Video
              </button>

              <button
                type="button"
                onClick={() => setFileType('application/pdf')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: fileType === 'application/pdf' ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
                  backgroundColor: fileType === 'application/pdf' ? 'rgba(255, 179, 0, 0.12)' : 'var(--surface-raised)',
                  color: fileType === 'application/pdf' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                <FileText size={16} />
                PDF Document
              </button>
            </div>
          </div>

          {/* Optional File Size */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Approximate File Size (MB) <span style={{ color: 'var(--text-muted)' }}>(Optional)</span>
            </label>
            <input
              type="number"
              step="0.1"
              placeholder="e.g. 241.6"
              className="input-field"
              value={sizeMb}
              onChange={(e) => setSizeMb(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting || !extractedId || !fileName.trim()}>
              {isSubmitting
                ? 'Saving...'
                : targetFileToReplace
                ? 'Update Version'
                : 'Add Material to Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
