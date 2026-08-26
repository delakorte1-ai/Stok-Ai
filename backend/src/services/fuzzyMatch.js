import levenshtein from "fast-levenshtein";

/**
 * Normalisasi string untuk pencocokan: lowercase, buang spasi berlebih,
 * buang karakter non alfanumerik ringan supaya "Ban-Luar 70/90" ~ "ban luar 70 90".
 */
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Skor kemiripan 0..1 antara dua string berbasis Levenshtein distance
 * ternormalisasi panjang string. 1 = identik, 0 = sangat berbeda.
 */
function similarityScore(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const distance = levenshtein.get(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  let score = 1 - distance / maxLen;

  // Bonus kalau salah satu adalah substring dari yang lain (mis. "ban gt 70" di dalam "ban gt radial 70")
  if (na.includes(nb) || nb.includes(na)) {
    score = Math.max(score, 0.85);
  }

  // Bonus kalau semua kata di query pendek muncul di kandidat (cocok untuk singkatan/urutan beda)
  const wordsA = na.split(" ").filter(Boolean);
  const wordsB = nb.split(" ").filter(Boolean);
  const shorter = wordsA.length <= wordsB.length ? wordsA : wordsB;
  const longer = wordsA.length <= wordsB.length ? wordsB : wordsA;
  const matchedWords = shorter.filter((w) => longer.some((w2) => w2.includes(w) || w.includes(w2)));
  if (shorter.length > 0) {
    const wordCoverage = matchedWords.length / shorter.length;
    score = Math.max(score, wordCoverage * 0.9);
  }

  return score;
}

/**
 * Cari produk yang paling mirip dengan nama yang disebut user di chat.
 *
 * @param {string} query - nama produk dari pesan user (boleh typo/singkatan)
 * @param {Array<{id:string, nama:string}>} produkList - daftar produk perusahaan
 * @param {object} opts
 * @param {number} opts.threshold - skor minimum supaya dianggap "match" (default 0.55)
 * @param {number} opts.ambiguousGap - kalau selisih skor top-1 dan top-2 lebih kecil dari ini,
 *   dianggap ambigu dan AI harus tanya klarifikasi (default 0.08)
 * @returns {{status: 'match'|'ambiguous'|'not_found', match?: object, candidates: Array}}
 */
export function findBestProductMatch(query, produkList, opts = {}) {
  const threshold = opts.threshold ?? 0.55;
  const ambiguousGap = opts.ambiguousGap ?? 0.08;

  const scored = produkList
    .map((p) => ({ produk: p, score: similarityScore(query, p.nama) }))
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  if (!top || top.score < threshold) {
    return { status: "not_found", candidates: scored.slice(0, 5) };
  }

  const second = scored[1];
  const isAmbiguous =
    second && second.score >= threshold && top.score - second.score < ambiguousGap;

  if (isAmbiguous) {
    // Kumpulkan semua kandidat yang berdekatan skornya dengan yang teratas
    const closeCandidates = scored.filter((s) => top.score - s.score < ambiguousGap);
    return { status: "ambiguous", candidates: closeCandidates };
  }

  return { status: "match", match: top.produk, candidates: scored.slice(0, 5) };
}

export { similarityScore, normalize };
