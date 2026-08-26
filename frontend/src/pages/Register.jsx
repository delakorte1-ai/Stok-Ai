import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ namaPerusahaan: "", jenisUsaha: "", namaUser: "", email: "", password: "" });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(form);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Gagal mendaftar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900">Daftarkan Perusahaan</h1>
        <p className="mb-6 text-sm text-slate-500">Bisa dipakai untuk jenis usaha apa saja.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <Field label="Nama Perusahaan" value={form.namaPerusahaan} onChange={(v) => update("namaPerusahaan", v)} required />
          <Field label="Jenis Usaha (opsional)" value={form.jenisUsaha} onChange={(v) => update("jenisUsaha", v)} placeholder="mis. Toko Ban & Velg" />
          <Field label="Nama Anda" value={form.namaUser} onChange={(v) => update("namaUser", v)} required />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} required />
          <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} required />

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Memproses…" : "Daftar & Mulai"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Sudah punya akun? <Link to="/login" className="font-medium text-indigo-600">Masuk</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />
    </div>
  );
}
