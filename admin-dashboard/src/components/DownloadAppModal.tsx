import { useState } from 'react'
import { Download, QrCode, Copy, Check, X, Smartphone, ShieldCheck } from 'lucide-react'

interface DownloadAppModalProps {
  isOpen: boolean
  onClose: () => void
}

export function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
  const [copied, setCopied] = useState(false)
  
  const publicApkUrl = 'https://hgsfflqydnnhghfvfmrc.supabase.co/storage/v1/object/public/app-release/Shiksha-Vault.apk'
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(publicApkUrl)}`

  if (!isOpen) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(publicApkUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
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
          maxWidth: '520px',
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
              <Smartphone size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Download Shiksha Vault App
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Universal Release • 30.7 MB • Any Network / Cellular
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
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          
          {/* QR Code Card */}
          <div style={{
            backgroundColor: '#ffffff',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px'
          }}>
            <img
              src={qrCodeUrl}
              alt="Scan to Download Shiksha Vault APK"
              style={{ width: '220px', height: '220px', display: 'block', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#333333', fontSize: '12px', fontWeight: 600 }}>
              <QrCode size={14} />
              <span>Scan with phone camera to download directly</span>
            </div>
          </div>

          {/* Direct Download Buttons */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <a
              href={publicApkUrl}
              download="Shiksha-Vault.apk"
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
                boxShadow: '0 4px 12px rgba(255, 179, 0, 0.25)',
                transition: 'transform 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Download size={18} />
              <span>Download Release APK (30.7 MB)</span>
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
                title="Copy link to clipboard"
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
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Installation note */}
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
              <strong style={{ color: 'var(--text-primary)' }}>Installation Note:</strong> When installing from Chrome or file manager, tap <span style={{ color: 'var(--accent-primary)' }}>"Settings &gt; Allow from this source"</span> or select <span style={{ color: 'var(--accent-primary)' }}>"Install anyway"</span> if prompted by Android Play Protect.
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
