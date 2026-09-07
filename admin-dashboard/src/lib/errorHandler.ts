/**
 * Centralized human-friendly error formatter for the Admin Dashboard.
 * Translates PostgreSQL, Supabase Auth, Storage, and Network exceptions
 * into clear, actionable, non-technical explanations.
 */
export function formatUserError(err: any, context?: string): string {
  if (!err) {
    return context ? `${context}: An unknown error occurred.` : 'An unknown error occurred. Please try again.'
  }

  const rawMsg = typeof err === 'string' 
    ? err 
    : (err.message || err.error_description || err.details || JSON.stringify(err))
  const msg = rawMsg.toLowerCase()
  const code = String(err.code || err.statusCode || '')

  let friendly = ''

  // 1. Unique constraint violation (Duplicate records)
  if (code === '23505' || msg.includes('23505') || msg.includes('unique constraint') || msg.includes('already exists')) {
    if (msg.includes('student_code') || msg.includes('student code')) {
      friendly = 'A student with this Student Code already exists. Please assign a unique code.'
    } else if (msg.includes('email')) {
      friendly = 'This email address is already registered in the system.'
    } else if (msg.includes('batch')) {
      friendly = 'A batch with this name or code already exists.'
    } else {
      friendly = 'A record with this identifier already exists. Please check your inputs.'
    }
  }

  // 2. Foreign key violation (Dependent items)
  else if (code === '23503' || msg.includes('foreign key constraint') || msg.includes('violates foreign key')) {
    friendly = 'Cannot remove or modify this item because active records depend on it. Please remove related contents first.'
  }

  // 3. Permission & Row-Level Security
  else if (code === '42501' || msg.includes('row-level security') || msg.includes('accessdenied') || msg.includes('403') || msg.includes('unauthorized')) {
    friendly = 'Permission denied. Please ensure your admin session is active.'
  }

  // 4. File upload size limit
  else if (code === '413' || msg.includes('payload too large') || msg.includes('entity too large')) {
    friendly = 'The selected file exceeds the 50 MB upload limit. Please select a smaller file.'
  }

  // 5. File / Object not found
  else if (code === '404' || msg.includes('nosuchkey') || msg.includes('object not found') || msg.includes('not_found')) {
    friendly = 'The requested file or resource could not be found.'
  }

  // 6. Network / Offline issues
  else if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('timeout') || msg.includes('offline')) {
    friendly = 'Network connection problem. Please check your internet connection.'
  }

  // 7. Authentication errors
  else if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    friendly = 'Incorrect email or password. Please verify and try again.'
  }
  else if (msg.includes('email not confirmed')) {
    friendly = 'This email address is not yet confirmed. Please verify your email or confirm it in your Supabase Auth dashboard.'
  }

  // 8. Rate limits
  else if (msg.includes('rate limit') || msg.includes('too many requests')) {
    friendly = 'Too many requests. Please wait a minute and try again.'
  }

  // 9. CSV Parsing
  else if (msg.includes('csv') || msg.includes('parse error')) {
    friendly = 'Unable to read the CSV file. Please ensure columns match: FullName, StudentCode, Email, Phone.'
  }

  // 10. Fallback: if message is already clean and human-readable (no SQL/JSON syntax), use it directly
  else if (!rawMsg.includes('{') && !rawMsg.includes('PGRST') && !rawMsg.includes('SELECT') && !rawMsg.includes('table "')) {
    friendly = rawMsg
  } else {
    friendly = 'Could not complete this action. Please check your details and try again.'
  }

  return context ? `${context}: ${friendly}` : friendly
}
