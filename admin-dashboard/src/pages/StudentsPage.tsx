import React, { useState, useEffect, useRef } from 'react'
import { Header } from '../components/Header'
import { 
  Plus, 
  Search, 
  KeyRound, 
  Check, 
  UserCheck, 
  UserX, 
  FileSpreadsheet, 
  Download, 
  Trash2,
  Users
} from 'lucide-react'
import Papa from 'papaparse'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatUserError } from '../lib/errorHandler'
import type { Student, Batch, Subject } from '../types/database'

export const StudentsPage: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterBoard, setFilterBoard] = useState<string>('all')
  const [filterClass, setFilterClass] = useState<string>('all')
  const [filterBatch, setFilterBatch] = useState<string>('all')

  // Available Boards and Classes dynamically extracted from batches and students
  const availableBoards = Array.from(
    new Set([
      ...batches.map((b) => b.board).filter(Boolean),
      ...students.map((s) => s.board).filter(Boolean)
    ])
  ) as string[]

  const availableClasses = Array.from(
    new Set([
      ...batches.map((b) => b.class_name).filter(Boolean),
      ...students.map((s) => s.class_name).filter(Boolean)
    ])
  ) as string[]

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false)
  const [csvData, setCsvData] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add Student Form State
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formClass, setFormClass] = useState('10')
  const [formBoard, setFormBoard] = useState('ICSE')
  const [formBatchId, setFormBatchId] = useState('')
  const [formSubjectIds, setFormSubjectIds] = useState<string[]>([])

  const fetchStudents = async () => {
    if (!isSupabaseConfigured()) {
      setStudents([])
      setBatches([])
      return
    }
    setIsLoading(true)
    try {
      const { data: bData } = await supabase.from('batches').select('*').order('created_at', { ascending: false })
      const { data: sData } = await supabase.from('subjects').select('*').order('name')
      setBatches(bData || [])
      setSubjects(sData || [])

      const { data: stData, error } = await supabase
        .from('students')
        .select(`
          *,
          batches (*),
          student_subjects (
            subject_id,
            subjects (*)
          )
        `)
        .order('student_code', { ascending: true })

      if (error) throw error
      setStudents((stData as any) || [])
    } catch (err) {
      console.error('Error fetching students:', err)
      setStudents([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
  }, [])

  const handleToggleActive = async (studentId: string, currentStatus: boolean) => {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('students')
          .update({ is_active: !currentStatus })
          .eq('id', studentId)

        if (error) throw error
        await fetchStudents()
      } catch (err: any) {
        alert(formatUserError(err, 'Failed to update student status'))
      }
    } else {
      setStudents(
        students.map((s) => (s.id === studentId ? { ...s, is_active: !currentStatus } : s))
      )
    }
  }

  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to permanently delete student "${studentName}"?`)) return

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('students').delete().eq('id', studentId)
        if (error) throw error
        setStudents(students.filter((s) => s.id !== studentId))
      } catch (err: any) {
        alert(formatUserError(err, 'Failed to delete student'))
      }
    } else {
      setStudents(students.filter((s) => s.id !== studentId))
    }
  }

  const handleResetPassword = (code: string) => {
    alert(`Temporary one-time password generated for ${code}: SH@${Math.floor(1000 + Math.random() * 9000)}. Hand this code to student.`)
  }

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCode || !formName || !formBatchId) return

    const selectedBatch = batches.find((b) => b.id === formBatchId)

    if (isSupabaseConfigured()) {
      try {
        const { data: newStudent, error } = await supabase
          .from('students')
          .insert({
            student_code: formCode.trim().toUpperCase(),
            full_name: formName.trim(),
            class_name: formClass.trim(),
            board: formBoard.trim(),
            batch_id: formBatchId,
            is_active: true,
            must_change_password: true
          })
          .select()
          .single()

        if (error) throw error

        if (formSubjectIds.length > 0 && newStudent) {
          const subLinks = formSubjectIds.map((sId) => ({
            student_id: newStudent.id,
            subject_id: sId
          }))
          await supabase.from('student_subjects').insert(subLinks)
        }
        await fetchStudents()
      } catch (err: any) {
        alert(formatUserError(err, 'Failed to add student'))
      }
    } else {
      const selectedSubs = subjects
        .filter((s) => formSubjectIds.includes(s.id))
        .map((s) => ({ subject_id: s.id, subjects: s }))

      const newStudentObj: Student = {
        id: `s-${Date.now()}`,
        student_code: formCode.trim().toUpperCase(),
        full_name: formName.trim(),
        class_name: formClass.trim(),
        board: formBoard.trim(),
        batch_id: formBatchId,
        is_active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        batches: selectedBatch,
        student_subjects: selectedSubs
      }
      setStudents([newStudentObj, ...students])
    }

    setFormCode('')
    setFormName('')
    setFormBatchId('')
    setFormSubjectIds([])
    setIsAddModalOpen(false)
  }

  // Normalizer to extract case-insensitive fields from CSV row
  const getCsvValue = (row: any, candidates: string[]): string => {
    const keys = Object.keys(row)
    for (const cand of candidates) {
      const foundKey = keys.find(k => k.trim().toLowerCase() === cand.toLowerCase())
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
        return String(row[foundKey]).trim()
      }
    }
    return ''
  }

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data)
        setIsCsvModalOpen(true)
        if (fileInputRef.current) fileInputRef.current.value = ''
      },
      error: (err) => {
        alert(formatUserError(err, 'CSV Parse Error'))
      }
    })
  }

  const handleDownloadTemplate = () => {
    const templateContent = `Student Code,Name,Class,Board,Batch,Subjects
