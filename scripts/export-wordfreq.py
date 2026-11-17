"""
One-off export of the German word-frequency list from wordfreq
(https://github.com/rspeer/wordfreq, data licensed CC BY-SA 4.0).

The output, data/sources/wordfreq-de.tsv.gz, is committed to the repo so the
app and `npm run build:words` never need Python. Re-run only to refresh it:

    python -m pip install wordfreq
    python scripts/export-wordfreq.py

Columns: word (lowercased, as wordfreq stores it) <TAB> frequency per billion words.
"""
import gzip
import os
import sys

from wordfreq import get_frequency_dict

TOP_N = int(sys.argv[1]) if len(sys.argv) > 1 else 100_000

freqs = get_frequency_dict("de", wordlist="large")
items = sorted(freqs.items(), key=lambda kv: -kv[1])[:TOP_N]

out = os.path.join(os.path.dirname(__file__), "..", "data", "sources", "wordfreq-de.tsv.gz")
with gzip.open(out, "wt", encoding="utf-8", compresslevel=9) as f:
    f.write("# German word frequencies from wordfreq 3.x (CC BY-SA 4.0), top %d, per billion words\n" % TOP_N)
    for word, freq in items:
        f.write("%s\t%d\n" % (word, round(freq * 1e9)))
print("wrote", len(items), "words to", os.path.normpath(out))
