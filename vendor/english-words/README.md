# English word filter (Sentence Fix grading)

`words.js` lets the Sentence Fix grader (`js/sentencefix/engine.js`) tell a real English word ("placed", "racing") from a misspelling ("runing", "dosent"). A child who types a real word is never marked as having misspelled it. The grader sends that answer to a grown-up instead.

| File | What it is |
|---|---|
| `words.js` | Generated ES module (about 290 KB) that holds a Bloom filter: 1,729,040 bits and 7 hashes over 172,904 words. It is loaded by a static `import`, so it works the same in Node tests and in the browser, with no network use. |
| `build.mjs` | Rebuilds `words.js`: `node vendor/english-words/build.mjs path/to/enable1.txt`. It also adds every word in the answer keys of `data/sentence-fix/bank.json`, which covers names such as "Diego". Rebuild it after adding bank items with new names. |

## Source and licence

- **Word list:** ENABLE (Enhanced North American Benchmark LExicon), `enable1.txt`, 172,823 words. It was compiled by Alan Beale and M. Cooper and placed in the **public domain**.
- **Copy used:** `https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt`, with SHA-256 `3f16130220645692ed49c7134e24a18504c2ca55b3c012f7290e3e77c63b1a89`.
- **Not kept here:** the list itself is not stored in this folder. Only the derived filter is kept.

## Behaviour

**False "word" results:** a Bloom filter never misses a listed word. About 1 in 100 non-words is wrongly reported as a word. For grading that is the safe direction: a few misspellings go to "review" instead of "incorrect".

**Words treated as misspellings anyway:** ENABLE contains some rare words that are also common misspellings, such as "stoped", "wich", "watter" and "wiling". It also has British spellings such as "colour". The grader keeps a short list of these in `engine.js` (`KNOWN_MISSPELLINGS`) and counts British "-our" spellings as misspellings of the American key word.
