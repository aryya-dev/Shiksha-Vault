import React, { useState } from 'react'
import { 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  ChevronDown, 
  ChevronUp, 
  FileText, 
  Video, 
  Image as ImageIcon,
  Loader2
} from 'lucide-react'
import { formatBytes, formatSpeed, formatEta, type UploadTask } from '../lib/storageUpload'

interface UploadProgressWidgetProps {
  tasks: UploadTask[]
  onCancelAll?: () => void
  onDismiss?: () => void
  isReplacing?: boolean
}

export const UploadProgressWidget: React.FC<UploadProgressWidgetProps> = ({
  tasks,
  onCancelAll,
  onDismiss,
  isReplacing = false
}) => {
  const [isMinimized, setIsMinimized] = useState(false)

  if (tasks.length === 0) return null

  const totalFiles = tasks.length
  const completedFiles = tasks.filter((t) => t.status === 'completed').length
  const failedFiles = tasks.filter((t) => t.status === 'error' || t.status === 'aborted').length
  const isAllDone = completedFiles + failedFiles === totalFiles

  // Calculate aggregate metrics across all files
  const totalBytes = tasks.reduce((acc, t) => acc + (t.totalBytes || t.fileSize || 0), 0)
  const loadedBytes = tasks.reduce((acc, t) => {
    if (t.status === 'completed') return acc + (t.totalBytes || t.fileSize || 0)
    return acc + (t.loadedBytes || 0)
  }, 0)

  const overallPercent = totalBytes > 0 
    ? Math.min(100, Math.round((loadedBytes / totalBytes) * 100)) 
    : 0

  // Aggregate current speed & eta
  const activeTask = tasks.find((t) => t.status === 'uploading' || t.status === 'saving')
  const currentSpeed = activeTask?.bytesPerSecond
  const currentEta = activeTask?.estimatedSecondsRemaining

  const getFileIcon = (fileType: string, name: string) => {
    const t = (fileType || '').toLowerCase()
    const n = name.toLowerCase()

    if (t.startsWith('video/') || n.endsWith('.mp4') || n.endsWith('.mov') || n.endsWith('.mkv') || n.endsWith('.webm')) {
      return <Video size={16} style={{ color: '#A855F7', flexShrink: 0 }} />
    }
    if (t.startsWith('image/') || n.endsWith('.png') || n.endsWith('.jpg') || n.endsWith('.jpeg') || n.endsWith('.webp') || n.endsWith('.gif')) {
      return <ImageIcon size={16} style={{ color: '#10B981', flexShrink: 0 }} />
    }
    return <FileText size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
  }

  // Minimized compact pill view
  if (isMinimized) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 1000,
          backgroundColor: 'var(--surface-raised)',
          border: '1px solid var(--border-strong)',
          borderRadius: '30px',
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.45)',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={() => setIsMinimized(false)}
      >
        {isAllDone ? (
          failedFiles > 0 ? (
            <AlertCircle size={18} style={{ color: 'var(--danger)' }} />
          ) : (
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          )
        ) : (
          <Loader2 size={18} style={{ color: 'var(--accent-primary)', animation: 'spin 1s linear infinite' }} />
        )}

        <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {isAllDone
            ? failedFiles > 0
              ? `Upload finished with ${failedFiles} error(s)`
              : `${totalFiles} file(s) uploaded`
            : `${isReplacing ? 'Replacing file' : 'Uploading'} (${overallPercent}%)`}
        </div>

        <button
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 0,
            display: 'flex'
          }}
          onClick={(e) => {
            e.stopPropagation()
            setIsMinimized(false)
          }}
          title="Expand"
        >
          <ChevronUp size={16} />
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 1000,
        width: '420px',
        maxWidth: 'calc(100vw - 32px)',
        backgroundColor: '#1A1A1D',
        border: '1px solid var(--border-strong)',
        borderRadius: '12px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.55)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(12px)',
        animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: '#222226',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          {isAllDone ? (
            failedFiles > 0 ? (
              <AlertCircle size={20} style={{ color: 'var(--danger)', flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={20} style={{ color: 'var(--success)', flexShrink: 0 }} />
            )
          ) : (
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 179, 0, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <Upload size={15} style={{ color: 'var(--accent-primary)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          )}

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isAllDone
                ? failedFiles > 0
                  ? 'Upload finished with warnings'
                  : 'All materials uploaded successfully'
                : isReplacing
                ? 'Replacing file version...'
                : totalFiles === 1
                ? 'Uploading 1 file...'
                : `Uploading ${completedFiles + 1} of ${totalFiles} files...`}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {isAllDone
                ? `${completedFiles} completed${failedFiles > 0 ? `, ${failedFiles} failed` : ''}`
                : `${formatBytes(loadedBytes)} of ${formatBytes(totalBytes)} (${overallPercent}%)`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s'
            }}
            title="Minimize"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ChevronDown size={16} />
          </button>

          {isAllDone ? (
            <button
              onClick={onDismiss}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s'
              }}
              title="Close"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={16} />
            </button>
          ) : onCancelAll ? (
            <button
              onClick={onCancelAll}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--danger)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s'
              }}
              title="Cancel all uploads"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255, 77, 77, 0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Overall Progress Bar */}
      <div style={{ padding: '16px 18px 12px 18px' }}>
        <div
          style={{
            height: '8px',
            backgroundColor: 'var(--border)',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${overallPercent}%`,
              background: isAllDone
                ? failedFiles > 0
                  ? 'var(--danger)'
                  : 'linear-gradient(90deg, #10B981, #34D399)'
                : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))',
              borderRadius: '4px',
              transition: 'width 0.25s ease-out'
            }}
          />
        </div>

        {/* Speed & ETA stats */}
        {!isAllDone && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}
          >
            <span>{currentSpeed ? formatSpeed(currentSpeed) : 'Calculating speed...'}</span>
            <span>{currentEta !== undefined ? formatEta(currentEta) : ''}</span>
          </div>
        )}
      </div>

      {/* Individual File Items List */}
      <div
        style={{
          maxHeight: '220px',
          overflowY: 'auto',
          padding: '0 18px 14px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}
      >
        {tasks.map((task) => (
          <div
            key={task.id}
            style={{
              backgroundColor: 'var(--surface-raised)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                {getFileIcon(task.fileType, task.name)}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'var(--text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={task.name}
                >
                  {task.name}
                </span>
              </div>

              {/* Status Indicator */}
              <div style={{ fontSize: '11px', fontWeight: 600, flexShrink: 0 }}>
                {task.status === 'completed' && (
                  <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={13} />
                    Done
                  </span>
                )}
                {task.status === 'uploading' && (
                  <span style={{ color: 'var(--accent-primary)' }}>
                    {task.progress}%
                  </span>
                )}
                {task.status === 'saving' && (
                  <span style={{ color: '#38BDF8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                    Saving
                  </span>
                )}
                {task.status === 'pending' && (
                  <span style={{ color: 'var(--text-muted)' }}>Waiting</span>
                )}
                {task.status === 'error' && (
                  <span style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertCircle size={13} />
                    Failed
                  </span>
                )}
                {task.status === 'aborted' && (
                  <span style={{ color: 'var(--danger)' }}>Cancelled</span>
                )}
              </div>
            </div>

            {/* Individual file progress bar */}
            <div
              style={{
                height: '4px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '2px',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${task.progress}%`,
                  backgroundColor:
                    task.status === 'completed'
                      ? 'var(--success)'
                      : task.status === 'error' || task.status === 'aborted'
                      ? 'var(--danger)'
                      : 'var(--accent-primary)',
                  transition: 'width 0.2s ease-out'
                }}
              />
            </div>

            {/* File subtext: size + error message if any */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: task.errorMessage ? 'var(--danger)' : 'var(--text-muted)'
              }}
            >
              <span>
                {task.status === 'completed'
                  ? formatBytes(task.fileSize)
                  : `${formatBytes(task.loadedBytes)} / ${formatBytes(task.fileSize)}`}
              </span>
              {task.errorMessage && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }} title={task.errorMessage}>
                  {task.errorMessage}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
