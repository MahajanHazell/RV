/**
 * CitationList Component
 *
 * Displays citations and references from chat responses
 * Dedupes repeated URLs (multiple chunks from same page) and shows top sources
 */

interface Source {
  id: string;
  source_url: string | null;
  similarity: number;
}

export default function CitationList({ sources }: { sources: Source[] }) {
  if (!sources?.length) return null;

  const pct = (s: number) => Math.round(s * 100);

  const label = (p: number) => {
    if (p >= 70) return "Strong";
    if (p >= 50) return "Good";
    return "Weak";
  };

  const host = (url: string) => {
    try {
      return new URL(url).host.replace("www.", "");
    } catch {
      return url;
    }
  };

  // Deduplicate by source_url and keep the highest similarity per URL
  const deduped = Array.from(
    sources.reduce((map, s) => {
      const key = s.source_url ?? `no_url:${s.id}`;
      const existing = map.get(key);
      if (!existing || s.similarity > existing.similarity) {
        map.set(key, s);
      }
      return map;
    }, new Map<string, Source>()).values()
  )
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 1); // show only top source

  return (
    <div className="citation-list">
      <div className="citation-header">Sources</div>
      <div className="citation-items">
        {deduped.map((s, i) => {
          const p = pct(s.similarity);
          return (
            <div key={s.source_url ?? s.id ?? i} className="citation-item">
              <div className="citation-left">
                <span className="citation-id">#{i + 1}</span>
                {s.source_url ? (
                  <a
                    className="citation-link"
                    href={s.source_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {host(s.source_url)}
                  </a>
                ) : (
                  <span className="citation-no-url">Source document</span>
                )}
              </div>

              <div className="citation-right">
                <span className="badge">{p}%</span>
                <span className="muted">{label(p)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
