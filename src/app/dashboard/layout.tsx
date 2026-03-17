// src/app/dashboard/layout.tsx

'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Users, ShoppingBag, CreditCard, LogOut,
  Menu, Receipt, RefreshCw, UserCircle, Wallet,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',               label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/dashboard/clientes',      label: 'Clientes',      icon: Users           },
  { href: '/dashboard/ventas',        label: 'Ventas',        icon: ShoppingBag     },
  { href: '/dashboard/pagos',         label: 'Pagos',         icon: CreditCard      },
  { href: '/dashboard/mantenimiento', label: 'Mantenimiento', icon: RefreshCw       },
  { href: '/dashboard/gastos',        label: 'Gastos',        icon: Receipt         },
  { href: '/dashboard/caja',          label: 'Caja',          icon: Wallet          },
  { href: '/dashboard/personas',      label: 'Personas',      icon: UserCircle      },
]

function SidebarContent({
  pathname, usuario, onLogout, onClose,
}: {
  pathname: string
  usuario: { nombre: string; email: string } | null
  onLogout: () => void
  onClose: () => void
}) {
  return (
    <div className="flex flex-col h-full bg-gray-950 border-r border-gray-800">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="w-9 h-9 rounded-xl bg-yellow-400 flex items-center justify-center flex-shrink-0">
          <LayoutDashboard className="w-5 h-5 text-gray-900" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">ERP Agencia</p>
          <p className="text-xs text-gray-500">Panel de gestión</p>
        </div>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link key={href} href={href} onClick={onClose}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                active
                  ? 'bg-yellow-400 text-gray-900'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          )
        })}
      </nav>
      <div className="px-4 pb-4 border-t border-gray-800 pt-4">
        {usuario && (
          <div className="px-4 py-2 mb-2">
            <p className="text-sm font-medium text-white">{usuario.nombre}</p>
            <p className="text-xs text-gray-500">{usuario.email}</p>
          </div>
        )}
        <button onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [usuario] = useState<{ nombre: string; email: string } | null>(() => {
    const u = typeof window !== 'undefined' ? localStorage.getItem('usuario') : null
    return u ? JSON.parse(u) : null
  })

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) router.push('/login')
  }, [router])

  function handleLogout() {
    localStorage.removeItem('token')
    localStorage.removeItem('usuario')
    router.push('/login')
  }

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <div className="hidden md:flex flex-col w-64 flex-shrink-0">
        <SidebarContent pathname={pathname} usuario={usuario} onLogout={handleLogout} onClose={() => {}} />
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50 w-64 h-full">
            <SidebarContent pathname={pathname} usuario={usuario} onLogout={handleLogout} onClose={() => setSidebarOpen(false)} />
          </div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="md:hidden flex items-center justify-between px-4 py-4 border-b border-gray-800 bg-gray-950">
          <button onClick={() => setSidebarOpen(true)} className="p-2 text-gray-400 hover:text-white">
            <Menu className="w-5 h-5" />
          </button>
          <p className="text-sm font-semibold text-white">ERP Agencia</p>
          <div className="w-9" />
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}