SHK-PUB-0001,Sweta Sharma,10,ICSE,10 ICSE B,"Physics, Mathematics, Chemistry"
SHK-PUB-0002,Akash Mondal,9,ICSE,9 ICSE E,"Physics, Chemistry, Mathematics, Biology, Computer Science"
SHK-PUB-0003,Adhi Yadav,9,ICSE,9 ICSE E,"Physics, Chemistry, Biology, Computer Science"
SHK-PUB-0004,Avideepta Daphadar,9,ICSE,9 ICSE C,"Physics, Mathematics, Chemistry, Biology, Computer Science"
SHK-PUB-0005,Arhan Pani,9,ICSE,9 ICSE C,"Mathematics, Physics, Chemistry, Biology"
SHK-PUB-0006,Ayush Sikder,9,ICSE,9 ICSE C,"Physics, Mathematics, Computer Science, Chemistry, Biology"
SHK-PUB-0007,Anish Bala,9,ICSE,9 ICSE C,Computer Science
SHK-PUB-0008,Ayush Mondal,9,ICSE,9 ICSE C,"Physics, Chemistry, Mathematics, Biology, Computer Science"
SHK-PUB-0009,Aryan Choudhury,9,ICSE,9 ICSE D,"Physics, Chemistry, Biology"
SHK-PUB-0010,Abhraneel Bagui,9,CBSE,9 CBSE A,Physics
SHK-PUB-0011,Arish Mondal,9,ICSE,9 ICSE C,"Physics, Mathematics, Chemistry, Biology"
SHK-PUB-0012,Anushka Das Mahapatra,9,CBSE,9 CBSE A,"Physics, Mathematics, Chemistry, Biology"
SHK-PUB-0014,Abhinaba Garai,9,ICSE,9 ICSE E,"Physics, Mathematics, Chemistry, Biology, Computer Science"
SHK-PUB-0015,Aahan Chandak,9,CBSE,9 CBSE A,"Physics, Mathematics, Computer Science, Chemistry, Biology"`

    const blob = new Blob([templateContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'student-roster-template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Parse subjects matching institute naming
  const parseSubjectEnrollments = (subjectString: string): Subject[] => {
    if (!subjectString) return []
    const items = subjectString
      .split(/[,;|]/)
      .map((s) => s.trim())
      .filter(Boolean)

    const matched: Subject[] = []
    items.forEach((item) => {
      const cleanItem = item.toLowerCase()
      let found = subjects.find((s) => s.name.toLowerCase() === cleanItem)
      if (!found) {
        const slugAttempt = cleanItem.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        found = subjects.find((s) => s.slug === slugAttempt)
      }
      if (!found) {
        const baseName = cleanItem.replace(/\(board\)/i, '').trim()
        found = subjects.find((s) => s.name.toLowerCase().includes(baseName) || s.slug.includes(baseName))
      }

      if (found && !matched.some((m) => m.id === found!.id)) {
        matched.push(found)
      }
    })

    return matched
  }

  const handleConfirmCsvImport = async () => {
    setIsImporting(true)
    try {
      const newOnboarded: Student[] = []

      for (let idx = 0; idx < csvData.length; idx++) {
        const row = csvData[idx]
        const studentCode = (
          getCsvValue(row, ['Student Code', 'student_code', 'code', 'roll_no', 'roll']) ||
          `SHK-PUB-${String(idx + 1).padStart(4, '0')}`
        ).toUpperCase()
        const fullName = getCsvValue(row, ['Name', 'full_name', 'student_name']) || 'Enrolled Student'
        const className = getCsvValue(row, ['Class', 'class_name', 'grade', 'standard']) || '10'
        const board = getCsvValue(row, ['Board', 'board_name']) || 'ICSE'
        const batchName = getCsvValue(row, ['Batch', 'batch_name', 'section']) || `${className} ${board} A`

        // Match existing batch
        let matchedBatch = batches.find(
          (b) =>
            b.name.trim().toLowerCase() === batchName.trim().toLowerCase() ||
            (b.class_name === className && b.board === board)
        )

        let actualBatchId: string | null = matchedBatch ? matchedBatch.id : null

        if (isSupabaseConfigured()) {
          try {
            if (!actualBatchId) {
              const { data: createdB } = await supabase
                .from('batches')
                .insert({ name: batchName, class_name: className, board: board })
                .select()
                .single()
              if (createdB) actualBatchId = createdB.id
            }

            const { data: stRow, error: stErr } = await supabase
              .from('students')
              .upsert({
                student_code: studentCode,
                full_name: fullName,
                class_name: className,
                board: board,
                batch_id: actualBatchId,
                is_active: true,
                must_change_password: true
              }, { onConflict: 'student_code' })
              .select()
              .single()

            const subjectStr = getCsvValue(row, ['Subjects', 'subjects', 'subject', 'stream'])
            const matchedSubs = parseSubjectEnrollments(subjectStr)

            if (!stErr && stRow && matchedSubs.length > 0) {
              await supabase.from('student_subjects').delete().eq('student_id', stRow.id)
              const links = matchedSubs.map((s) => ({
                student_id: stRow.id,
                subject_id: s.id
              }))
              await supabase.from('student_subjects').insert(links)
            }
          } catch (e) {
            console.error('Failed to sync student to Supabase:', e)
          }
        }

        const subjectStr = getCsvValue(row, ['Subjects', 'subjects', 'subject', 'stream'])
        const matchedSubs = parseSubjectEnrollments(subjectStr)

        newOnboarded.push({
          id: `csv-${Date.now()}-${idx}`,
          student_code: studentCode,
          full_name: fullName,
          class_name: className,
          board: board,
          batch_id: actualBatchId,
          is_active: true,
          must_change_password: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          batches: matchedBatch,
          student_subjects: matchedSubs.map((s) => ({ subject_id: s.id, subjects: s }))
        })
      }

      if (isSupabaseConfigured()) {
        await fetchStudents()
      } else {
        setStudents([...newOnboarded, ...students])
      }

      setIsCsvModalOpen(false)
      setCsvData([])
      alert(`Successfully processed and imported ${newOnboarded.length} students into roster.`)
    } catch (err: any) {
      alert(formatUserError(err, 'Student Import Error'))
    } finally {
      setIsImporting(false)
    }
  }

  const filteredStudents = students.filter((s) => {
    const matchesSearch =
      s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.student_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.batches?.name || '').toLowerCase().includes(searchQuery.toLowerCase())

    const studentBoard = s.board || s.batches?.board || ''
    const matchesBoard = filterBoard === 'all' || studentBoard.toUpperCase() === filterBoard.toUpperCase()

    const studentClass = s.class_name || s.batches?.class_name || ''
    const matchesClass = filterClass === 'all' || studentClass === filterClass

    const matchesBatch = filterBatch === 'all' || s.batch_id === filterBatch

    return matchesSearch && matchesBoard && matchesClass && matchesBatch
  }).sort((a, b) =>
    a.student_code.localeCompare(b.student_code, undefined, { numeric: true, sensitivity: 'base' })
  )

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Student Roster"
        subtitle="Manage student credentials, board alignments (ICSE/CBSE), batches, and individual subject enrollments"
        actions={
          <>
            <button className="btn-secondary" onClick={handleDownloadTemplate} title="Download standard CSV template">
              <Download size={16} />
              Download Template
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCsvUpload}
            />
            <button className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <FileSpreadsheet size={16} />
              Import CSV
            </button>
            <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={16} />
              Add Student
            </button>
          </>
        }
      />

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Search & Multi-Filter Bar */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }}
            />
            <input
              type="text"
              placeholder="Search by student code (e.g. SHK-PUB-0001), name, or batch..."
              className="input-field"
              style={{ paddingLeft: '38px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter by Board */}
          {availableBoards.length > 0 && (
            <select
              className="input-field"
              style={{ width: '150px' }}
              value={filterBoard}
              onChange={(e) => {
                setFilterBoard(e.target.value)
                setFilterBatch('all')
              }}
            >
              <option value="all">All Boards</option>
              {availableBoards.map((brd) => (
                <option key={brd} value={brd}>
                  {brd}
                </option>
              ))}
            </select>
          )}

          {/* Filter by Class */}
          {availableClasses.length > 0 && (
            <select
              className="input-field"
              style={{ width: '150px' }}
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value)
                setFilterBatch('all')
              }}
            >
              <option value="all">All Classes</option>
              {availableClasses.map((cls) => (
                <option key={cls} value={cls}>
                  Class {cls}
                </option>
              ))}
            </select>
          )}

          {/* Filter by Batch */}
          {batches.length > 0 && (
            <select
              className="input-field"
              style={{ width: '220px' }}
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
            >
              <option value="all">All Batches</option>
              {batches
                .filter(
                  (b) =>
                    (filterClass === 'all' || b.class_name === filterClass) &&
                    (filterBoard === 'all' || !b.board || b.board.toUpperCase() === filterBoard.toUpperCase())
                )
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          )}

          {isLoading && (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</span>
          )}
        </div>

        {/* Student Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table-container">
            <thead>
              <tr>
                <th style={{ width: '13%' }}>Student Code</th>
                <th style={{ width: '17%' }}>Name</th>
                <th style={{ width: '8%' }}>Class</th>
                <th style={{ width: '9%' }}>Board</th>
                <th style={{ width: '15%' }}>Batch</th>
                <th style={{ width: '24%' }}>Enrolled Subjects</th>
                <th style={{ width: '6%' }}>Status</th>
                <th style={{ width: '8%', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length > 0 ? (
                filteredStudents.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '13px',
                          color: 'var(--accent-primary)',
                          fontWeight: 600
                        }}
                      >
                        {st.student_code}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500 }}>{st.full_name}</span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: 'var(--surface-raised)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          fontWeight: 600
                        }}
                      >
                        {st.class_name || st.batches?.class_name || '—'}
                      </span>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          backgroundColor: (st.board || st.batches?.board) === 'CBSE' ? 'rgba(255, 179, 0, 0.12)' : 'rgba(91, 141, 239, 0.12)',
                          color: (st.board || st.batches?.board) === 'CBSE' ? 'var(--accent-primary)' : '#5B8DEF',
                          border: `1px solid ${(st.board || st.batches?.board) === 'CBSE' ? 'rgba(255, 179, 0, 0.3)' : 'rgba(91, 141, 239, 0.3)'}`,
                          fontWeight: 600
                        }}
                      >
                        {st.board || st.batches?.board || 'ICSE'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {st.batches?.name || 'Unassigned'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {st.student_subjects && st.student_subjects.length > 0 ? (
                          st.student_subjects.map((ss) => (
                            <span
                              key={ss.subject_id}
                              className="badge"
                              style={{
                                backgroundColor: 'var(--surface-raised)',
                                border: `1px solid ${ss.subjects?.color || '#3A3A3F'}`,
                                color: ss.subjects?.color || 'var(--text-secondary)',
                                fontSize: '11px'
                              }}
                            >
                              {ss.subjects?.name || 'Subject'}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>None</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {st.is_active ? (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'rgba(46, 204, 113, 0.1)',
                            color: 'var(--success)',
                            border: '1px solid rgba(46, 204, 113, 0.3)'
                          }}
                        >
                          Active
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: 'rgba(255, 77, 77, 0.1)',
                            color: 'var(--danger)',
                            border: '1px solid rgba(255, 77, 77, 0.3)'
                          }}
                        >
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                        <button
                          onClick={() => handleResetPassword(st.student_code)}
                          title="Reset Password"
                          className="btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => handleToggleActive(st.id, st.is_active)}
                          title={st.is_active ? 'Deactivate Student' : 'Activate Student'}
                          className={st.is_active ? 'btn-danger' : 'btn-secondary'}
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                        >
                          {st.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button
                          onClick={() => handleDeleteStudent(st.id, st.full_name)}
                          title="Delete Student from Database"
                          className="btn-danger"
                          style={{ padding: '6px 8px', fontSize: '12px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5, display: 'block' }} />
                    <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                      No Students in Database
                    </div>
                    <div style={{ fontSize: '13px' }}>
                      Import your student roster CSV or click "Add Student" to enroll students.
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Single Student Modal */}
      {isAddModalOpen && (
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
          <div className="card" style={{ width: '520px', backgroundColor: 'var(--surface-raised)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Add New Student</h3>
            <form onSubmit={handleAddStudent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Student Code (Login ID)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. SHK-PUB-0016"
                    className="input-field"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Priyanshu Mukherjee"
                    className="input-field"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Class
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10 or 9"
                    className="input-field"
                    value={formClass}
                    onChange={(e) => setFormClass(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Board
                  </label>
                  <select
                    className="input-field"
                    value={formBoard}
                    onChange={(e) => setFormBoard(e.target.value)}
                  >
                    <option value="ICSE">ICSE</option>
                    <option value="CBSE">CBSE</option>
                    <option value="WBBSE">WBBSE</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Assigned Batch
                </label>
                <select
                  className="input-field"
                  value={formBatchId}
                  onChange={(e) => setFormBatchId(e.target.value)}
                  required
                >
                  <option value="">Select a batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.board ? `(${b.board})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Enrolled Subjects
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {subjects.map((sub) => {
                    const isChecked = formSubjectIds.includes(sub.id)
                    return (
                      <div
                        key={sub.id}
                        onClick={() =>
                          setFormSubjectIds((prev) =>
                            isChecked ? prev.filter((id) => id !== sub.id) : [...prev, sub.id]
                          )
                        }
                        style={{
                          padding: '8px 12px',
                          borderRadius: '6px',
                          border: `1px solid ${isChecked ? sub.color : 'var(--border)'}`,
                          backgroundColor: isChecked ? 'var(--surface-hover)' : 'var(--surface-card)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '13px'
                        }}
                      >
                        <span style={{ color: isChecked ? sub.color : 'var(--text-primary)' }}>{sub.name}</span>
                        {isChecked && <Check size={14} style={{ color: sub.color }} />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Preview & Confirm Modal */}
      {isCsvModalOpen && (
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
          <div className="card" style={{ width: '760px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Import Students from CSV
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Previewing {csvData.length} records parsed from uploaded file. Subjects and batches will be automatically resolved.
            </p>

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <table className="table-container">
                <thead>
                  <tr>
                    <th>Student Code</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Board</th>
                    <th>Batch</th>
                    <th>Subjects</th>
                  </tr>
                </thead>
                <tbody>
                  {csvData.slice(0, 10).map((row, idx) => {
                    const code = getCsvValue(row, ['Student Code', 'student_code', 'code', 'roll_no']) || `AUTO-${idx+1}`
                    const name = getCsvValue(row, ['Name', 'full_name', 'student_name']) || 'Unnamed'
                    const cls = getCsvValue(row, ['Class', 'class_name', 'grade', 'standard']) || '10'
                    const brd = getCsvValue(row, ['Board', 'board_name']) || 'ICSE'
                    const btc = getCsvValue(row, ['Batch', 'batch_name', 'section']) || `${cls} ${brd} A`
                    const subStr = getCsvValue(row, ['Subjects', 'subjects', 'subject', 'stream'])
                    const parsedSubs = parseSubjectEnrollments(subStr)

                    return (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{code}</td>
                        <td style={{ fontWeight: 500 }}>{name}</td>
                        <td>
                          <span className="badge" style={{ backgroundColor: 'var(--surface-raised)' }}>
                            {cls}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ backgroundColor: 'var(--surface-raised)', color: brd === 'CBSE' ? 'var(--accent-primary)' : '#5B8DEF' }}>
                            {brd}
                          </span>
                        </td>
                        <td>{btc}</td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                            {parsedSubs.map((s) => (
                              <span
                                key={s.id}
                                className="badge"
                                style={{
                                  fontSize: '10px',
                                  padding: '1px 6px',
                                  border: `1px solid ${s.color}`,
                                  color: s.color
                                }}
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {csvData.length > 10 && (
                <div style={{ padding: '10px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                  + {csvData.length - 10} more rows
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn-secondary" onClick={() => setIsCsvModalOpen(false)} disabled={isImporting}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleConfirmCsvImport} disabled={isImporting}>
                {isImporting ? 'Importing...' : `Confirm Import (${csvData.length} Students)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
