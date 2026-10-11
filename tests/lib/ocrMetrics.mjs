// Accuracy measures for photo extraction, compared with the human transcription in sample-data/.

export function lev(a, b) {
  a = String(a); b = String(b);
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) { const t = dp[j]; dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; }
  }
  return dp[b.length];
}
export const similarity = (a, b) => { const m = Math.max(String(a).length, String(b).length); return m ? 1 - lev(a, b) / m : 1; };
const key = (s) => String(s).trim().toLowerCase();

function lcs(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

/** Spelling: exact word recall/precision and order (longest common subsequence / expected). */
export function spellingMetrics(expected, extracted) {
  const E = expected.map(key), X = extracted.map(key);
  const found = E.filter((w) => X.includes(w)).length;
  return {
    expected: E.length, extracted: X.length, exactWords: found,
    wordRecall: E.length ? found / E.length : 0,
    wordPrecision: X.length ? X.filter((w) => E.includes(w)).length / X.length : 0,
    orderAccuracy: E.length ? lcs(E, X) / E.length : 0,
    missing: E.filter((w) => !X.includes(w)), extra: X.filter((w) => !E.includes(w)),
  };
}

/**
 * Vocabulary: word recall; for found words, exact-definition rate and mean character accuracy;
 * pairing accuracy = expected words paired with a definition ≥ 90% similar to THEIR OWN definition.
 */
export function vocabMetrics(expected, extracted) {
  const rows = new Map(extracted.map((r) => [key(r.word), r.definition]));
  let found = 0, exactDef = 0, charAcc = 0, paired = 0;
  const problems = [];
  for (const e of expected) {
    const d = rows.get(key(e.word));
    if (d == null) { problems.push(`missing word: ${e.word}`); continue; }
    found++;
    const sim = similarity(d, e.definition);
    charAcc += sim;
    if (d === e.definition) exactDef++;
    else problems.push(`${e.word}: "${d}" vs "${e.definition}" (${Math.round(sim * 100)}%)`);
    const others = expected.filter((o) => o !== e).map((o) => similarity(d, o.definition));
    if (sim >= 0.9 && sim > Math.max(0, ...others)) paired++;
  }
  const n = expected.length;
  return {
    expected: n, extracted: extracted.length, wordsFound: found, wordRecall: n ? found / n : 0,
    definitionExact: n ? exactDef / n : 0, definitionCharAccuracy: found ? charAcc / found : 0, pairingAccuracy: n ? paired / n : 0,
    extraRows: extracted.filter((r) => !expected.some((e) => key(e.word) === key(r.word))).map((r) => r.word),
    problems,
  };
}

export const pct = (x) => `${Math.round(x * 1000) / 10}%`;
