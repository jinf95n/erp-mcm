// src/app/dashboard/personas/page.tsx

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, UserCircle } from 'lucide-react'
import { formatCurrency } from '@/src/lib/utils'

interface Persona {
  id: string
  nombre: string
  rol: string
  esSocio: boolean
  tipoCompensacion: string
  monto: number
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
}

const ROLES = ['ceo', 'cto', 'dev', 'pm', 'vendedor', 'otro']

const ROL_COLOR: Record<string, string> = {
  ceo:      'bg-yellow-900/40 text-yellow-400 border-yellow-700/40',
  cto:      'bg-orange-900/40 text-orange-400 border-orange-700/40',
  dev:      'bg-blue-900/40 text-blue-400 border-blue-700/40',
  pm:       'bg-purple-900/40 text-purple-400 border-purple-700/40',
  vendedor: 'bg-green-900/40 text-green-400 border-green-700/40',
  otro:     'bg-gray-800 text-gray-400 border-gray-700',
}

function getToken() { return typeof window !== 'undefined' ? localStorage.getItem('token') : '' }
function authH()    { return { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` } }

const FORM_VACIO = {
  nombre: '', rol: 'otro', esSocio: false,
  tipoCompensacion: 'ars', monto: '',
  email: '', telefono: '', notas: '',
}

function formatComp(tipo: string, monto: number) {
  if (tipo === 'porcentaje') return `${monto}%`
  if (tipo === 'usd')        return `USD ${monto}`
  return formatCurrency(monto)
}

export default function PersonasPage() {
  const [personas, setPersonas]   = useState<Persona[]>([])
  const [loading, setLoading]     = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando]   = useState<Persona | null>(null)
  const [form, setForm]           = useState(FORM_VACIO)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  const fetchPersonas = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/personas?activo=false', { headers: authH() })
      const data = await res.json()
      setPersonas(data.personas || [])
    } catch { setError('Error al cargar') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchPersonas() }, [fetchPersonas])

  function openCreate() {
    setEditando(null); setForm(FORM_VACIO); setError(''); setModalOpen(true)
  }
  function openEdit(p: Persona) {
    setEditando(p)
    setForm({
      nombre:           p.nombre,
      rol:              p.rol,
      esSocio:          p.esSocio,
      tipoCompensacion: p.tipoCompensacion,
      monto:            p.monto.toString(),
      email:            p.email    || '',
      telefono:         p.telefono || '',
      notas:            p.notas    || '',
    })
    setError(''); setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    try {
      const url    = editando ? `/api/personas/${editando.id}` : '/api/personas'
      const method = editando ? 'PUT' : 'POST'
      const res    = await fetch(url, { method, headers: authH(), body: JSON.stringify(form) })
      const data   = await res.json()
      if (!res.ok) { setError(data.error || 'Error al guardar'); return }
      setModalOpen(false); fetchPersonas()
    } catch { setError('Error de conexión') }
    finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/personas/${id}`, { method: 'DELETE', headers: authH() })
      setDeleteId(null); fetchPersonas()
    } catch { setError('Error al eliminar') }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Personas</h1>
          <p className="text-gray-400 text-sm mt-1">Equipo de la agencia</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-300 text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
          <Plus className="w-4 h-4" /> Nueva persona
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-3 mb-4">{error}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {personas.map(p => (
            <div key={p.id}
              className={`bg-gray-900 border rounded-2xl p-5 ${p.activo ? 'border-gray-800' : 'border-gray-800/40 opacity-60'}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center">
                    <span className="text-sm font-bold text-yellow-400">{p.nombre.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{p.nombre}</p>
                      {p.esSocio && (
                        <span className="text-xs bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 px-1.5 py-0.5 rounded-md">
                          socio
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{p.email || '—'}</p>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => openEdit(p)}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteId(p.id)}
                    className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-500 mb-1">Rol</p>
                  <span className={`inline-flex px-2 py-1 rounded-lg border uppercase text-xs ${ROL_COLOR[p.rol] || ROL_COLOR.otro}`}>
                    {p.rol}
                  </span>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Tipo cobro</p>
                  <p className="text-gray-300 capitalize">{p.tipoCompensacion}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Monto ref.</p>
                  <p className="text-yellow-400 font-medium">{formatComp(p.tipoCompensacion, p.monto)}</p>
                </div>
              </div>

              {p.notas && <p className="text-xs text-gray-600 mt-3 italic">{p.notas}</p>}
              {!p.activo && <p className="text-xs text-gray-600 mt-2">— Inactivo —</p>}
            </div>
          ))}

          {personas.length === 0 && (
            <div className="col-span-2 text-center py-16 text-gray-500">
              <UserCircle className="w-12 h-12 mx-auto mb-3 text-gray-700" />
              <p className="font-medium">No hay personas cargadas</p>
              <p className="text-sm mt-1">Agregá a los miembros del equipo</p>
            </div>
          )}
        </div>
      )}

      {/* ── Modal crear/editar ──────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">
                {editando ? 'Editar persona' : 'Nueva persona'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre *</label>
                <input type="text" value={form.nombre}
                  onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))}
                  placeholder="Juan"
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Rol</label>
                  <select value={form.rol}
                    onChange={e => setForm(p => ({ ...p, rol: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                    {ROLES.map(r => (
                      <option key={r} value={r}>{r.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Tipo compensación</label>
                  <select value={form.tipoCompensacion}
                    onChange={e => setForm(p => ({ ...p, tipoCompensacion: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400">
                    <option value="ars">ARS</option>
                    <option value="usd">USD</option>
                    <option value="porcentaje">%</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Monto referencial {form.tipoCompensacion === 'porcentaje' ? '(%)' : `(${form.tipoCompensacion.toUpperCase()})`}
                </label>
                <input type="number" value={form.monto}
                  onChange={e => setForm(p => ({ ...p, monto: e.target.value }))}
                  placeholder={form.tipoCompensacion === 'porcentaje' ? '20' : '78000'}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>

              {/* Toggle esSocio */}
              <div
                onClick={() => setForm(p => ({ ...p, esSocio: !p.esSocio }))}
                className="flex items-center justify-between bg-gray-800/60 border border-gray-700 rounded-xl px-4 py-3 cursor-pointer hover:border-gray-600 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-white">Es socio de la agencia</p>
                  <p className="text-xs text-gray-500 mt-0.5">Recibe el split de ganancia en cada venta</p>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${form.esSocio ? 'bg-yellow-400' : 'bg-gray-700'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.esSocio ? 'left-6' : 'left-1'}`} />
                </div>
              </div>

              {[
                { label: 'Email',     key: 'email',    placeholder: 'juan@agencia.com',    type: 'email' },
                { label: 'Teléfono', key: 'telefono', placeholder: '+54 9 11 0000-0000', type: 'tel'   },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{f.label}</label>
                  <input type={f.type}
                    value={form[f.key as keyof typeof form] as string}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
                </div>
              ))}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Notas</label>
                <input type="text" value={form.notas}
                  onChange={e => setForm(p => ({ ...p, notas: e.target.value }))}
                  placeholder="Ej: Maneja paid media, desarrollo backend..."
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-2.5 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400" />
              </div>

              {error && (
                <p className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-xl px-4 py-2.5">{error}</p>
              )}
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setModalOpen(false)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 bg-yellow-400 hover:bg-yellow-300 disabled:bg-yellow-800 text-gray-900 rounded-xl py-2.5 text-sm font-semibold transition-colors">
                {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear persona'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmar eliminar ──────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-white mb-2">¿Desactivar persona?</h3>
            <p className="text-gray-400 text-sm mb-6">
              La persona quedará inactiva pero se conserva el historial de distribuciones.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleDelete(deleteId)}
                className="flex-1 bg-red-600 hover:bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium transition-colors">
                Desactivar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}