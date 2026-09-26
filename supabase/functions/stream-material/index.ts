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
      .select("id, name, storage_provider, gdrive_file_id, storage_path, file_type, file_size_bytes, is_deleted")
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
      const { data: hasAccess, error: accessError } = await supabase.rpc(
        "can_student_access_file",
        { p_student_id: user.id, p_file_id: file.id }
      )

      if (accessError || !hasAccess) {
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

      // Forward HTTP Range header for video seeking
      const rangeHeader = req.headers.get("Range")
      const driveHeaders: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
      }
      if (rangeHeader) {
        driveHeaders["Range"] = rangeHeader
      }

      const driveUrl = `https://www.googleapis.com/drive/v3/files/${file.gdrive_file_id}?alt=media`
      const driveRes = await fetch(driveUrl, { headers: driveHeaders })

      if (!driveRes.ok && driveRes.status !== 206) {
        const errorBody = await driveRes.text()
        return new Response(JSON.stringify({ error: `Google Drive error: ${errorBody}` }), {
          status: driveRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        })
      }

      const responseHeaders = new Headers(corsHeaders)
      responseHeaders.set("Content-Type", driveRes.headers.get("Content-Type") || file.file_type || "application/octet-stream")
      
      const contentLength = driveRes.headers.get("Content-Length")
      if (contentLength) responseHeaders.set("Content-Length", contentLength)

      const contentRange = driveRes.headers.get("Content-Range")
      if (contentRange) responseHeaders.set("Content-Range", contentRange)

      responseHeaders.set("Accept-Ranges", "bytes")
      responseHeaders.set("Cache-Control", "private, no-cache, no-store, must-revalidate")

      return new Response(driveRes.body, {
        status: driveRes.status, // 200 or 206 Partial Content
        headers: responseHeaders,
      })
    }

    // 5. Fallback for files stored in Supabase storage
    const { data: signedData, error: signError } = await supabase.storage
      .from("course-materials")
      .createSignedUrl(file.storage_path, 3600)

    if (signError || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate storage URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return Response.redirect(signedData.signedUrl, 302)
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
