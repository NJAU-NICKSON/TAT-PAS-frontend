import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Stethoscope,
  User,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getNavigationForRole } from '../lib/nav';

export default function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!user) return null;

  const navItems = getNavigationForRole(user.role).flatMap(group => group.items);

  const isActive = (to: string) =>
    location.pathname === to || location.pathname.startsWith(`${to}/`);

  return (
    <header className="bg-[#1e3a5f] text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link
            to="/dashboard"
            className="flex items-center gap-2 font-bold text-xl hover:opacity-90 transition-opacity"
          >
            <Stethoscope className="h-6 w-6 text-blue-300" />
            <span className="tracking-tight">TAT-PAS</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                className={`
                  flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  ${isActive(item.path)
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-white leading-none">{user.full_name}</p>
              <p className="text-xs text-blue-200 capitalize mt-0.5">{user.role}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-400/30 flex items-center justify-center">
              <User className="h-4 w-4 text-blue-200" />
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-blue-200 hover:text-white hover:bg-white/10 transition-all duration-150"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>

          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-white/10 bg-[#162d4a]">
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-sm font-medium text-white">{user.full_name}</p>
            <p className="text-xs text-blue-200 capitalize">{user.role}</p>
          </div>
          <nav className="px-4 py-2 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive(item.path)
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="px-4 py-3 border-t border-white/10">
            <button
              onClick={() => { logout(); setMobileMenuOpen(false); }}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
