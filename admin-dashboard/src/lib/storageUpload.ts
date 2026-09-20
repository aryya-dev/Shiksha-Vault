import * as tus from 'tus-js-client'
import { supabase, supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from './supabase'

export interface UploadProgressEvent {
  loaded: number
  total: number
  percent: number
  bytesPerSecond?: number
  estimatedSecondsRemaining?: number
}

export interface UploadOptions {
  cacheControl?: string
  upsert?: boolean
  contentType?: string
  signal?: AbortSignal
  onProgress?: (progress: UploadProgressEvent) => void
}

export interface UploadTask {
  id: string
  name: string
  file: File
  fileType: string
  fileSize: number
  progress: number // 0 to 100
  loadedBytes: number
  totalBytes: number
  status: 'pending' | 'uploading' | 'saving' | 'completed' | 'error' | 'aborted'
  errorMessage?: string
  bytesPerSecond?: number
  estimatedSecondsRemaining?: number
}

export const formatBytes = (bytes: number | null | undefined): string => {
  if (!bytes || bytes <= 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export const formatSpeed = (bytesPerSecond: number | undefined): string => {
  if (!bytesPerSecond || bytesPerSecond <= 0) return ''
  return `${formatBytes(bytesPerSecond)}/s`
}

export const formatEta = (seconds: number | undefined): string => {
  if (seconds === undefined || seconds === null || seconds < 0 || !isFinite(seconds)) return ''
  if (seconds < 60) return `~${Math.ceil(seconds)}s remaining`
  const minutes = Math.floor(seconds / 60)
  const remainingSecs = Math.ceil(seconds % 60)
  return `~${minutes}m ${remainingSecs}s remaining`
}

/**
 * Uploads a file to Supabase Storage with real-time byte-level progress reporting.
 * Automatically uses TUS (Resumable chunked upload) for files >= 6MB (videos, high-res documents)
 * to support large files up to 500 MB+ and avoid gateway timeouts.
 */
export async function uploadToStorageWithProgress(
  bucket: string,
  path: string,
  file: File,
  options: UploadOptions = {}
): Promise<{ data: { path: string; fullPath?: string } | null; error: Error | null }> {
  // If Supabase is not configured (mock environment), simulate a realistic progress curve
  if (!isSupabaseConfigured()) {
    return new Promise((resolve, reject) => {
      let currentProgress = 0
      const total = file.size || 1024 * 1024
      const interval = setInterval(() => {
        if (options.signal?.aborted) {
          clearInterval(interval)
          reject(new DOMException('Upload aborted', 'AbortError'))
          return
        }

        currentProgress += 15 + Math.random() * 20
        if (currentProgress >= 100) {
          currentProgress = 100
          clearInterval(interval)
          options.onProgress?.({
            loaded: total,
            total,
            percent: 100,
            bytesPerSecond: total,
            estimatedSecondsRemaining: 0
          })
          resolve({ data: { path }, error: null })
        } else {
          const loaded = Math.round((currentProgress / 100) * total)
          options.onProgress?.({
            loaded,
            total,
            percent: Math.round(currentProgress),
            bytesPerSecond: total / 1.5,
            estimatedSecondsRemaining: 1
          })
        }
      }, 150)
    })
  }

  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token || supabaseAnonKey
  const cleanPath = path.replace(/^\/+/, '').replace(/\/+/g, '/')

  // For files >= 6MB (e.g. 240MB lecture videos), use TUS Resumable Upload
  if (file.size >= 6 * 1024 * 1024) {
    const projectIdMatch = supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)
    const projectId = projectIdMatch ? projectIdMatch[1] : null
    const endpoint = projectId
      ? `https://${projectId}.storage.supabase.co/storage/v1/upload/resumable`
      : `${supabaseUrl}/storage/v1/upload/resumable`

    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      let lastLoaded = 0
      let lastTime = startTime

      const upload = new tus.Upload(file, {
        endpoint,
        retryDelays: [0, 2000, 5000, 10000],
        headers: {
          authorization: `Bearer ${token}`,
          apikey: supabaseAnonKey,
          ...(options.upsert ? { 'x-upsert': 'true' } : {})
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: {
          bucketName: bucket,
          objectName: cleanPath,
          contentType: options.contentType || file.type || 'application/octet-stream',
          cacheControl: options.cacheControl || '3600'
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const now = Date.now()
          const timeDiff = (now - lastTime) / 1000
          let bytesPerSecond = 0

          if (timeDiff >= 0.25) {
            bytesPerSecond = (bytesUploaded - lastLoaded) / timeDiff
            lastLoaded = bytesUploaded
            lastTime = now
          } else {
            const totalDuration = (now - startTime) / 1000
            if (totalDuration > 0) {
              bytesPerSecond = bytesUploaded / totalDuration
            }
          }

          const percent = Math.min(99, Math.round((bytesUploaded / bytesTotal) * 100))
          const remainingBytes = bytesTotal - bytesUploaded
          const estimatedSecondsRemaining =
            bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : undefined

          options.onProgress?.({
            loaded: bytesUploaded,
            total: bytesTotal,
            percent,
            bytesPerSecond,
            estimatedSecondsRemaining
          })
        },
        onSuccess: () => {
          options.onProgress?.({
            loaded: file.size,
            total: file.size,
            percent: 100,
            bytesPerSecond: 0,
            estimatedSecondsRemaining: 0
          })
          resolve({ data: { path: cleanPath }, error: null })
        },
        onError: (error) => {
          let msg = error.message || 'Upload failed'
          if (
            msg.toLowerCase().includes('exceeded the maximum') ||
            msg.toLowerCase().includes('413')
          ) {
            msg = `File size (${formatBytes(file.size)}) exceeds Supabase limit. Please raise your bucket limit to 500 MB in Supabase Storage Settings.`
          }
          reject(new Error(msg))
        }
      })

      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          upload.abort()
          reject(new DOMException('Upload aborted by user', 'AbortError'))
        })
      }

      upload.findPreviousUploads().then((previousUploads) => {
        if (previousUploads.length) {
          upload.resumeFromPreviousUpload(previousUploads[0])
        }
        upload.start()
      }).catch(() => {
        upload.start()
      })
    })
  }

  // For smaller files (< 6MB), use standard XMLHttpRequest with progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const targetUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${cleanPath}`

    xhr.open('POST', targetUrl)
    xhr.setRequestHeader('apikey', supabaseAnonKey)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    if (options.upsert) {
      xhr.setRequestHeader('x-upsert', 'true')
    }

    const startTime = Date.now()
    let lastLoaded = 0
    let lastTime = startTime

    if (xhr.upload) {
      xhr.upload.onprogress = (event: ProgressEvent) => {
        if (event.lengthComputable && event.total > 0) {
          const now = Date.now()
          const timeDiff = (now - lastTime) / 1000
          let bytesPerSecond = 0

          if (timeDiff >= 0.25) {
            bytesPerSecond = (event.loaded - lastLoaded) / timeDiff
            lastLoaded = event.loaded
            lastTime = now
          } else {
            const totalDuration = (now - startTime) / 1000
            if (totalDuration > 0) {
              bytesPerSecond = event.loaded / totalDuration
            }
          }

          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100))
          const remainingBytes = event.total - event.loaded
          const estimatedSecondsRemaining =
            bytesPerSecond > 0 ? remainingBytes / bytesPerSecond : undefined

          options.onProgress?.({
            loaded: event.loaded,
            total: event.total,
            percent,
            bytesPerSecond,
            estimatedSecondsRemaining
          })
        }
      }
    }

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        xhr.abort()
        reject(new DOMException('Upload aborted by user', 'AbortError'))
      })
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        options.onProgress?.({
          loaded: file.size,
          total: file.size,
          percent: 100,
          bytesPerSecond: 0,
          estimatedSecondsRemaining: 0
        })

        try {
          const res = JSON.parse(xhr.responseText || '{}')
          resolve({ data: res, error: null })
        } catch {
          resolve({ data: { path: cleanPath }, error: null })
        }
      } else {
        let errorMsg = `Upload failed (HTTP ${xhr.status})`
        try {
          const res = JSON.parse(xhr.responseText)
          errorMsg = res.message || res.error || errorMsg
        } catch {}
        if (
          errorMsg.toLowerCase().includes('exceeded the maximum') ||
          xhr.status === 413
        ) {
          errorMsg = `File size (${formatBytes(file.size)}) exceeds Supabase limit. Please raise your bucket limit to 500 MB in Supabase Storage Settings.`
        }
        reject(new Error(errorMsg))
      }
    }

    xhr.onerror = () => {
      reject(new Error('Network error during file upload. Check your internet connection.'))
    }

    xhr.ontimeout = () => {
      reject(new Error('Upload request timed out.'))
    }

    const formData = new FormData()
    formData.append('cacheControl', options.cacheControl || '3600')
    formData.append('', file, file.name)

    xhr.send(formData)
  })
}
