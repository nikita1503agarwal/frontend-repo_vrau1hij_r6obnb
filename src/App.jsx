import { useEffect, useMemo, useState } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

function Badge({ children, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
    yellow: 'bg-yellow-100 text-yellow-700',
  }
  return <span className={`px-2 py-1 rounded text-xs font-medium ${colors[color]}`}>{children}</span>
}

function StepForm({ step, onSubmit, submitting }) {
  const [form, setForm] = useState(step.form_data || {})

  const renderField = (f) => {
    const common = {
      className:
        'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
      value: form[f.key] ?? '',
      onChange: (e) => setForm((s) => ({ ...s, [f.key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })),
    }

    if (f.type === 'select') {
      return (
        <select {...common}>
          <option value="">Select...</option>
          {(f.options || []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )
    }

    if (f.type === 'checkbox') {
      return (
        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={!!form[f.key]} onChange={common.onChange} />
          <span className="text-sm text-gray-700">{f.label}</span>
        </label>
      )
    }

    return <input type={f.type || 'text'} placeholder={f.label} {...common} />
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(form)
      }}
      className="space-y-4"
    >
      {step.fields?.length ? (
        step.fields.map((f) => (
          <div key={f.key} className="space-y-1">
            {f.type !== 'checkbox' && <label className="text-sm font-medium text-gray-700">{f.label}</label>}
            {renderField(f)}
          </div>
        ))
      ) : (
        <p className="text-sm text-gray-500">No fields in this step.</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-md bg-blue-600 py-2 text-white font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
      >
        {submitting ? 'Submitting...' : 'Submit Step'}
      </button>
    </form>
  )
}

function App() {
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [tasks, setTasks] = useState([])
  const [creating, setCreating] = useState(false)
  const [activeTask, setActiveTask] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const baseFetch = async (path, options = {}) => {
    const res = await fetch(`${BACKEND}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  }

  const loadTasks = async () => {
    setLoading(true)
    try {
      const data = await baseFetch('/api/tasks')
      setTasks(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const seedTemplate = async () => {
    setSeeding(true)
    try {
      await baseFetch('/api/templates/seed', { method: 'POST' })
    } finally {
      setSeeding(false)
    }
  }

  const createTask = async () => {
    setCreating(true)
    try {
      const tmpl = await baseFetch('/api/templates/seed', { method: 'POST' })
      const created = await baseFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ template_id: tmpl.id, title: 'New Request' }),
      })
      setActiveTask(created)
      await loadTasks()
    } catch (e) {
      console.error(e)
    } finally {
      setCreating(false)
    }
  }

  const selectTask = async (id) => {
    const t = await baseFetch(`/api/tasks/${id}`)
    setActiveTask(t)
  }

  const submitStep = async (idx, data) => {
    if (!activeTask) return
    setSubmitting(true)
    try {
      await baseFetch(`/api/tasks/${activeTask.id}/steps/${idx}/submit`, {
        method: 'POST',
        body: JSON.stringify({ data }),
      })
      const updated = await baseFetch(`/api/tasks/${activeTask.id}`)
      setActiveTask(updated)
      await loadTasks()
    } finally {
      setSubmitting(false)
    }
  }

  const decide = async (idx, action) => {
    if (!activeTask) return
    setSubmitting(true)
    try {
      const updated = await baseFetch(`/api/tasks/${activeTask.id}/steps/${idx}/decision`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      })
      setActiveTask(updated)
      await loadTasks()
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [])

  const currentStepIndex = activeTask?.current_step_index ?? 0
  const steps = activeTask?.steps || []
  const currentStep = steps[currentStepIndex]

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-md">
        <header className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Task Approvals</h1>
          <span className="text-xs text-gray-500">Mobile-first</span>
        </header>

        {/* Actions */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={createTask}
            disabled={creating}
            className="flex-1 rounded-md bg-blue-600 py-2 text-white font-semibold shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {creating ? 'Creating...' : 'New Request'}
          </button>
          <button
            onClick={seedTemplate}
            disabled={seeding}
            className="rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-300 disabled:opacity-60"
          >
            {seeding ? 'Seeding...' : 'Seed Template'}
          </button>
        </div>

        {/* Task List */}
        <div className="space-y-2 mb-6">
          {loading ? (
            <div className="animate-pulse h-28 bg-white rounded-md shadow" />
          ) : tasks.length === 0 ? (
            <div className="rounded-md bg-white p-4 text-center text-sm text-gray-600 shadow">No requests yet. Tap "New Request".</div>
          ) : (
            tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTask(t.id)}
                className="w-full rounded-md bg-white p-4 text-left shadow hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">{t.title}</div>
                    <div className="text-xs text-gray-500">{new Date(t.created_at?.$date || Date.now()).toLocaleString()}</div>
                  </div>
                  <Badge color={t.status === 'approved' ? 'green' : t.status === 'rejected' ? 'red' : 'blue'}>
                    {t.status}
                  </Badge>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                  Step {t.current_step_index + 1} of {t.steps?.length || 0}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Active Task */}
        {activeTask && (
          <div className="rounded-lg bg-white p-4 shadow">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-gray-900">{activeTask.title}</div>
                <div className="text-xs text-gray-500">Step {currentStepIndex + 1} of {steps.length}</div>
              </div>
              <Badge color={activeTask.status === 'approved' ? 'green' : activeTask.status === 'rejected' ? 'red' : 'yellow'}>
                {activeTask.status}
              </Badge>
            </div>

            {/* Steps progress */}
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {steps.map((s, i) => (
                <div key={i} className={`flex-1 min-w-[60px] rounded-full px-2 py-1 text-center text-xs font-medium ${
                  i === currentStepIndex ? 'bg-blue-600 text-white' : s.status === 'approved' ? 'bg-green-100 text-green-700' : s.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {s.name}
                </div>
              ))}
            </div>

            {/* Current Step Form / Actions */}
            {currentStep && activeTask.status !== 'approved' && activeTask.status !== 'rejected' && (
              <div className="space-y-3">
                {currentStep.status === 'pending' && (
                  <StepForm step={currentStep} onSubmit={(data) => submitStep(currentStepIndex, data)} submitting={submitting} />
                )}
                {currentStep.status === 'in_review' && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => decide(currentStepIndex, 'approve')} disabled={submitting} className="rounded-md bg-green-600 py-2 text-white font-semibold shadow hover:bg-green-700 disabled:opacity-60">
                      Approve
                    </button>
                    <button onClick={() => decide(currentStepIndex, 'reject')} disabled={submitting} className="rounded-md bg-red-600 py-2 text-white font-semibold shadow hover:bg-red-700 disabled:opacity-60">
                      Reject
                    </button>
                  </div>
                )}
              </div>
            )}

            {(activeTask.status === 'approved' || activeTask.status === 'rejected') && (
              <div className="mt-3 rounded-md bg-gray-50 p-3 text-sm text-gray-700">Final status: {activeTask.status}</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
