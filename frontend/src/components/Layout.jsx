import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ChatPanel from "./ChatPanel";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "🏠" },
  { to: "/laporan", label: "Laporan", icon: "📊" },
  { to: "/import", label: "Import", icon: "📥" },
  { to: "/pengaturan", label: "Pengaturan", icon: "⚙️" },
];

export default function Layout() {
  const { user, perusahaan, logout } = useAuth();
  const [chatOpenMobile, setChatOpenMobile] = useState(false);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shrink-0">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-slate-900">
            {perusahaan?.nama || "Stok AI"}
          </h1>
          <p className="text-xs text-slate-500">{user?.nama} · {user?.role}</p>
        </div>
        <button
          onClick={logout}
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Keluar
        </button>
      </header>

      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-200 bg-white px-2 py-1.5 scrollbar-thin">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
              }`
            }
          >
            <span>{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <Outlet />
        </main>

        {/* Panel chat AI selalu terlihat di desktop */}
        <aside className="hidden w-96 shrink-0 border-l border-slate-200 bg-white lg:flex">
          <ChatPanel />
        </aside>
      </div>

      {/* Tombol & drawer chat AI untuk mobile */}
      <button
        onClick={() => setChatOpenMobile(true)}
        className="fixed bottom-5 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl text-white shadow-lg lg:hidden"
        aria-label="Buka chat AI"
      >
        💬
      </button>
      {chatOpenMobile && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <span className="font-semibold">Chat AI Stok</span>
            <button onClick={() => setChatOpenMobile(false)} className="text-2xl leading-none">×</button>
          </div>
          <ChatPanel />
        </div>
      )}
    </div>
  );
}
