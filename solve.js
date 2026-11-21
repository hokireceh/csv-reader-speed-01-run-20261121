// csv-reader-speed-01-run-20261121 — a faster drop-in for csv-reader 1.0.0.
//
// run(input) returns exactly what csv-reader 1.0.0 returns for {text, header}:
// {columns, rows, errors}. Written from the published policy (RULES.txt):
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line with no characters is no record;
//   - outside quotes a CR not followed by LF is dropped (stray_cr);
//   - a field opening with a quote runs to the next non-doubled quote ("" inside
//     is one quote; CRLF or a lone CR inside it reads as LF); what follows the
//     closing quote up to the next comma or line break is appended as it stands
//     (quote_junk, when the field ends); a quote that never closes is a literal
//     character and the text after it is read again as unquoted
//     (unterminated_quote); a quote inside an unquoted field is a literal;
//   - fields stay strings, never trimmed or converted;
//   - columns is the first record when header is true, else null; rows holds the
//     records after it (every record when header is false), each padded with ""
//     (short_row, with fields: its count) or cut (long_row, with extra: the cut
//     fields) to the first record's width;
//   - each error is {code, line, row} in the order met; line is the 1-based line
//     its record starts on (counting every LF, CRLF and lone CR inside quotes),
//     row its record's index in rows (null for the header).
//
// Speed: one left-to-right pass. Delimiters are located with the engine's
// native indexOf and fields are copied in bulk with slice — no per-character
// string building, no regex, no split. The common paths (unquoted field ending
// at a comma, quoted field with no line break inside) copy each field exactly
// once.
const COMMA = 44, QUOTE = 34, LF = 10, CR = 13, BOM = 0xfeff;
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = 0, line = 1, ended = 2;
  if (n > 0 && text.charCodeAt(0) === BOM) pos = 1;
  let recordLine = 1, recordRow = null;
  function unquoted(first) {
    let value = first;
    for (;;) {
      const comma = text.indexOf(',', pos);
      const lf = text.indexOf('\n', pos);
      const cr = text.indexOf('\r', pos);
      let m = -1, kind = 0;
      if (comma !== -1) { m = comma; kind = 0; }
      if (lf !== -1 && (m === -1 || lf < m)) { m = lf; kind = 1; }
      if (cr !== -1 && (m === -1 || cr < m)) { m = cr; kind = 2; }
      if (m === -1) { if (pos < n) value += text.slice(pos); pos = n; ended = 2; return value; }
      if (kind === 0) { value += text.slice(pos, m); pos = m + 1; ended = 0; return value; }
      if (kind === 1) { value += text.slice(pos, m); pos = m + 1; line += 1; ended = 1; return value; }
      if (m + 1 < n && text.charCodeAt(m + 1) === LF) { value += text.slice(pos, m); pos = m + 2; line += 1; ended = 1; return value; }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      value += text.slice(pos, m);
      pos = m + 1;
    }
  }
  function quoted() {
    const open = pos, openLine = line;
    let value = '';
    pos = pos + 1;
    for (;;) {
      const q = text.indexOf('"', pos);
      if (q === -1) {
        pos = open + 1; line = openLine;
        errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
        return unquoted('"');
      }
      const lf = text.indexOf('\n', pos);
      const cr = text.indexOf('\r', pos);
      let b = -1, isCR = false;
      if (lf !== -1 && lf < q) { b = lf; }
      if (cr !== -1 && cr < q && (b === -1 || cr < b)) { b = cr; isCR = true; }
      if (b === -1) {
        if (q > pos) value += text.slice(pos, q);
        if (q + 1 < n && text.charCodeAt(q + 1) === QUOTE) { value += '"'; pos = q + 2; continue; }
        pos = q + 1;
        if (pos >= n) { ended = 2; return value; }
        const d = text.charCodeAt(pos);
        if (d === COMMA) { pos += 1; ended = 0; return value; }
        if (d === LF) { pos += 1; line += 1; ended = 1; return value; }
        if (d === CR && pos + 1 < n && text.charCodeAt(pos + 1) === LF) { pos += 2; line += 1; ended = 1; return value; }
        const before = value.length;
        const junk = unquoted(value);
        if (junk.length > before) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
        return junk;
      }
      if (b > pos) value += text.slice(pos, b);
      value += '\n';
      line += 1;
      pos = b + (isCR && b + 1 < n && text.charCodeAt(b + 1) === LF ? 2 : 1);
    }
  }
  for (;;) {
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === LF) { pos += 1; line += 1; }
      else if (c === CR && pos + 1 < n && text.charCodeAt(pos + 1) === LF) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;
    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted;
    do {
      if (text.charCodeAt(pos) === QUOTE) { lastQuoted = true; fields.push(quoted()); }
      else { lastQuoted = false; fields.push(unquoted('')); }
    } while (ended === 0);
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) { columns = fields; continue; }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
