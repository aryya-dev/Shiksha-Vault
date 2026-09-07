import React, { useState, useEffect } from 'react'
import { Header } from '../components/Header'
import { Plus, BookOpen, Layers, Check, Trash2 } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatUserError } from '../lib/errorHandler'
import type { Batch, Subject } from '../types/database'

export const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<(Batch & { subjects: Subject[] })[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newBatchName, setNewBatchName] = useState('')
  const [newBatchClass, setNewBatchClass] = useState('10')
  const [newBatchBoard, setNewBatchBoard] = useState('ICSE')
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([])

  const fetchBatches = async () => {
    if (!isSupabaseConfigured()) {
      setBatches([])
      return
    }
    setIsLoading(true)
    try {
      const { data: batchData } = await supabase
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false })

      const { data: subData } = await supabase.from('subjects').select('*').order('name')
      const { data: batchSubData } = await supabase.from('batch_subjects').select('*')

      if (subData) setSubjects(subData)

      if (batchData) {
        const enriched = batchData.map((b) => {
          const bSubjectIds = (batchSubData || [])
            .filter((bs) => bs.batch_id === b.id)
            .map((bs) => bs.subject_id)
          const bSubjects = (subData || []).filter((s) => bSubjectIds.includes(s.id))
          return { ...b, subjects: bSubjects }
        })
        setBatches(enriched)
      } else {
        setBatches([])
      }
    } catch (err) {
      console.error('Error fetching batches:', err)
      setBatches([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBatches()
  }, [])

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newBatchName.trim()) return

    if (isSupabaseConfigured()) {
      try {
        const { data: newBatch, error } = await supabase
          .from('batches')
          .insert({
            name: newBatchName.trim(),
            class_name: newBatchClass.trim(),
            board: newBatchBoard.trim()
          })
          .select()
          .single()

        if (error) throw error

        if (selectedSubjectIds.length > 0 && newBatch) {
          const links = selectedSubjectIds.map((subId) => ({
            batch_id: newBatch.id,
            subject_id: subId
          }))
          await supabase.from('batch_subjects').insert(links)
        }
        await fetchBatches()
      } catch (err: any) {
        alert(formatUserError(err, 'Failed to create batch'))
      }
    } else {
      // Offline fallback
      const selectedSubs = subjects.filter((s) => selectedSubjectIds.includes(s.id))
      const newB: Batch & { subjects: Subject[] } = {
        id: `batch-${Date.now()}`,
        name: newBatchName.trim(),
        class_name: newBatchClass.trim(),
        board: newBatchBoard.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        subjects: selectedSubs
      }
      setBatches([newB, ...batches])
    }

    setNewBatchName('')
    setNewBatchClass('10')
    setNewBatchBoard('ICSE')
    setSelectedSubjectIds([])
    setIsModalOpen(false)
  }

  const handleDeleteBatch = async (batchId: string, batchName: string) => {
    if (!confirm(`Are you sure you want to delete batch "${batchName}"? This will permanently remove it from the database.`)) {
      return
    }

    if (isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('batches').delete().eq('id', batchId)
        if (error) throw error
        setBatches(batches.filter((b) => b.id !== batchId))
      } catch (err: any) {
        alert(formatUserError(err, 'Failed to delete batch'))
      }
    } else {
      setBatches(batches.filter((b) => b.id !== batchId))
    }
  }

  const toggleSubject = (id: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <Header
        title="Batches & Subjects"
        subtitle="Manage academic batches across classes, boards (ICSE, CBSE), and assign offered subjects"
        actions={
          <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} />
            Create Batch
          </button>
        }
      />

      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
        {/* Available Subjects Overview */}
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '14px', color: 'var(--text-secondary)' }}>
            INSTITUTE SUBJECTS ({subjects.length})
          </h3>
          {subjects.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
              {subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '14px 18px',
                    borderLeft: `4px solid ${sub.color}`
                  }}
                >
                  <BookOpen size={18} style={{ color: sub.color }} />
                  <div>
                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{sub.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{sub.slug}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              No subjects loaded from database.
            </div>
          )}
        </div>

        {/* Batches Table / List */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
              DATABASE BATCHES ({batches.length})
            </h3>
            {isLoading && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading...</span>}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="table-container">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Batch Name</th>
                  <th style={{ width: '12%' }}>Class</th>
                  <th style={{ width: '12%' }}>Board</th>
                  <th style={{ width: '38%' }}>Offered Subjects</th>
                  <th style={{ width: '13%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.length > 0 ? (
                  batches.map((batch) => (
                    <tr key={batch.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Layers size={16} style={{ color: 'var(--accent-primary)' }} />
                          <span style={{ fontWeight: 600 }}>{batch.name}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ backgroundColor: 'var(--surface-raised)' }}>
                          Class {batch.class_name || '—'}
                        </span>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor:
                              batch.board === 'CBSE'
                                ? 'rgba(255, 179, 0, 0.12)'
                                : 'rgba(91, 141, 239, 0.12)',
                            color: batch.board === 'CBSE' ? 'var(--accent-primary)' : '#5B8DEF'
                          }}
                        >
                          {batch.board || 'ICSE'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {batch.subjects && batch.subjects.length > 0 ? (
                            batch.subjects.map((s) => (
                              <span
                                key={s.id}
                                className="badge"
                                style={{
                                  backgroundColor: 'var(--surface-raised)',
                                  border: `1px solid ${s.color}`,
                                  color: s.color,
                                  fontSize: '11px'
                                }}
                              >
                                {s.name}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              No subjects assigned
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => handleDeleteBatch(batch.id, batch.name)}
                          title="Delete Batch from Database"
                          className="btn-danger"
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <Layers size={32} style={{ margin: '0 auto 12px auto', opacity: 0.5, display: 'block' }} />
                      <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        No Batches Found in Database
                      </div>
                      <div style={{ fontSize: '13px', marginBottom: '16px' }}>
                        You can create your batches manually by clicking "Create Batch" above.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal for creating a batch */}
      {isModalOpen && (
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
          <div className="card" style={{ width: '500px', backgroundColor: 'var(--surface-raised)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>Create New Batch</h3>
            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Batch Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10 ICSE B or 9 CBSE A"
                  className="input-field"
                  value={newBatchName}
                  onChange={(e) => setNewBatchName(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Class
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 10, 9, 11, 12"
                    className="input-field"
                    value={newBatchClass}
                    onChange={(e) => setNewBatchClass(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Board
                  </label>
                  <select
                    className="input-field"
                    value={newBatchBoard}
                    onChange={(e) => setNewBatchBoard(e.target.value)}
                  >
                    <option value="ICSE">ICSE</option>
                    <option value="CBSE">CBSE</option>
                    <option value="WBBSE">WBBSE</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Select Offered Subjects ({selectedSubjectIds.length} selected)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {subjects.map((sub) => {
                    const isSelected = selectedSubjectIds.includes(sub.id)
                    return (
                      <div
                        key={sub.id}
                        onClick={() => toggleSubject(sub.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '6px',
                          backgroundColor: isSelected ? 'var(--surface-hover)' : 'var(--surface-card)',
                          border: `1px solid ${isSelected ? sub.color : 'var(--border)'}`,
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: sub.color }} />
                          <span style={{ fontSize: '14px', fontWeight: 500 }}>{sub.name}</span>
                        </div>
                        {isSelected && <Check size={16} style={{ color: sub.color }} />}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
