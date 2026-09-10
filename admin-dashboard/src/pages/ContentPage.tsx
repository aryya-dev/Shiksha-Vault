import React, { useState, useEffect, useRef } from 'react'
import { Header } from '../components/Header'
import { 
  Folder as FolderIcon, 
  FolderPlus, 
  FolderOpen,
  FileText, 
  Upload, 
  ChevronRight, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft,
  Trash2, 
  RefreshCw,
  Layers,
  Video,
  Image as ImageIcon
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatUserError } from '../lib/errorHandler'
import type { Subject, Folder, FileItem, Batch } from '../types/database'

export const ContentPage: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([])
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null)

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Modals & form state
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [replacingFile, setReplacingFile] = useState<FileItem | null>(null)

  const uploadInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // Fetch batches & subjects from Supabase if configured
  const loadDatabaseData = async () => {
    if (!isSupabaseConfigured()) {
      setBatches([])
      setFolders([])
      setFiles([])
      return
    }
    setIsLoading(true)
    try {
      const { data: bData } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: sData } = await supabase
        .from('subjects')
        .select('*')
        .order('name')

      const validBatches = bData || []
      setBatches(validBatches)
      if (validBatches.length > 0) {
        setSelectedBatch((prev) => (prev ? (validBatches.find((b) => b.id === prev.id) || validBatches[0]) : validBatches[0]))
      } else {
        setSelectedBatch(null)
      }

      // Filter out foundation-batch from regular subjects list (Foundation is a direct batch, not a subject)
      const validSubjects = (sData || []).filter(
        (s) => s.slug !== 'foundation-batch' && !s.name.toLowerCase().includes('foundation')
      )
      setSubjects(validSubjects)
      if (validSubjects.length > 0) {
        setSelectedSubject((prev) => (prev ? (validSubjects.find((s) => s.id === prev.id) || validSubjects[0]) : validSubjects[0]))
      } else {
        setSelectedSubject(null)
      }

      // Load folders and files
      const { data: fData } = await supabase
        .from('folders')
        .select('*')
        .eq('is_deleted', false)
        .order('sort_order', { ascending: true })

      if (fData) setFolders(fData)

      const { data: filesData } = await supabase
        .from('files')
        .select('*')
        .eq('is_deleted', false)

      if (filesData) setFiles(filesData)
    } catch (err) {
      console.error('Error fetching content data:', err)
      setBatches([])
      setFolders([])
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadDatabaseData()
  }, [])

  const isDirectBatch = Boolean(
    selectedBatch?.board === 'Foundation' || selectedBatch?.name.toLowerCase().includes('foundation')
  )

  // Filter folders: for direct batch (Foundation), matches batch and subject_id is null.
  // For regular batches, matches batch and selectedSubject.id.
  const currentFolders = folders.filter((f) => {
    if (!selectedBatch) return false
    const matchesBatch = f.batch_id === selectedBatch.id || (!f.batch_id && batches[0]?.id === selectedBatch.id)
    const matchesSubject = isDirectBatch
      ? (!f.subject_id)
      : (selectedSubject ? f.subject_id === selectedSubject.id : false)
    const matchesParent = f.parent_folder_id === currentFolderId
    return matchesBatch && matchesSubject && matchesParent && !f.is_deleted
  }).sort((a, b) => a.sort_order - b.sort_order)

  // Filter files in the currently opened folder
  const currentFiles = files.filter(
    (f) => f.folder_id === currentFolderId && !f.is_deleted
  )

  const activeFolder = folders.find((f) => f.id === currentFolderId)
  const parentOfActiveFolder = activeFolder?.parent_folder_id 
    ? folders.find((f) => f.id === activeFolder.parent_folder_id) 
    : null

  // Compute full recursive breadcrumb trail from root to currentFolderId
  const getBreadcrumbPath = (): Folder[] => {
    const path: Folder[] = []
    let curr = folders.find((f) => f.id === currentFolderId)
    while (curr) {
      path.unshift(curr)
      curr = folders.find((f) => f.id === curr?.parent_folder_id)
    }
    return path
  }
  const breadcrumbPath = getBreadcrumbPath()

  // Derive MIME type safely
  const deriveFileType = (file: File): string => {
    if (file.type && file.type !== '') return file.type
    const ext = file.name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'mp4': return 'video/mp4'
      case 'mov': return 'video/quicktime'
      case 'mkv': return 'video/x-matroska'
      case 'webm': return 'video/webm'
      case 'png': return 'image/png'
      case 'jpg':
      case 'jpeg': return 'image/jpeg'
      case 'webp': return 'image/webp'
      case 'gif': return 'image/gif'
      default: return 'application/pdf'
    }
  }

  // File size formatter
  const formatFileSize = (bytes: number | null | undefined): string => {
    if (!bytes || bytes <= 0) return '—'
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // Determine media icon, label, and style badge
  const getFileBadge = (file: FileItem) => {
    const type = (file.file_type || '').toLowerCase()
    const name = file.name.toLowerCase()

    if (type.startsWith('video/') || name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.mkv') || name.endsWith('.webm')) {
      return {
        icon: <Video size={16} style={{ color: '#A855F7', flexShrink: 0 }} />,
        badgeText: 'MP4 VIDEO',
        badgeStyle: {
          backgroundColor: 'rgba(168, 85, 247, 0.12)',
          color: '#C084FC',
          border: '1px solid rgba(168, 85, 247, 0.3)'
        }
      }
    }

    if (type.startsWith('image/') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || name.endsWith('.gif')) {
      return {
        icon: <ImageIcon size={16} style={{ color: '#10B981', flexShrink: 0 }} />,
        badgeText: 'IMAGE',
        badgeStyle: {
          backgroundColor: 'rgba(16, 185, 129, 0.12)',
          color: '#34D399',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }
      }
    }

    return {
      icon: <FileText size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />,
      badgeText: 'PDF',
      badgeStyle: {
        backgroundColor: 'rgba(255, 179, 0, 0.1)',
        color: 'var(--accent-primary)',
        border: '1px solid rgba(255, 179, 0, 0.3)'
      }
    }
  }

  // Create folder inside current batch, subject, and currentFolderId
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newFolderName.trim() || !selectedBatch) return
    if (!isDirectBatch && !selectedSubject) return

    const targetSubjectId = isDirectBatch ? null : (selectedSubject?.id || null)

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('folders')
          .insert({
            batch_id: selectedBatch.id,
            subject_id: targetSubjectId,
            name: newFolderName.trim(),
            parent_folder_id: currentFolderId,
            sort_order: currentFolders.length + 1,
            is_deleted: false
          })
          .select()
          .single()

        if (error) throw error
        if (data) setFolders([...folders, data])
      } catch (err: any) {
        alert(formatUserError(err, 'Error creating folder'))
      }
    } else {
      const newFolder: Folder = {
        id: `folder-${Date.now()}`,
        batch_id: selectedBatch.id,
        subject_id: targetSubjectId || '',
        name: newFolderName.trim(),
        parent_folder_id: currentFolderId,
        sort_order: currentFolders.length + 1,
        created_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_deleted: false,
        files_count: 0
      }
      setFolders([...folders, newFolder])
    }

    setNewFolderName('')
    setIsFolderModalOpen(false)
  }

  const handleSoftDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to move this folder, its subfolders, and all materials to trash?')) return

    try {
      if (isSupabaseConfigured()) {
        const { error: fErr } = await supabase.from('folders').update({ is_deleted: true }).eq('id', folderId)
        if (fErr) throw fErr
        await supabase.from('files').update({ is_deleted: true }).eq('folder_id', folderId)
      }
      setFolders(folders.filter((f) => f.id !== folderId))
      setFiles(files.filter((f) => f.folder_id !== folderId))
      if (currentFolderId === folderId) {
        setCurrentFolderId(activeFolder?.parent_folder_id || null)
      }
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to move folder to trash'))
    }
  }

  const handleSoftDeleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to move this material to trash?')) return

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.from('files').update({ is_deleted: true }).eq('id', fileId)
        if (error) throw error
      }
      setFiles(files.filter((f) => f.id !== fileId))
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to move file to trash'))
    }
  }

  const handleReorderFolder = (folderId: string, direction: 'up' | 'down') => {
    const index = currentFolders.findIndex((f) => f.id === folderId)
    if (index === -1) return
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === currentFolders.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const reordered = [...currentFolders]
    const temp = reordered[index]
    reordered[index] = reordered[targetIndex]
    reordered[targetIndex] = temp

    // Update sort_order properties
    const updated = folders.map((f) => {
      const matchIndex = reordered.findIndex((r) => r.id === f.id)
      if (matchIndex !== -1) {
        return { ...f, sort_order: matchIndex + 1 }
      }
      return f
    })

    setFolders(updated)
  }

  // Multi-format file upload (PDF, MP4, Images)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files
    if (!uploadedFiles || uploadedFiles.length === 0 || !currentFolderId || !selectedBatch) return
    if (!isDirectBatch && !selectedSubject) return

    setIsLoading(true)
    try {
      const newFiles: FileItem[] = []

      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i]
        const fileType = deriveFileType(file)
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const subjectFolderSegment = isDirectBatch ? 'foundation' : (selectedSubject?.slug || 'general')
        const storagePath = `${selectedBatch.id}/${subjectFolderSegment}/${currentFolderId}/${Date.now()}-${sanitizedFileName}`

        if (isSupabaseConfigured()) {
          // 1. Upload binary file to Supabase Storage 'course-materials'
          const { error: storageError } = await supabase.storage
            .from('course-materials')
            .upload(storagePath, file, {
              cacheControl: '3600',
              upsert: false,
              contentType: fileType
            })

          if (storageError) {
            console.error('Storage upload error:', storageError)
            throw storageError
          }

          // 2. Insert metadata record in public.files
          const { data, error: dbError } = await supabase
            .from('files')
            .insert({
              folder_id: currentFolderId,
              name: file.name,
              storage_path: storagePath,
              version: 1,
              file_size_bytes: file.size,
              file_type: fileType,
              is_deleted: false
            })
            .select()
            .single()

          if (dbError) throw dbError
          if (data) newFiles.push(data)
        } else {
          newFiles.push({
            id: `file-${Date.now()}-${i}`,
            folder_id: currentFolderId,
            name: file.name,
            storage_path: storagePath,
            version: 1,
            uploaded_by: null,
            file_size_bytes: file.size,
            file_type: fileType,
            uploaded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_deleted: false
          })
        }
      }

      setFiles((prev) => [...prev, ...newFiles])
      alert(`Successfully uploaded ${newFiles.length} file(s) to "${activeFolder?.name}".`)
    } catch (err: any) {
      alert(formatUserError(err, 'Upload'))
    } finally {
      setIsLoading(false)
      if (uploadInputRef.current) {
        uploadInputRef.current.value = ''
      }
    }
  }

  const handleReplaceFileVersion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !replacingFile || !selectedBatch || !selectedSubject) return

    setIsLoading(true)
    try {
      const bumpedVersion = replacingFile.version + 1
      const fileType = deriveFileType(file)
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const storagePath = `${selectedBatch.id}/${selectedSubject.slug}/${replacingFile.folder_id}/${replacingFile.id}-v${bumpedVersion}-${sanitizedFileName}`

      if (isSupabaseConfigured()) {
        // 1. Upload replacement binary to Supabase Storage 'course-materials'
        const { error: storageError } = await supabase.storage
          .from('course-materials')
          .upload(storagePath, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: fileType
          })

        if (storageError) {
          throw storageError
        }

        // 2. Update database record with new version and storage path
        const { data, error: dbError } = await supabase
          .from('files')
          .update({
            name: file.name,
            version: bumpedVersion,
            file_size_bytes: file.size,
            file_type: fileType,
            storage_path: storagePath,
            updated_at: new Date().toISOString()
          })
          .eq('id', replacingFile.id)
          .select()
          .single()

        if (dbError) throw dbError
        if (data) {
          setFiles((prev) => prev.map((f) => (f.id === replacingFile.id ? data : f)))
        }
      } else {
        const updatedFile: FileItem = {
          ...replacingFile,
          name: file.name,
          version: bumpedVersion,
          file_size_bytes: file.size,
          file_type: fileType,
          storage_path: storagePath,
          updated_at: new Date().toISOString()
        }
        setFiles((prev) => prev.map((f) => (f.id === replacingFile.id ? updatedFile : f)))
      }

      setReplacingFile(null)
      alert(`File replaced successfully! Version bumped to v${bumpedVersion}.`)
    } catch (err: any) {
      alert(formatUserError(err, 'File replacement'))
    } finally {
      setIsLoading(false)
      if (replaceInputRef.current) {
        replaceInputRef.current.value = ''
      }
    }
  }

  // If no batches exist in DB
  if (!isLoading && batches.length === 0) {
    return (
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <Header
          title="Content & Document Manager"
          subtitle="Manage batch-specific folders, curriculum notes, videos, images, and versioned materials"
        />
        <div style={{ padding: '60px 32px', textAlign: 'center' }}>
          <div className="card" style={{ maxWidth: '480px', margin: '0 auto', padding: '36px' }}>
            <Layers size={42} style={{ color: 'var(--accent-primary)', margin: '0 auto 16px auto', display: 'block' }} />
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>No Batches Found</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.5 }}>
              There are currently no batches in your database. Please create your batches first to manage content folders and files.
            </p>
            <a href="/batches" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
              Go to Batches & Subjects
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Content & Document Manager"
        subtitle="Manage nested folders, PDFs, MP4 lecture videos, and images with batch protection"
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              className="btn-secondary" 
              onClick={() => setIsFolderModalOpen(true)} 
              disabled={!selectedBatch || !selectedSubject}
            >
              <FolderPlus size={16} />
              {currentFolderId ? '+ New Subfolder' : '+ New Folder'}
            </button>
            {currentFolderId && (
              <>
                <input
                  type="file"
                  ref={uploadInputRef}
                  multiple
                  accept="application/pdf,video/mp4,video/quicktime,video/x-matroska,video/webm,image/png,image/jpeg,image/webp,image/gif"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button className="btn-primary" onClick={() => uploadInputRef.current?.click()}>
                  <Upload size={16} />
                  Upload Materials
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Hidden file input for file replacement */}
      <input
        type="file"
        ref={replaceInputRef}
        accept="application/pdf,video/mp4,video/quicktime,video/x-matroska,video/webm,image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleReplaceFileVersion}
      />

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* 1. CLASS & BATCH SELECTOR (Top Level Scope) */}
        {selectedBatch && (
          <div
            className="card"
            style={{
              backgroundColor: 'var(--surface-raised)',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 179, 0, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Layers size={22} />
              </div>
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  Active Target Batch
                </div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {selectedBatch.name} {selectedBatch.board ? `(${selectedBatch.board})` : ''}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                Switch Batch:
              </label>
              <select
                className="input-field"
                style={{ width: '320px', fontWeight: 500 }}
                value={selectedBatch.id}
                onChange={(e) => {
                  const found = batches.find((b) => b.id === e.target.value)
                  if (found) {
                    setSelectedBatch(found)
                    setCurrentFolderId(null)
                  }
                }}
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.class_name ? `[Class ${b.class_name}] ` : ''}{b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 2. SUBJECT TABS (Hidden for Direct Batch e.g. Foundation) */}
        {!isDirectBatch && selectedBatch && subjects.length > 0 && selectedSubject && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Subjects for {selectedBatch.name}
            </div>
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--border)', paddingBottom: '14px', flexWrap: 'wrap' }}>
              {subjects.map((sub) => {
                const isSelected = sub.id === selectedSubject.id
                return (
                  <button
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubject(sub)
                      setCurrentFolderId(null)
                    }}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: isSelected ? `1px solid ${sub.color}` : '1px solid transparent',
                      backgroundColor: isSelected ? 'var(--surface-raised)' : 'transparent',
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: '13px'
                    }}
                  >
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sub.color }} />
                    {sub.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* DIRECT BATCH BANNER (Shown when selectedBatch is Foundation) */}
        {isDirectBatch && selectedBatch && (
          <div
            style={{
              padding: '14px 18px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 159, 28, 0.08)',
              border: '1px solid rgba(255, 159, 28, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px' }}>⚡</span>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FF9F1C' }}>
                  Direct Foundation Course Content
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  This batch contains direct folders and study materials without subject divisions.
                </div>
              </div>
            </div>
            <span
              className="badge"
              style={{
                backgroundColor: 'rgba(255, 159, 28, 0.15)',
                color: '#FF9F1C',
                border: '1px solid rgba(255, 159, 28, 0.4)',
                fontWeight: 600,
                fontSize: '12px'
              }}
            >
              Direct Folders Mode
            </span>
          </div>
        )}

        {/* 3. MULTI-LEVEL BREADCRUMBS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span
            style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 600 }}
            onClick={() => setCurrentFolderId(null)}
          >
            {selectedBatch?.name || 'Batch'}
          </span>
          <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          <span
            style={{ cursor: 'pointer', color: currentFolderId === null ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: currentFolderId === null ? 600 : 400 }}
            onClick={() => setCurrentFolderId(null)}
          >
            {isDirectBatch ? 'Root Folders' : `${selectedSubject?.name || 'Subject'} Root`}
          </span>
          {breadcrumbPath.map((folder, idx) => {
            const isLast = idx === breadcrumbPath.length - 1
            return (
              <React.Fragment key={folder.id}>
                <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                {isLast ? (
                  <span style={{ 
                    color: 'var(--text-primary)', 
                    fontWeight: 600, 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    gap: '6px',
                    backgroundColor: 'var(--surface-raised)',
                    padding: '2px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border)'
                  }}>
                    <FolderOpen size={14} style={{ color: selectedSubject?.color || '#FFB300' }} />
                    {folder.name}
                  </span>
                ) : (
                  <span
                    style={{ cursor: 'pointer', color: 'var(--accent-primary)', fontWeight: 500 }}
                    onClick={() => setCurrentFolderId(folder.id)}
                  >
                    {folder.name}
                  </span>
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* 4. CONTENT SECTIONS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* FOLDER BANNER (When inside a folder) */}
          {activeFolder && (
            <div 
              className="card" 
              style={{ 
                padding: '16px 20px', 
                backgroundColor: 'var(--surface-raised)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '14px',
                borderLeft: `4px solid ${selectedSubject?.color || '#FFB300'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setCurrentFolderId(activeFolder.parent_folder_id || null)}
                  title={parentOfActiveFolder ? `Up to ${parentOfActiveFolder.name}` : 'Up to Root'}
                >
                  <ArrowLeft size={14} />
                  Up One Level
                </button>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderOpen size={18} style={{ color: selectedSubject?.color || '#FFB300' }} />
                    {activeFolder.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Path: {breadcrumbPath.map((b) => b.name).join(' / ')}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button 
                  className="btn-secondary" 
                  onClick={() => setIsFolderModalOpen(true)}
                  style={{ fontSize: '13px' }}
                >
                  <FolderPlus size={15} />
                  + New Subfolder
                </button>
                <button 
                  className="btn-primary" 
                  onClick={() => uploadInputRef.current?.click()}
                  style={{ fontSize: '13px' }}
                >
                  <Upload size={15} />
                  Upload Materials
                </button>
              </div>
            </div>
          )}

          {/* SUBFOLDERS / ROOT FOLDERS GRID */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                {currentFolderId ? `SUBFOLDERS IN "${activeFolder?.name}"` : 'ROOT FOLDERS'} ({currentFolders.length})
              </h3>
              <button
                className="btn-secondary"
                style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                onClick={() => setIsFolderModalOpen(true)}
              >
                <FolderPlus size={13} />
                {currentFolderId ? 'Add Subfolder' : 'Add Root Folder'}
              </button>
            </div>

            {currentFolders.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {currentFolders.map((folder) => {
                  const directFiles = files.filter((f) => f.folder_id === folder.id && !f.is_deleted).length
                  const directSubfolders = folders.filter((f) => f.parent_folder_id === folder.id && !f.is_deleted).length

                  return (
                    <div
                      key={folder.id}
                      className="card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                        borderLeft: `4px solid ${selectedSubject?.color || '#FFB300'}`,
                        transition: 'transform 0.15s ease, border-color 0.15s ease'
                      }}
                      onClick={() => setCurrentFolderId(folder.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                        <FolderIcon size={22} style={{ color: selectedSubject?.color || '#FFB300', flexShrink: 0 }} />
                        <div style={{ minWidth: 0, overflow: 'hidden' }}>
                          <div style={{ fontWeight: 500, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {folder.name}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {directFiles} file{directFiles !== 1 ? 's' : ''}
                            {directSubfolders > 0 && ` • ${directSubfolders} subfolder${directSubfolders !== 1 ? 's' : ''}`}
                          </div>
                        </div>
                      </div>

                      {/* Actions: Reorder & Delete */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }} onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px' }}
                          title="Move Up"
                          onClick={() => handleReorderFolder(folder.id, 'up')}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ padding: '4px' }}
                          title="Move Down"
                          onClick={() => handleReorderFolder(folder.id, 'down')}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          className="btn-danger"
                          style={{ padding: '4px' }}
                          title="Delete Folder"
                          onClick={() => handleSoftDeleteFolder(folder.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div
                className="card"
                style={{
                  padding: currentFolderId ? '24px' : '32px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  borderStyle: 'dashed'
                }}
              >
                {currentFolderId ? (
                  <span>
                    No subfolders created inside "{activeFolder?.name}". You can click "Add Subfolder" above, or upload documents and media directly below.
                  </span>
                ) : (
                  <span>
                    No root folders created for {isDirectBatch ? selectedBatch?.name : selectedSubject?.name}. Click "Add Root Folder" to create one.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* DOCUMENTS & MEDIA LIST (Shown when inside a folder) */}
          {currentFolderId && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                  DOCUMENTS & MEDIA IN "{activeFolder?.name}" ({currentFiles.length})
                </h3>
                <button
                  className="btn-primary"
                  style={{ padding: '4px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => uploadInputRef.current?.click()}
                >
                  <Upload size={13} />
                  Upload Materials
                </button>
              </div>

              {currentFiles.length > 0 ? (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table className="table-container">
                    <thead>
                      <tr>
                        <th style={{ width: '40%' }}>Material Name</th>
                        <th style={{ width: '15%' }}>Format</th>
                        <th style={{ width: '10%' }}>Version</th>
                        <th style={{ width: '15%' }}>File Size</th>
                        <th style={{ width: '10%' }}>Uploaded</th>
                        <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentFiles.map((file) => {
                        const badgeInfo = getFileBadge(file)
                        return (
                          <tr key={file.id}>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                {badgeInfo.icon}
                                <span style={{ fontWeight: 500 }}>{file.name}</span>
                              </div>
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={badgeInfo.badgeStyle}
                              >
                                {badgeInfo.badgeText}
                              </span>
                            </td>
                            <td>
                              <span
                                className="badge"
                                style={{
                                  backgroundColor: 'rgba(255, 179, 0, 0.1)',
                                  color: 'var(--accent-primary)',
                                  border: '1px solid rgba(255, 179, 0, 0.3)'
                                }}
                              >
                                v{file.version}
                              </span>
                            </td>
                            <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {formatFileSize(file.file_size_bytes)}
                            </td>
                            <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                              {new Date(file.uploaded_at).toLocaleDateString()}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                <button
                                  title="Replace with new version (bump version)"
                                  className="btn-secondary"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  onClick={() => {
                                    setReplacingFile(file)
                                    replaceInputRef.current?.click()
                                  }}
                                >
                                  <RefreshCw size={14} />
                                </button>
                                <button
                                  title="Delete Material"
                                  className="btn-danger"
                                  style={{ padding: '6px 8px', fontSize: '12px' }}
                                  onClick={() => handleSoftDeleteFile(file.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div
                  className="card"
                  style={{
                    padding: '36px',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    borderStyle: 'dashed'
                  }}
                >
                  <p style={{ marginBottom: '12px' }}>
                    No materials uploaded to "{activeFolder?.name}" yet.
                  </p>
                  <button 
                    className="btn-primary" 
                    onClick={() => uploadInputRef.current?.click()}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <Upload size={15} />
                    Upload PDF Notes, MP4 Videos, or Images
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* New Folder / Subfolder Modal */}
      {isFolderModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div className="card" style={{ width: '460px', backgroundColor: 'var(--surface-raised)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
              {currentFolderId ? `Create Subfolder in "${activeFolder?.name}"` : 'Create Root Folder'}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              Target: <strong style={{ color: 'var(--text-primary)' }}>{selectedBatch?.name}</strong>
              {!isDirectBatch && selectedSubject && (
                <> → <strong style={{ color: selectedSubject.color }}>{selectedSubject.name}</strong></>
              )}
              {breadcrumbPath.length > 0 && (
                <>
                  {' '}→{' '}
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                    {breadcrumbPath.map((b) => b.name).join(' → ')}
                  </span>
                </>
              )}
            </p>
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {currentFolderId ? 'Subfolder Name' : 'Folder Name'}
                </label>
                <input
                  type="text"
                  placeholder={currentFolderId ? 'e.g. Topic 1.1 - Velocity & Acceleration' : 'e.g. Chapter 01 - Mechanics Notes'}
                  className="input-field"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsFolderModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {currentFolderId ? 'Create Subfolder' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
