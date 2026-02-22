/**
 * BatchBeltTest — Multi-student belt testing interface
 * 
 * Designed for Sifu to test up to 10 students simultaneously on a 12" screen.
 * Compact card-based UI with quick pass/fail scoring.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { promotionApi } from '../api/client';

// Score presets for quick grading
const SCORE_PRESETS = [
  { label: '100', value: 100, color: '#27ae60' },
  { label: '95', value: 95, color: '#2ecc71' },
  { label: '90', value: 90, color: '#58d68d' },
  { label: '85', value: 85, color: '#82e0aa' },
  { label: '80', value: 80, color: '#f39c12' },
  { label: '75', value: 75, color: '#e67e22' },
];

const PASS_THRESHOLD = 70;

export default function BatchBeltTest({ schoolId, onClose, onComplete }) {
  const [tests, setTests] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Selection state for adding students
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedEnrollments, setSelectedEnrollments] = useState([]);
  
  // Active testing session
  const [sessionTests, setSessionTests] = useState([]);
  const [sessionStarted, setSessionStarted] = useState(false);

  // Load data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e, p] = await Promise.all([
        promotionApi.getTests(schoolId),
        promotionApi.getEnrollments(schoolId),
        promotionApi.getPrograms({ schoolId }),
      ]);
      
      // Filter to only show SCHEDULED or IN_PROGRESS tests
      const activeTests = t.filter(test => 
        test.status === 'SCHEDULED' || test.status === 'IN_PROGRESS'
      );
      
      setTests(activeTests);
      setEnrollments(e);
      setPrograms(p);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Initialize session with selected tests
  const initSession = useCallback((testIds) => {
    const selectedTests = tests.filter(t => testIds.includes(t.id));
    setSessionTests(selectedTests.map(t => ({
      ...t,
      localScore: null,
      localStatus: t.status,
      notes: t.notes || '',
    })));
  }, [tests]);

  // Toggle test selection
  const toggleTestSelection = (testId) => {
    setSessionTests(prev => {
      const exists = prev.find(t => t.id === testId);
      if (exists) {
        return prev.filter(t => t.id !== testId);
      } else {
        const test = tests.find(t => t.id === testId);
        if (test && prev.length < 10) {
          return [...prev, { ...test, localScore: null, localStatus: test.status, notes: '' }];
        }
      }
      return prev;
    });
  };

  // Update local test state
  const updateTestLocal = (testId, updates) => {
    setSessionTests(prev => prev.map(t => 
      t.id === testId ? { ...t, ...updates } : t
    ));
  };

  // Quick score assignment
  const assignScore = (testId, score) => {
    updateTestLocal(testId, { 
      localScore: score, 
      localStatus: score >= PASS_THRESHOLD ? 'PASSED' : 'FAILED' 
    });
  };

  // Pass/Fail toggle
  const toggleResult = (testId, result) => {
    const test = sessionTests.find(t => t.id === testId);
    const newStatus = result;
    const newScore = result === 'PASSED' 
      ? (test.localScore || 85) 
      : (test.localScore || 0);
    updateTestLocal(testId, { localStatus: newStatus, localScore: newScore });
  };

  // Start all tests in session
  const startAllTests = async () => {
    setSessionStarted(true);
    try {
      await Promise.all(
        sessionTests
          .filter(t => t.localStatus === 'SCHEDULED')
          .map(t => promotionApi.updateTest(t.id, { status: 'IN_PROGRESS' }))
      );
      setSessionTests(prev => prev.map(t => ({
        ...t,
        localStatus: t.localStatus === 'SCHEDULED' ? 'IN_PROGRESS' : t.localStatus
      })));
    } catch (err) {
      setError(err.message);
    }
  };

  // Submit all results
  const submitAllResults = async () => {
    const toSubmit = sessionTests.filter(t => 
      t.localStatus === 'PASSED' || t.localStatus === 'FAILED'
    );
    
    if (toSubmit.length === 0) {
      setError('No tests marked as passed or failed');
      return;
    }

    try {
      await Promise.all(
        toSubmit.map(t => promotionApi.updateTest(t.id, { 
          status: t.localStatus, 
          score: t.localScore,
          notes: t.notes 
        }))
      );
      
      // Auto-promote passed students
      for (const t of toSubmit.filter(x => x.localStatus === 'PASSED')) {
        try {
          await promotionApi.promoteStudent(t.enrollment.id, { 
            toBeltId: t.beltId,
            notes: `Batch test - Score: ${t.localScore}%`
          });
        } catch { /* promotion may fail if already at this belt */ }
      }
      
      if (onComplete) onComplete();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  // Get belt info for an enrollment
  const getBeltInfo = (enrollment) => {
    const prog = programs.find(p => p.id === enrollment?.program?.id);
    const currentBelt = prog?.belts?.find(b => b.id === enrollment?.currentBeltId);
    const nextBelt = prog?.belts?.find(b => 
      b.displayOrder === (currentBelt?.displayOrder || 0) + 1
    );
    return { currentBelt, nextBelt, program: prog };
  };

  // Summary stats
  const stats = useMemo(() => {
    const passed = sessionTests.filter(t => t.localStatus === 'PASSED').length;
    const failed = sessionTests.filter(t => t.localStatus === 'FAILED').length;
    const pending = sessionTests.filter(t => t.localStatus === 'IN_PROGRESS' || t.localStatus === 'SCHEDULED').length;
    return { passed, failed, pending, total: sessionTests.length };
  }, [sessionTests]);

  if (loading) {
    return (
      <div className="batch-test-overlay">
        <div className="batch-test-container">
          <div className="loading">Loading test data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="batch-test-overlay">
      <div className="batch-test-container">
        {/* Header */}
        <div className="batch-test-header">
          <div className="batch-test-title">
            <h2>🥋 Batch Belt Testing</h2>
            <span className="batch-test-count">{sessionTests.length}/10 students</span>
          </div>
          <button className="btn btn-sm btn-outline" onClick={onClose}>✕ Close</button>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '0.5rem 0' }}>{error}</div>}

        {/* Stats Bar */}
        {sessionTests.length > 0 && (
          <div className="batch-test-stats">
            <span className="stat stat-pending">⏳ {stats.pending}</span>
            <span className="stat stat-passed">✅ {stats.passed}</span>
            <span className="stat stat-failed">❌ {stats.failed}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="batch-test-actions">
          {!sessionStarted && sessionTests.length > 0 && (
            <button className="btn btn-primary" onClick={startAllTests}>
              ▶ Start All Tests ({sessionTests.length})
            </button>
          )}
          {sessionStarted && (
            <button 
              className="btn btn-success" 
              onClick={submitAllResults}
              disabled={stats.pending === stats.total}
            >
              💾 Submit Results ({stats.passed + stats.failed}/{stats.total})
            </button>
          )}
          <button 
            className="btn btn-outline" 
            onClick={() => setShowAddPanel(!showAddPanel)}
          >
            {showAddPanel ? '▼ Hide List' : '+ Add Students'}
          </button>
        </div>

        {/* Test Selection Panel */}
        {showAddPanel && (
          <div className="batch-test-selection">
            <h4>Select Scheduled Tests</h4>
            <div className="batch-test-selection-list">
              {tests.length === 0 ? (
                <p style={{ color: '#888', textAlign: 'center', padding: '1rem' }}>
                  No scheduled tests. Schedule tests from the Tests tab first.
                </p>
              ) : tests.map(t => {
                const isSelected = sessionTests.some(st => st.id === t.id);
                return (
                  <label key={t.id} className={`selection-item ${isSelected ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleTestSelection(t.id)}
                      disabled={!isSelected && sessionTests.length >= 10}
                    />
                    <span className="selection-belt" style={{ backgroundColor: t.belt?.color || '#ccc' }} />
                    <span className="selection-name">
                      {t.enrollment?.student?.firstName} {t.enrollment?.student?.lastName}
                    </span>
                    <span className="selection-target">→ {t.belt?.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Student Test Cards */}
        <div className="batch-test-grid">
          {sessionTests.length === 0 ? (
            <div className="batch-test-empty">
              <p>No students selected for testing.</p>
              <p>Click "Add Students" to select from scheduled tests.</p>
            </div>
          ) : sessionTests.map(test => (
            <StudentTestCard
              key={test.id}
              test={test}
              sessionStarted={sessionStarted}
              onScoreChange={(score) => assignScore(test.id, score)}
              onToggleResult={(result) => toggleResult(test.id, result)}
              onNotesChange={(notes) => updateTestLocal(test.id, { notes })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Individual student test card — compact design for 12" screens
 */
function StudentTestCard({ test, sessionStarted, onScoreChange, onToggleResult, onNotesChange }) {
  const [showNotes, setShowNotes] = useState(false);
  
  const statusColors = {
    SCHEDULED: '#3498db',
    IN_PROGRESS: '#f39c12',
    PASSED: '#27ae60',
    FAILED: '#e74c3c',
  };

  const statusIcons = {
    SCHEDULED: '📋',
    IN_PROGRESS: '⏳',
    PASSED: '✅',
    FAILED: '❌',
  };

  return (
    <div 
      className={`student-test-card ${test.localStatus.toLowerCase()}`}
      style={{ borderColor: statusColors[test.localStatus] }}
    >
      {/* Student Info Header */}
      <div className="card-header-compact">
        <div className="student-info">
          <span className="student-name">
            {test.enrollment?.student?.firstName} {test.enrollment?.student?.lastName?.charAt(0)}.
          </span>
          <span className="status-icon">{statusIcons[test.localStatus]}</span>
        </div>
        <div className="belt-info">
          <span 
            className="belt-badge current" 
            style={{ backgroundColor: test.enrollment?.currentBelt?.color || '#ddd' }}
            title={test.enrollment?.currentBelt?.name || 'No belt'}
          />
          <span className="arrow">→</span>
          <span 
            className="belt-badge target" 
            style={{ backgroundColor: test.belt?.color || '#ddd' }}
            title={test.belt?.name}
          >
            {test.belt?.name?.split(' ')[0]}
          </span>
        </div>
      </div>

      {/* Score Section */}
      {sessionStarted && test.localStatus !== 'SCHEDULED' && (
        <div className="score-section">
          {/* Quick Score Buttons */}
          <div className="score-presets">
            {SCORE_PRESETS.map(preset => (
              <button
                key={preset.value}
                className={`score-btn ${test.localScore === preset.value ? 'active' : ''}`}
                style={{ 
                  backgroundColor: test.localScore === preset.value ? preset.color : 'transparent',
                  borderColor: preset.color,
                  color: test.localScore === preset.value ? '#fff' : preset.color,
                }}
                onClick={() => onScoreChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Score Input */}
          <div className="custom-score">
            <input
              type="number"
              min="0"
              max="100"
              value={test.localScore || ''}
              placeholder="0-100"
              onChange={(e) => onScoreChange(parseInt(e.target.value) || 0)}
              className="score-input"
            />
            <span className="score-unit">%</span>
          </div>

          {/* Pass/Fail Toggle */}
          <div className="result-toggle">
            <button
              className={`result-btn pass ${test.localStatus === 'PASSED' ? 'active' : ''}`}
              onClick={() => onToggleResult('PASSED')}
            >
              ✓ Pass
            </button>
            <button
              className={`result-btn fail ${test.localStatus === 'FAILED' ? 'active' : ''}`}
              onClick={() => onToggleResult('FAILED')}
            >
              ✗ Fail
            </button>
          </div>
        </div>
      )}

      {/* Waiting state */}
      {!sessionStarted && (
        <div className="waiting-state">
          <span>Ready to test</span>
        </div>
      )}

      {/* Notes Toggle */}
      {sessionStarted && (
        <div className="notes-section">
          <button 
            className="notes-toggle" 
            onClick={() => setShowNotes(!showNotes)}
          >
            📝 {showNotes ? 'Hide' : 'Notes'}
          </button>
          {showNotes && (
            <textarea
              className="notes-input"
              placeholder="Add notes..."
              value={test.notes}
              onChange={(e) => onNotesChange(e.target.value)}
              rows={2}
            />
          )}
        </div>
      )}
    </div>
  );
}
