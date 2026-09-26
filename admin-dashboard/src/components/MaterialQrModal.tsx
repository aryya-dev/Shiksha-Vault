import { useState } from 'react'
import { createPortal } from 'react-dom'
import { QrCode, Copy, Check, X, ExternalLink, FileText, Video, Image as ImageIcon, Printer } from 'lucide-react'
import type { FileItem } from '../types/database'
import { supabaseUrl } from '../lib/supabase'

interface MaterialQrModalProps {
  isOpen: boolean
  onClose: () => void
  file: FileItem | null
}

export function MaterialQrModal({ isOpen, onClose, file }: MaterialQrModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen || !file) return null

  // Generate public / streamable access link
  const fileTargetUrl = file.storage_provider === 'gdrive' && file.gdrive_file_id
    ? `https://drive.google.com/file/d/${file.gdrive_file_id}/view`
    : `${supabaseUrl}/storage/v1/object/public/course-materials/${file.storage_path}`

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=${encodeURIComponent(fileTargetUrl)}`

  const handleCopy = () => {
    navigator.clipboard.writeText(fileTargetUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${file.name} - QR Code</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              padding: 40px;
              color: #111;
              text-align: center;
            }
            .card {
              border: 2px dashed #999;
              padding: 40px 60px;
              border-radius: 16px;
              max-width: 500px;
            }
            h1 { font-size: 24px; margin-bottom: 8px; }
            p { font-size: 14px; color: #555; margin-bottom: 24px; }
            img { width: 280px; height: 280px; margin: 0 auto; display: block; }
            .badge {
              display: inline-block;
              padding: 4px 12px;
              background: #f0f0f0;
              border-radius: 6px;
              font-size: 13px;
              font-weight: 600;
              margin-top: 16px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Shiksharthi Study Material</h1>
            <p>${file.name} (Version ${file.version})</p>
            <img src="${qrCodeUrl}" alt="QR Code" />
            <div class="badge">Scan to open on student mobile app</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const isVideo = file.file_type?.startsWith('video') || file.name.toLowerCase().endsWith('.mp4')
  const isImage = file.file_type?.startsWith('image') || file.name.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeIn 0.2s ease-out'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-raised)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 179, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(255, 179, 0, 0.3)'
            }}>
              {isVideo ? <Video size={20} /> : isImage ? <ImageIcon size={20} /> : <FileText size={20} />}
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Study Material QR Code
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </span>
                <span>•</span>
                <span>v{file.version}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px', alignItems: 'center' }}>
          
          {/* File Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <span
              className="badge"
              style={{
                backgroundColor: file.storage_provider === 'gdrive' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                color: file.storage_provider === 'gdrive' ? '#60A5FA' : '#34D399',
                border: `1px solid ${file.storage_provider === 'gdrive' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`,
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              {file.storage_provider === 'gdrive' ? 'Google Drive Cloud' : 'Supabase Private Storage'}
            </span>
            <span
              className="badge"
              style={{
                backgroundColor: 'rgba(255, 179, 0, 0.12)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(255, 179, 0, 0.3)',
                fontSize: '11px',
                fontWeight: 600
              }}
            >
              Active Version: v{file.version}
            </span>
          </div>

          {/* QR Code Container */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <img
              src={qrCodeUrl}
              alt={`QR Code for ${file.name}`}
              style={{ width: '220px', height: '220px', display: 'block', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#333333', fontSize: '11px', fontWeight: 600 }}>
              <QrCode size={13} />
              <span>Scan to access in student app</span>
            </div>
          </div>

          {/* Link box */}
          <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '6px 12px'
          }}>
            <input
              type="text"
              readOnly
              value={fileTargetUrl}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '12px',
                fontFamily: 'monospace',
                outline: 'none',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            />
            <button
              onClick={handleCopy}
              title="Copy link"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: copied ? 'rgba(46, 204, 113, 0.2)' : 'var(--surface)',
                color: copied ? 'var(--success)' : 'var(--text-primary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Actions: Print and Open */}
          <div style={{ width: '100%', display: 'flex', gap: '10px' }}>
            <button
              onClick={handlePrint}
              className="btn-secondary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                fontSize: '13px'
              }}
            >
              <Printer size={15} />
              <span>Print Classroom QR</span>
            </button>
            <a
              href={fileTargetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                padding: '10px 14px',
                fontSize: '13px',
                textDecoration: 'none'
              }}
            >
              <ExternalLink size={15} />
              <span>Open Link</span>
            </a>
          </div>

        </div>
      </div>
    </div>
  , document.body)
}
