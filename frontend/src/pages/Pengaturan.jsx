import { useEffect, useState, useCallback } from "react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import NewCategoryModal from "../components/NewCategoryModal";

export default function Pengaturan() {
  const { user } = useAuth();
  const [kategori, setKategori] = useState([]);
  const [users, setUsers] = useState([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newUser, setNewUser] = useState({ nama: "", email: "", password: "", role: "karyawan" });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    const [k, u] = await Promise.all([api.get("/kategori"), api.get("/auth/users")]);
    setKategori(k.data);
    setUsers(u.data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function tambahUser(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.post("/auth/users", newUser);
      setNewUser({ nama: "", email: "", password: "", role: "karyawan" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menambah user.");
    }
  }

  async function toggleAktif(u) {
    await api.patch(`/auth/users/${u.id}`, { aktif: !u.aktif });
    load();
  }

  async function hapusKategori(k) {
    if (!confirm(`Hapus kategori "${k.nama}"?`)) return;
    try {
      await api.delete(`/kategori/${k.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Gagal menghapus kategori.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Kelola Kategori</h2>
          <button onClick={() => setShowNewCategory(true)} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">+ Kategori</button>
        </div>
        <div className="space-y-1.5">
          {kategori.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <div>
                <span className="font-medium">{k.nama}</span>{" "}
                <span className="text-xs text-slate-400">({k.modeStok === "reguler" ? "Reguler" : "Unit Unik"}) · {k._count?.produk ?? 0} produk</span>
              </div>
              <button onClick={() => hapusKategori(k)} className="text-xs text-red-500 hover:underline">Hapus</button>
            </div>
          ))}
        </div>
      </section>

      {user?.role === "owner" && (
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Kelola User & Role</h2>
          <div className="mb-3 space-y-1.5">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium">{u.nama}</span>{" "}
                  <span className="text-xs text-slate-400">{u.email} · {u.role}</span>
                </div>
                <button onClick={() => toggleAktif(u)} className={`text-xs ${u.aktif ? "text-red-500" : "text-emerald-600"}`}>
                  {u.aktif ? "Nonaktifkan" : "Aktifkan"}
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={tambahUser} className="grid grid-cols-2 gap-2">
            <input placeholder="Nama" value={newUser.nama} onChange={(e) => setNewUser((f) => ({ ...f, nama: e.target.value }))} required className="col-span-2 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm sm:col-span-1" />
            <input placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))} required className="col-span-2 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm sm:col-span-1" />
            <input placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser((f) => ({ ...f, password: e.target.value }))} required className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
            <select value={newUser.role} onChange={(e) => setNewUser((f) => ({ ...f, role: e.target.value }))} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm">
              <option value="karyawan">Karyawan/Kasir</option>
              <option value="owner">Owner</option>
            </select>
            {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
            <button type="submit" className="col-span-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white">Tambah User</button>
          </form>
        </section>
      )}

      {showNewCategory && <NewCategoryModal onClose={() => setShowNewCategory(false)} onCreated={load} />}
    </div>
  );
}
