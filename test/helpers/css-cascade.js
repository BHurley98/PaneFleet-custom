function matchingBrace(source, openingBrace) {
  let depth = 1;
  let quote = '';
  let escaped = false;
  let inComment = false;

  for (let index = openingBrace + 1; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (inComment) {
      if (character === '*' && next === '/') {
        inComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }

    if (character === '/' && next === '*') {
      inComment = true;
      index += 1;
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function normalizedSelector(selector) {
  return selector.trim().replace(/\s+/g, ' ');
}

function selectorList(source) {
  const selectors = [];
  let start = 0;
  let parentheses = 0;
  let brackets = 0;
  let quote = '';
  let escaped = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '(') parentheses += 1;
    else if (character === ')') parentheses = Math.max(0, parentheses - 1);
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets = Math.max(0, brackets - 1);
    else if (character === ',' && parentheses === 0 && brackets === 0) {
      selectors.push(source.slice(start, index));
      start = index + 1;
    }
  }

  selectors.push(source.slice(start));
  return selectors;
}

function mediaClauseApplies(clause, viewport) {
  const dimensions = {
    width: Number(viewport.width ?? 1024),
    height: Number(viewport.height ?? 768)
  };
  for (const match of clause.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)) {
    const value = dimensions[match[2]];
    const boundary = Number(match[3]);
    if (match[1] === 'min' && value < boundary) return false;
    if (match[1] === 'max' && value > boundary) return false;
  }

  const pointer = clause.match(/\(pointer:\s*(coarse|fine)\)/)?.[1];
  if (pointer && pointer !== (viewport.pointer || 'fine')) return false;

  const reducedMotion = clause.match(/\(prefers-reduced-motion:\s*(reduce|no-preference)\)/)?.[1];
  if (reducedMotion && (reducedMotion === 'reduce') !== Boolean(viewport.reducedMotion)) return false;
  return true;
}

function mediaApplies(prelude, viewport) {
  const query = prelude.replace(/^@media\s*/i, '');
  return query.split(',').some((clause) => mediaClauseApplies(clause, viewport));
}

function declarationRecords(body) {
  const records = [];
  for (const declaration of body.split(';')) {
    const separator = declaration.indexOf(':');
    if (separator < 0) continue;
    const property = declaration.slice(0, separator).trim();
    const rawValue = declaration.slice(separator + 1).trim();
    const important = /\s*!important\s*$/i.test(rawValue);
    const value = rawValue.replace(/\s*!important\s*$/i, '');
    if (property && value) records.push({ property, value, important });
  }
  return records;
}

function resolvedDeclarations(body) {
  const resolved = {};
  for (const record of declarationRecords(body)) {
    if (resolved[record.property]?.important && !record.important) continue;
    resolved[record.property] = { value: record.value, important: record.important };
  }
  return resolved;
}

function declarations(body) {
  return Object.fromEntries(
    Object.entries(resolvedDeclarations(body)).map(([property, record]) => [property, record.value])
  );
}

function canonicalDeclarations(body) {
  return JSON.stringify(
    Object.entries(resolvedDeclarations(body))
      .map(([property, record]) => [property, record.value, record.important])
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

export function exactDuplicateCssRules(source) {
  const seen = new Map();
  const duplicates = [];

  function walk(start, end, context = 'root') {
    let cursor = start;
    while (cursor < end) {
      const openingBrace = source.indexOf('{', cursor);
      if (openingBrace < 0 || openingBrace >= end) return;

      const closingBrace = matchingBrace(source, openingBrace);
      if (closingBrace < 0 || closingBrace > end) return;

      const prelude = source.slice(cursor, openingBrace)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      const normalizedPrelude = normalizedSelector(prelude);
      const bodyStart = openingBrace + 1;

      if (/^@(media|supports|layer)\b/i.test(prelude)) {
        walk(bodyStart, closingBrace, `${context} > ${normalizedPrelude}`);
      } else if (prelude && !prelude.startsWith('@')) {
        const key = `${context}\n${normalizedPrelude}\n${canonicalDeclarations(source.slice(bodyStart, closingBrace))}`;
        const line = source.slice(0, cursor).split('\n').length;
        if (seen.has(key)) {
          duplicates.push({ selector: normalizedPrelude, firstLine: seen.get(key), duplicateLine: line, context });
        } else {
          seen.set(key, line);
        }
      }

      cursor = closingBrace + 1;
    }
  }

  walk(0, source.length);
  return duplicates;
}

// Resolve same-selector source-order and !important overrides for deterministic responsive tests.
// This intentionally does not model browser specificity or CSS shorthands.
export function effectiveCssDeclarations(source, selector, viewport = { width: 1024, pointer: 'fine' }) {
  const expectedSelector = normalizedSelector(selector);
  const effective = {};
  const priorities = {};

  function walk(start, end) {
    let cursor = start;
    while (cursor < end) {
      const openingBrace = source.indexOf('{', cursor);
      if (openingBrace < 0 || openingBrace >= end) return;

      const closingBrace = matchingBrace(source, openingBrace);
      if (closingBrace < 0 || closingBrace > end) return;

      const prelude = source.slice(cursor, openingBrace)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
      const bodyStart = openingBrace + 1;

      if (/^@media\b/i.test(prelude)) {
        if (mediaApplies(prelude, viewport)) walk(bodyStart, closingBrace);
      } else if (/^@(supports|layer)\b/i.test(prelude)) {
        walk(bodyStart, closingBrace);
      } else if (prelude && !prelude.startsWith('@')) {
        const selectors = selectorList(prelude).map(normalizedSelector);
        if (selectors.includes(expectedSelector)) {
          for (const [property, record] of Object.entries(resolvedDeclarations(source.slice(bodyStart, closingBrace)))) {
            if (priorities[property] && !record.important) continue;
            effective[property] = record.value;
            priorities[property] = record.important;
          }
        }
      }

      cursor = closingBrace + 1;
    }
  }

  walk(0, source.length);
  return effective;
}
