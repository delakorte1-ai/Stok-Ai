import { useEffect, useRef, useState } from "react";
import api from "../api/client";

const CONTOH_PESAN = [
  "ban gt radial kejual 2, harga 420rb",
  "stok oli federal tambah 10",
  "produk apa yang paling laku bulan ini?",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Halo! Ketik transaksi stok pakai bahasa bebas, misalnya \"ban gt radial kejual 2 harga 420rb\", atau tanya analitik seperti \"produk apa yang paling laku bulan ini?\".",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    setError(null);
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      // Kirim beberapa pesan terakhir saja sebagai konteks (stateless backend)
      const historyForApi = nextMessages
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post("/chat", { messages: historyForApi });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply, actions: res.data.actions }]);
    } catch (err) {
      const msg = err.response?.data?.error || "Gagal menghubungi AI. Coba lagi.";
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : "bg-slate-100 text-slate-800 rounded-bl-sm"
              }`}
            >
              {m.content}
              {m.actions?.some((a) => a.hasil?.status === "ok") && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {m.actions
                    .filter((a) => a.hasil?.status === "ok")
                    .map((a, idx) => (
                      <span key={idx} className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                        ✓ {a.nama_aksi}
                      </span>
                    ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2 text-sm text-slate-500">
              Sedang memproses…
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {CONTOH_PESAN.map((c) => (
            <button
              key={c}
              onClick={() => sendMessage(c)}
              className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
            >
              {c}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
        className="flex shrink-0 gap-2 border-t border-slate-200 p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tulis transaksi atau pertanyaan…"
          className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="shrink-0 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Kirim
        </button>
      </form>
    </div>
  );
}
