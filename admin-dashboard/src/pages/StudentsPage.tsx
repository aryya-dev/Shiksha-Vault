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
  Users,
  Copy,
  CheckCheck,
  Pencil
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

  // Find the Foundation Batch if present
  const foundationBatch = batches.find(
    (b) => b.board === 'Foundation' || b.name.toLowerCase().includes('foundation')
  )

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

  // Password Reset Modal State
  const [resetModalStudent, setResetModalStudent] = useState<Student | null>(null)
  const [resetPasswordInput, setResetPasswordInput] = useState('Shiksha@123')
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccessData, setResetSuccessData] = useState<{ studentCode: string; newPassword: string } | null>(null)
  const [copiedPassword, setCopiedPassword] = useState(false)

  // Add Student Form State
  const [formCode, setFormCode] = useState('')
  const [formName, setFormName] = useState('')
  const [formClass, setFormClass] = useState('9')
  const [formBoard, setFormBoard] = useState('ICSE')
  const [formBatchId, setFormBatchId] = useState('')
  const [formIsFoundation, setFormIsFoundation] = useState(false)
  const [formSubjectIds, setFormSubjectIds] = useState<string[]>([])

  // Edit Student Modal State
  const [editModalStudent, setEditModalStudent] = useState<Student | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editClass, setEditClass] = useState('9')
  const [editBoard, setEditBoard] = useState('ICSE')
  const [editBatchId, setEditBatchId] = useState('')
  const [editIsFoundation, setEditIsFoundation] = useState(false)
  const [editSubjectIds, setEditSubjectIds] = useState<string[]>([])
  const [editIsActive, setEditIsActive] = useState(true)
  const [isSavingEdit, setIsSavingEdit] = useState(false)

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
      
      // Filter out foundation-batch from regular subjects list
      const validSubjects = (sData || []).filter(
        (s) => s.slug !== 'foundation-batch' && !s.name.toLowerCase().includes('foundation')
      )
      setSubjects(validSubjects)

      let stData: any[] | null = null

      // Disambiguate batches foreign key using batches!students_batch_id_fkey
      const fullRes = await supabase
        .from('students')
        .select(`
          *,
          batches:batches!students_batch_id_fkey (*),
          student_batches (
            batch_id,
            batches (*)
          ),
          student_subjects (
            subject_id,
            subjects (*)
          )
        `)
        .order('student_code', { ascending: true })

      if (!fullRes.error) {
        stData = fullRes.data
      } else {
        console.warn('Full student join query failed, falling back to base join:', fullRes.error)
        const fallbackRes = await supabase
          .from('students')
          .select(`
            *,
            batches:batches!students_batch_id_fkey (*),
            student_subjects (
              subject_id,
              subjects (*)
            )
          `)
          .order('student_code', { ascending: true })

        if (fallbackRes.error) {
          console.warn('Fallback join failed, using direct students select with in-memory batch mapping:', fallbackRes.error)
          const simpleRes = await supabase
            .from('students')
            .select('*')
            .order('student_code', { ascending: true })

          if (simpleRes.error) throw simpleRes.error

          const batchMap = new Map((bData || []).map((b) => [b.id, b]))
          stData = (simpleRes.data || []).map((st) => ({
            ...st,
            batches: st.batch_id ? batchMap.get(st.batch_id) : undefined
          }))
        } else {
          stData = fallbackRes.data
        }
      }

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

  const openResetModal = (student: Student) => {
    setResetModalStudent(student)
    setResetPasswordInput('Shiksha@123')
    setResetSuccessData(null)
    setCopiedPassword(false)
  }

  const handleExecuteReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetModalStudent) return
    const newPass = resetPasswordInput.trim()
    if (newPass.length < 6) {
      alert('Password must be at least 6 characters long.')
      return
    }

    setIsResetting(true)
    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.rpc('admin_reset_student_password', {
          p_student_id: resetModalStudent.id,
          p_new_password: newPass
        })

        if (error) throw error
      }

      setResetSuccessData({
        studentCode: resetModalStudent.student_code,
        newPassword: newPass
      })
      await fetchStudents()
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to reset student password'))
    } finally {
      setIsResetting(false)
    }
  }

  const handleCopyPassword = (pwd: string) => {
    navigator.clipboard.writeText(pwd)
    setCopiedPassword(true)
    setTimeout(() => setCopiedPassword(false), 2500)
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

        if (formIsFoundation && foundationBatch && newStudent) {
          await supabase.from('student_batches').insert({
            student_id: newStudent.id,
            batch_id: foundationBatch.id
          })
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
    setFormIsFoundation(false)
    setFormSubjectIds([])
    setIsAddModalOpen(false)
  }

  const openEditModal = (st: Student) => {
    setEditModalStudent(st)
    setEditName(st.full_name)
    setEditCode(st.student_code)
    setEditClass(st.class_name || st.batches?.class_name || '9')
    setEditBoard(st.board || st.batches?.board || 'ICSE')
    setEditBatchId(st.batch_id || '')
    const hasFoundation = Boolean(
      st.student_batches?.some(
        (sb) =>
          sb.batch_id === foundationBatch?.id ||
          sb.batches?.board === 'Foundation' ||
          sb.batches?.name.toLowerCase().includes('foundation')
      )
    )
    setEditIsFoundation(hasFoundation)
    setEditSubjectIds(st.student_subjects?.map((ss) => ss.subject_id) || [])
    setEditIsActive(st.is_active)
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editModalStudent || !editName.trim()) return

    setIsSavingEdit(true)
    try {
      if (isSupabaseConfigured()) {
        // 1. Update students table
        const { error: stErr } = await supabase
          .from('students')
          .update({
            full_name: editName.trim(),
            class_name: editClass.trim(),
            board: editBoard.trim(),
            batch_id: editBatchId || null,
            is_active: editIsActive,
            updated_at: new Date().toISOString()
          })
          .eq('id', editModalStudent.id)

        if (stErr) throw stErr

        // 2. Sync secondary batches (student_batches)
        await supabase.from('student_batches').delete().eq('student_id', editModalStudent.id)
        if (editIsFoundation && foundationBatch && editBatchId !== foundationBatch.id) {
          await supabase.from('student_batches').insert({
            student_id: editModalStudent.id,
            batch_id: foundationBatch.id
          })
        }

        // 3. Sync student_subjects
        await supabase.from('student_subjects').delete().eq('student_id', editModalStudent.id)
        if (editSubjectIds.length > 0) {
          const subLinks = editSubjectIds.map((sId) => ({
            student_id: editModalStudent.id,
            subject_id: sId
          }))
          await supabase.from('student_subjects').insert(subLinks)
        }

        await fetchStudents()
      } else {
        setStudents((prev) =>
          prev.map((s) =>
            s.id === editModalStudent.id
              ? {
                  ...s,
                  full_name: editName.trim(),
                  class_name: editClass.trim(),
                  board: editBoard.trim(),
                  batch_id: editBatchId || null,
                  is_active: editIsActive,
                  student_subjects: subjects
                    .filter((sub) => editSubjectIds.includes(sub.id))
                    .map((sub) => ({ subject_id: sub.id, subjects: sub }))
                }
              : s
          )
        )
      }

      setEditModalStudent(null)
    } catch (err: any) {
      alert(formatUserError(err, 'Failed to update student details'))
    } finally {
      setIsSavingEdit(false)
    }
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
                      <div>
                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {st.batches?.name || 'Unassigned'}
                        </span>
                        {st.student_batches && st.student_batches.some((sb) => 
                          sb.batch_id === foundationBatch?.id || 
                          sb.batches?.board === 'Foundation' || 
                          sb.batches?.name.toLowerCase().includes('foundation')
                        ) && (
                          <div style={{ marginTop: '4px' }}>
                            <span
                              className="badge"
                              style={{
                                backgroundColor: 'rgba(255, 159, 28, 0.15)',
                                color: '#FF9F1C',
                                border: '1px solid rgba(255, 159, 28, 0.4)',
                                fontSize: '11px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              ⚡ Foundation Batch
                            </span>
                          </div>
                        )}
                      </div>
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
                          onClick={() => openEditModal(st)}
                          title="Manage Student Batches & Subjects"
                          className="btn-secondary"
                          style={{ padding: '6px 8px', fontSize: '12px', color: 'var(--accent-primary)' }}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => openResetModal(st)}
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
                  Assigned Batch (Primary)
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

              {/* Secondary Batch Option: Foundation Batch */}
              {foundationBatch && (
                <div
                  onClick={() => setFormIsFoundation(!formIsFoundation)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: `1px solid ${formIsFoundation ? '#FF9F1C' : 'var(--border)'}`,
                    backgroundColor: formIsFoundation ? 'rgba(255, 159, 28, 0.08)' : 'var(--surface-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '18px' }}>⚡</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: formIsFoundation ? '#FF9F1C' : 'var(--text-primary)' }}>
                        Also Enroll in Foundation Batch (Secondary Batch)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Student can switch between Primary Batch and Foundation Batch in the mobile app.
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '4px',
                      border: `1px solid ${formIsFoundation ? '#FF9F1C' : 'var(--border)'}`,
                      backgroundColor: formIsFoundation ? '#FF9F1C' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000',
                      flexShrink: 0
                    }}
                  >
                    {formIsFoundation && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>
              )}

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

      {/* Edit Student Modal */}
      {editModalStudent && (
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
          <div className="card" style={{ width: '560px', maxHeight: '90vh', overflowY: 'auto', backgroundColor: 'var(--surface-raised)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 600 }}>Manage Student</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Code: <strong style={{ color: 'var(--accent-primary)' }}>{editModalStudent.student_code}</strong>
                </div>
              </div>
              <span
                className="badge"
                style={{
                  backgroundColor: editIsActive ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255, 77, 77, 0.1)',
                  color: editIsActive ? 'var(--success)' : 'var(--danger)',
                  border: `1px solid ${editIsActive ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255, 77, 77, 0.3)'}`
                }}
              >
                {editIsActive ? 'Account Active' : 'Account Deactivated'}
              </span>
            </div>

            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Student Code (Login ID)
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editCode}
                    disabled
                    style={{ opacity: 0.7, cursor: 'not-allowed' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                    className="input-field"
                    value={editClass}
                    onChange={(e) => setEditClass(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Board
                  </label>
                  <select
                    className="input-field"
                    value={editBoard}
                    onChange={(e) => setEditBoard(e.target.value)}
                  >
                    <option value="ICSE">ICSE</option>
                    <option value="CBSE">CBSE</option>
                    <option value="WBBSE">WBBSE</option>
                    <option value="Foundation">Foundation</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Primary School Batch
                </label>
                <select
                  className="input-field"
                  value={editBatchId}
                  onChange={(e) => setEditBatchId(e.target.value)}
                  required
                >
                  <option value="">Select primary batch...</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.board ? `(${b.board})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* SECONDARY BATCH: FOUNDATION BATCH */}
              {foundationBatch && (
                <div
                  onClick={() => setEditIsFoundation(!editIsFoundation)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '8px',
                    border: `1px solid ${editIsFoundation ? '#FF9F1C' : 'var(--border)'}`,
                    backgroundColor: editIsFoundation ? 'rgba(255, 159, 28, 0.09)' : 'var(--surface-card)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '20px' }}>⚡</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: editIsFoundation ? '#FF9F1C' : 'var(--text-primary)' }}>
                        Enroll in Foundation Batch (Secondary Batch)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        This student will see a batch switcher in the app to toggle between {editModalStudent.batches?.name || 'Primary Batch'} and Foundation Batch.
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '5px',
                      border: `1px solid ${editIsFoundation ? '#FF9F1C' : 'var(--border)'}`,
                      backgroundColor: editIsFoundation ? '#FF9F1C' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000',
                      flexShrink: 0
                    }}
                  >
                    {editIsFoundation && <Check size={15} strokeWidth={3} />}
                  </div>
                </div>
              )}

              {/* ENROLLED SUBJECTS */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                    Enrolled Subjects (for primary batch)
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '12px', cursor: 'pointer' }}
                      onClick={() => setEditSubjectIds(subjects.map((s) => s.id))}
                    >
                      Select All
                    </button>
                    <span style={{ color: 'var(--text-muted)' }}>•</span>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer' }}
                      onClick={() => setEditSubjectIds([])}
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {subjects.map((sub) => {
                    const isChecked = editSubjectIds.includes(sub.id)
                    return (
                      <div
                        key={sub.id}
                        onClick={() =>
                          setEditSubjectIds((prev) =>
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
                          gap: '8px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div
                          style={{
                            width: '16px',
                            height: '16px',
                            borderRadius: '4px',
                            border: `1px solid ${isChecked ? sub.color : 'var(--text-muted)'}`,
                            backgroundColor: isChecked ? sub.color : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#000'
                          }}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                        <span style={{ fontSize: '13px', color: isChecked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {sub.name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* ACCOUNT ACTIVE STATUS */}
              <div
                onClick={() => setEditIsActive(!editIsActive)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface-card)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    Student Account Status
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {editIsActive ? 'Student can log in and view course materials' : 'Account deactivated — access denied'}
                  </div>
                </div>
                <span
                  className="badge"
                  style={{
                    backgroundColor: editIsActive ? 'rgba(46, 204, 113, 0.15)' : 'rgba(255, 77, 77, 0.15)',
                    color: editIsActive ? 'var(--success)' : 'var(--danger)',
                    border: `1px solid ${editIsActive ? 'rgba(46, 204, 113, 0.4)' : 'rgba(255, 77, 77, 0.4)'}`,
                    fontWeight: 600
                  }}
                >
                  {editIsActive ? 'Active' : 'Deactivated'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditModalStudent(null)}
                  disabled={isSavingEdit}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'Saving Changes...' : 'Save Student Changes'}
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

      {/* Real Password Reset Modal */}
      {resetModalStudent && (
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
          <div className="card" style={{ width: '460px', backgroundColor: 'var(--surface-raised)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(255, 179, 0, 0.15)',
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <KeyRound size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 600 }}>Reset Student Password</h3>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {resetModalStudent.full_name} ({resetModalStudent.student_code})
                </div>
              </div>
            </div>

            {resetSuccessData ? (
              <div>
                <div
                  style={{
                    backgroundColor: 'rgba(46, 204, 113, 0.12)',
                    border: '1px solid rgba(46, 204, 113, 0.3)',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '20px'
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--success)', marginBottom: '6px' }}>
                    Password Successfully Reset!
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '12px' }}>
                    Student <strong>{resetSuccessData.studentCode}</strong> can now log in using this password:
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'var(--surface-card)',
                      padding: '10px 14px',
                      borderRadius: '6px',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <code style={{ fontSize: '15px', fontWeight: 600, color: 'var(--accent-primary)', letterSpacing: '0.05em' }}>
                      {resetSuccessData.newPassword}
                    </code>
                    <button
                      className="btn-secondary"
                      style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={() => handleCopyPassword(resetSuccessData.newPassword)}
                    >
                      {copiedPassword ? <CheckCheck size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                      {copiedPassword ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                    * The student will be prompted to create their own new password upon login.
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-primary" onClick={() => setResetModalStudent(null)}>
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleExecuteReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Enter a temporary password for this student. The default institute password is{' '}
                  <code style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Shiksha@123</code>.
                </p>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      New Temporary Password
                    </label>
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setResetPasswordInput('Shiksha@123')}
                    >
                      Use Default (Shiksha@123)
                    </button>
                  </div>
                  <input
                    type="text"
                    className="input-field"
                    value={resetPasswordInput}
                    onChange={(e) => setResetPasswordInput(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setResetModalStudent(null)} disabled={isResetting}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={isResetting}>
                    {isResetting ? 'Resetting...' : 'Confirm Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

