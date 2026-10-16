export default function Highlight({ text, query }) {
  const source = String(text ?? '');
  const needle = String(query || '').trim();
  if (!needle) return source;
  const lower = source.toLowerCase();
  const q = needle.toLowerCase();
  const nodes = [];
  let cursor = 0;
  let found = lower.indexOf(q);
  let key = 0;
  while (found !== -1) {
    if (found > cursor) nodes.push(source.slice(cursor, found));
    nodes.push(
      <mark
        key={key}
        className="bg-amber-200 text-slate-900 rounded-sm px-0.5 font-semibold"
      >
        {source.slice(found, found + q.length)}
      </mark>
    );
    key += 1;
    cursor = found + q.length;
    found = lower.indexOf(q, cursor);
  }
  if (nodes.length === 0) return source;
  if (cursor < source.length) nodes.push(source.slice(cursor));
  return <>{nodes}</>;
}
