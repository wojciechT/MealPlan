import { NavLink, Outlet } from 'react-router'
import { cx } from './components/ui'

const links = [
  { to: '/', label: 'Planner', end: true },
  { to: '/recipes', label: 'Recipes', end: false },
  { to: '/ingredients', label: 'Ingredients', end: false },
  { to: '/shopping', label: 'Shopping list', end: false },
]

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="font-semibold tracking-tight">MealPlan</span>
          <nav className="flex gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  cx(
                    'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive ? 'bg-accent-soft text-accent' : 'text-ink-soft hover:bg-surface-sunken hover:text-ink',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
