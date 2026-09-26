import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.115.0"

// CORS headers for web preview and mobile app
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, range",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
}

interface ServiceAccountKey {
  client_email: string
  private_key: string
  token_uri?: string
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null

/**
 * Generates an OAuth2 access token for Google Drive API using RS256 JWT
 */
async function getGoogleDriveAccessToken(serviceAccount: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  // Return cached token if valid for at least 5 more minutes
  if (cachedAccessToken && cachedAccessToken.expiresAt > now + 300) {
    return cachedAccessToken.token
  }

  const pemHeader = "-----BEGIN PRIVATE KEY-----"
  const pemFooter = "-----END PRIVATE KEY-----"
  const rawKey = serviceAccount.private_key
    .replace(/\\n/g, "\n")
    .replace(pemHeader, "")
    .replace(pemFooter, "")
    .replace(/\s+/g, "")

  const binaryKey = Uint8Array.from(atob(rawKey), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  )

  // Build JWT header & payload
  const header = { alg: "RS256", typ: "JWT" }
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: serviceAccount.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  }

  const base64UrlEncode = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")

  const encodedHeader = base64UrlEncode(header)
  const encodedPayload = base64UrlEncode(payload)
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  )

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")

  const signedJwt = `${unsignedToken}.${encodedSignature}`

  // Exchange JWT for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    throw new Error(`Failed to obtain Google Drive access token: ${errText}`)
  }

  const tokenData = await tokenRes.json()
  cachedAccessToken = {
    token: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600),
  }

  return tokenData.access_token
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const fileId = url.searchParams.get("file_id")

    if (!fileId) {
      return new Response(JSON.stringify({ error: "Missing file_id parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 1. Authorize student / admin from token
    const authHeader = req.headers.get("Authorization")
    const queryToken = url.searchParams.get("token")
    const jwt = authHeader?.replace("Bearer ", "") || queryToken

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt)
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 2. Fetch file record from database
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, name, folder_id, storage_provider, gdrive_file_id, storage_path, file_type, file_size_bytes, is_deleted")
      .eq("id", fileId)
      .single()

    if (fileError || !file || file.is_deleted) {
      return new Response(JSON.stringify({ error: "File not found or has been moved to trash" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    // 3. Verify user has permission (Admin OR Enrolled Active Student)
    const { data: adminUser } = await supabase
      .from("admins")
      .select("id")
      .eq("id", user.id)
      .maybeSingle()

    const isAdmin = Boolean(adminUser)

    if (!isAdmin) {
      let hasAccess = false

      // 3a. Try RPC first
      try {
        const { data: rpcAccess, error: accessError } = await supabase.rpc(
          "can_student_access_file",
          { p_student_id: user.id, p_file_id: file.id }
        )

        if (!accessError && typeof rpcAccess === "boolean") {
          hasAccess = rpcAccess
        } else if (accessError) {
          console.warn("[stream-material] RPC can_student_access_file failed, falling back to direct check:", accessError.message)
        }
      } catch (rpcErr) {
        console.warn("[stream-material] RPC exception, falling back:", rpcErr)
      }

      // 3b. Fallback direct permission check if RPC failed or had schema error
      if (!hasAccess) {
        const { data: folder } = await supabase
          .from("folders")
          .select("id, batch_id, subject_id, is_deleted")
          .eq("id", file.folder_id)
          .maybeSingle()

        const { data: student } = await supabase
          .from("students")
          .select("id, batch_id, is_active")
          .eq("id", user.id)
          .maybeSingle()

        if (folder && !folder.is_deleted && student && student.is_active) {
          let batchMatches = false
          if (!folder.batch_id || folder.batch_id === student.batch_id) {
            batchMatches = true
          } else {
            // Check student_batches for secondary batch enrollment
            const { data: secBatch } = await supabase
              .from("student_batches")
              .select("batch_id")
              .eq("student_id", user.id)
              .eq("batch_id", folder.batch_id)
              .maybeSingle()
            if (secBatch) batchMatches = true
          }

          if (batchMatches) {
            if (!folder.subject_id) {
              hasAccess = true
            } else {
              // Foundation batch check
              const { data: batch } = await supabase
                .from("batches")
                .select("id, board, name")
                .eq("id", folder.batch_id)
                .maybeSingle()

              if (batch && (batch.board === "Foundation" || (batch.name && batch.name.toLowerCase().includes("foundation")))) {
                hasAccess = true
              } else {
                const { data: subj } = await supabase
                  .from("student_subjects")
                  .select("subject_id")
                  .eq("student_id", user.id)
                  .eq("subject_id", folder.subject_id)
                  .maybeSingle()
                if (subj) hasAccess = true
              }
            }
          }
        }
      }

      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: "Access denied: You are not enrolled in this material's batch" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }
    }

    // 4. Stream Google Drive file
    if (file.storage_provider === "gdrive") {
      if (!file.gdrive_file_id) {
        return new Response(JSON.stringify({ error: "Google Drive File ID missing" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const serviceAccountJson = Deno.env.get("GDRIVE_SERVICE_ACCOUNT_KEY")
      if (!serviceAccountJson) {
        return new Response(
          JSON.stringify({ error: "GDRIVE_SERVICE_ACCOUNT_KEY secret is not configured on Supabase" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      const serviceAccount: ServiceAccountKey = JSON.parse(serviceAccountJson)
      const accessToken = await getGoogleDriveAccessToken(serviceAccount)

      // Forward HTTP Range header for smooth video seeking & partial byte streaming
      const rangeHeader = req.headers.get("Range")
      const driveHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      }
      if (rangeHeader) {
        driveHeaders["Range"] = rangeHeader
      }

      const driveUrl = `https://www.googleapis.com/drive/v3/files/${file.gdrive_file_id}?alt=media&supportsAllDrives=true&acknowledgeAbuse=true`
      const driveRes = await fetch(driveUrl, { headers: driveHeaders })

      if (!driveRes.ok && driveRes.status !== 206) {
        const errorBody = await driveRes.text()
        console.error("[stream-material] Google Drive fetch failed:", driveRes.status, errorBody)
        return new Response(JSON.stringify({ error: `Google Drive error: ${errorBody}` }), {
          status: driveRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const responseHeaders = new Headers(corsHeaders)

      // Ensure explicit video/pdf MIME type so mobile players (ExoPlayer) parse container correctly
      let contentType = driveRes.headers.get("Content-Type") || file.file_type || "application/octet-stream"
      const lowerName = (file.name || "").toLowerCase()
      if (lowerName.endsWith(".mp4") || contentType.includes("mp4")) {
        contentType = "video/mp4"
      } else if (lowerName.endsWith(".mkv") || contentType.includes("matroska")) {
        contentType = "video/x-matroska"
      } else if (lowerName.endsWith(".pdf") || contentType.includes("pdf")) {
        contentType = "application/pdf"
      }

      responseHeaders.set("Content-Type", contentType)
      
      const contentLength = driveRes.headers.get("Content-Length")
      if (contentLength) responseHeaders.set("Content-Length", contentLength)

      const contentRange = driveRes.headers.get("Content-Range")
      if (contentRange) responseHeaders.set("Content-Range", contentRange)

      responseHeaders.set("Accept-Ranges", "bytes")
      responseHeaders.set("Cache-Control", "private, max-age=300")

      return new Response(driveRes.body, {
        status: driveRes.status, // 200 or 206 Partial Content
        headers: responseHeaders,
      })
    }

    // 5. Fallback for files stored in Supabase storage (proxy directly with range support)
    const { data: signedData, error: signError } = await supabase.storage
      .from("course-materials")
      .createSignedUrl(file.storage_path, 3600)

    if (signError || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate storage URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const rangeHeader = req.headers.get("Range")
    const storageHeaders: Record<string, string> = {}
    if (rangeHeader) storageHeaders["Range"] = rangeHeader

    const storageRes = await fetch(signedData.signedUrl, { headers: storageHeaders })
    const responseHeaders = new Headers(corsHeaders)

    let contentType = storageRes.headers.get("Content-Type") || file.file_type || "application/octet-stream"
    const lowerName = (file.name || "").toLowerCase()
    if (lowerName.endsWith(".mp4") || contentType.includes("mp4")) {
      contentType = "video/mp4"
    } else if (lowerName.endsWith(".pdf") || contentType.includes("pdf")) {
      contentType = "application/pdf"
    }

    responseHeaders.set("Content-Type", contentType)
    const cl = storageRes.headers.get("Content-Length")
    if (cl) responseHeaders.set("Content-Length", cl)
    const cr = storageRes.headers.get("Content-Range")
    if (cr) responseHeaders.set("Content-Range", cr)
    responseHeaders.set("Accept-Ranges", "bytes")

    return new Response(storageRes.body, {
      status: storageRes.status,
      headers: responseHeaders,
    })
  } catch (err: any) {
    console.error("[stream-material] Uncaught error:", err)
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})

