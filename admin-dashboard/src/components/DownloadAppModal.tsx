import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
  Download, 
  QrCode, 
  Copy, 
  Check, 
  X, 
  Smartphone, 
  ShieldCheck, 
  Upload, 
  CheckCircle2, 
  Sparkles,
  Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'

interface DownloadAppModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
  const [copied, setCopied] = useState(false)
  const [fileSize, setFileSize] = useState<string>('23.6 MB')
  const [lastModified, setLastModified] = useState<string>('Today')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const publicApkUrl = 'https://hgsfflqydnnhghfvfmrc.supabase.co/storage/v1/object/public/app-release/Shiksharthi-Educational-Institute.apk'
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=12&data=${encodeURIComponent(publicApkUrl)}`

  // Fetch live metadata of the public APK file
  useEffect(() => {
    if (!isOpen) return

    fetch(publicApkUrl, { method: 'HEAD' })
      .then((res) => {
        if (res.ok) {
          const length = res.headers.get('content-length')
          if (length) {
            const bytes = parseInt(length, 10)
            const mb = (bytes / (1024 * 1024)).toFixed(1)
            setFileSize(`${mb} MB`)
          }
          const mod = res.headers.get('last-modified')
          if (mod) {
            const date = new Date(mod)
            setLastModified(date.toLocaleDateString(undefined, { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            }))
          }
        }
      })
      .catch((err) => {
        console.warn('Could not fetch APK HEAD metadata:', err)
      })
  }, [isOpen])

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(publicApkUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadSuccess(false)

    try {
      const { error } = await supabase.storage
        .from('app-release')
        .upload('Shiksharthi-Educational-Institute.apk', file, {
          upsert: true,
          contentType: 'application/vnd.android.package-archive'
        })

      if (error) throw error

      setFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`)
      setLastModified('Just now')
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 4000)
    } catch (err: any) {
      alert(`Upload failed: ${err.message || 'Please check your permissions'}`)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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
          maxWidth: '540px',
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
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--surface-raised)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 179, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-primary)',
              border: '1px solid rgba(255, 179, 0, 0.3)'
            }}>
              <Smartphone size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                  Shiksharthi Mobile App
                </h2>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#34D399',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    fontSize: '11px',
                    padding: '2px 8px'
                  }}
                >
                  ● Live Build
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Universal Release • {fileSize} • Updated: {lastModified}
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
          
          {/* Version and Highlights pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap',
            justifyContent: 'center'
          }}>
            <span
              className="badge"
              style={{
                backgroundColor: 'rgba(255, 179, 0, 0.12)',
                color: 'var(--accent-primary)',
                border: '1px solid rgba(255, 179, 0, 0.3)',
                fontSize: '11px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Sparkles size={12} />
              v1.2 (Video Player & Google Drive Fixes)
            </span>
            <span
              className="badge"
              style={{
                backgroundColor: 'rgba(59, 130, 246, 0.12)',
                color: '#60A5FA',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                fontSize: '11px'
              }}
            >
              File: Shiksharthi-Educational-Institute.apk
            </span>
            <span
              className="badge"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                fontSize: '11px'
              }}
            >
              Size: {fileSize}
            </span>
          </div>

          {/* QR Code Card */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '14px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px'
          }}>
            <img
              src={qrCodeUrl}
              alt="Scan QR Code to Download Shiksharthi Educational Institute App"
              style={{ width: '220px', height: '220px', display: 'block', borderRadius: '6px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1E293B', fontSize: '12px', fontWeight: 600 }}>
              <QrCode size={15} style={{ color: '#0F172A' }} />
              <span>Scan with Android Camera to Download</span>
            </div>
          </div>

          {/* Direct Download Action */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a
              href={publicApkUrl}
              download="Shiksharthi-Educational-Institute.apk"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '12px 20px',
                backgroundColor: 'var(--accent-primary)',
                color: '#000000',
                fontWeight: 600,
                fontSize: '14px',
                borderRadius: '8px',
                textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(255, 179, 0, 0.3)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Download size={18} />
              <span>Download Updated APK ({fileSize})</span>
            </a>

            {/* Copy Link */}
            <div style={{
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
                value={publicApkUrl}
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
                title="Copy direct download link"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
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
          </div>

          {/* Hidden APK File Input for Admin Replacement */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Admin Replace / Update APK Button */}
          <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                backgroundColor: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.borderColor = 'var(--accent-primary)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              {isUploading ? (
                <>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Uploading newer APK...</span>
                </>
              ) : uploadSuccess ? (
                <>
                  <CheckCircle2 size={13} style={{ color: '#34D399' }} />
                  <span style={{ color: '#34D399' }}>APK updated successfully!</span>
                </>
              ) : (
                <>
                  <Upload size={13} />
                  <span>Upload newer APK release file</span>
                </>
              )}
            </button>
          </div>

          {/* Security & Installation notice */}
          <div style={{
            width: '100%',
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <ShieldCheck size={18} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Student Installation:</strong> Students can scan this QR code with any camera or browser to download <code style={{ color: 'var(--accent-primary)' }}>Shiksharthi Educational Institute</code> app. If prompted by Play Protect, tap <span style={{ color: 'var(--accent-primary)' }}>"Install anyway"</span>.
            </div>
          </div>

        </div>
      </div>
    </div>
  , document.body)
}
