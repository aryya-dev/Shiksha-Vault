/**
 * Student ID / Code Generator
 * 
 * Format:
 * [First 4 letters of first name + First letter of surname]_[Board Code + Class + Batch Section]_[Year]
 * 
 * Example:
 * Aariz Molla of Class 9 E ICSE board in 2026 => AARIM_I9E_2026
 */

export function extractNameCode(fullName: string): string {
  if (!fullName) return 'STUD'
  
  // Keep only alphabetical characters and spaces
  const clean = fullName.replace(/[^a-zA-Z\s]/g, '').trim()
  if (!clean) return 'STUD'

  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length === 1) {
    // Single word name: take first 4 to 5 chars
    return words[0].slice(0, 5).toUpperCase()
  }

  const firstName = words[0].toUpperCase()
  const surname = words[words.length - 1].toUpperCase()

  const firstPart = firstName.slice(0, 4)
  const surnamePart = surname.slice(0, 1)

  return `${firstPart}${surnamePart}`
}

export function getBoardCode(board?: string): string {
  const b = (board || '').toUpperCase().trim()
  if (b.includes('CBSE')) return 'C'
  if (b.includes('ICSE')) return 'I'
  if (b.includes('WBBSE')) return 'W'
  if (b.includes('FOUNDATION')) return 'F'
  if (b.length > 0) return b[0]
  return 'I'
}

export function extractNumericClass(className?: string): string {
  if (!className) return '9'
  const digits = className.replace(/[^0-9]/g, '')
  return digits || className.trim() || '9'
}

export function extractBatchSection(batchName?: string): string {
  if (!batchName) return ''
  const trimmed = batchName.trim()

  // Case 1: Trailing single uppercase letter like "9 ICSE E", "7 ICSE B", "10 CBSE A"
  const tokens = trimmed.split(/\s+/).filter(Boolean)
  if (tokens.length > 0) {
    const last = tokens[tokens.length - 1].toUpperCase()
    // A single letter A-Z that is not a known board word
    if (/^[A-Z]$/.test(last) && !['I', 'C', 'W'].includes(last)) {
      return last
    }
  }

  // Case 2: Pattern like "Section E", "Batch E", "Sec-E", "Sec E"
  const sectionMatch = trimmed.match(/(?:section|sec|batch)[-\s]+([A-Za-z0-9])/i)
  if (sectionMatch) {
    return sectionMatch[1].toUpperCase()
  }

  // Case 3: Any single letter token in the string except board names
  for (let i = tokens.length - 1; i >= 0; i--) {
    const token = tokens[i].toUpperCase()
    if (/^[A-Z]$/.test(token) && !['I', 'C', 'W'].includes(token)) {
      return token
    }
  }

  return ''
}

export interface StudentCodeParams {
  fullName: string
  className?: string
  board?: string
  batchName?: string
  year?: string | number
}

export function generateStudentCode({
  fullName,
  className = '9',
  board = 'ICSE',
  batchName = '',
  year = '2026'
}: StudentCodeParams): string {
  const namePart = extractNameCode(fullName)
  const boardLetter = getBoardCode(board)
  const classNumber = extractNumericClass(className)
  const batchLetter = extractBatchSection(batchName)

  // Middle part: e.g. I9E, C10A, C7
  const middlePart = `${boardLetter}${classNumber}${batchLetter}`.toUpperCase()
  const yearPart = String(year || '2026').trim()

  return `${namePart}_${middlePart}_${yearPart}`.toUpperCase()
}
