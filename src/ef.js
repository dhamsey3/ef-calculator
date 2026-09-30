// Pure calculation / parsing helpers for the EF calculator (no React).

export const ELEMENT_LIST = ['Cu', 'Pb', 'Zn', 'Mn', 'Ni', 'Cr', 'Fe', 'Ca', 'Mg', 'Al', 'Cd', 'Tl', 'Rb'];

export function classifyEF(ef) {
  if (ef <= 1) return { label: 'No enrichment', color: '#2e7d32' };
  if (ef < 3) return { label: 'Minor enrichment', color: '#66bb6a' };
  if (ef < 5) return { label: 'Moderate enrichment', color: '#ffca28' };
  if (ef < 10) return { label: 'Moderate–severe', color: '#ffa726' };
  if (ef < 25) return { label: 'Severe enrichment', color: '#fb8c00' };
  if (ef < 50) return { label: 'Very severe', color: '#e53935' };
  return { label: 'Extremely severe', color: '#b71c1c' };
}

export function explainEF(ef) {
  if (ef <= 1) return 'at or below the crustal baseline — consistent with a purely natural (geogenic) source';
  if (ef < 3) return 'only minor enrichment, still broadly within natural geochemical variability';
  if (ef < 5) return 'moderate enrichment; a natural explanation is possible, but some non-crustal input cannot be ruled out';
  if (ef < 10) return 'moderate-to-severe enrichment, suggesting a meaningful non-crustal (likely anthropogenic) contribution';
  if (ef < 25) return 'severe enrichment, generally interpreted as anthropogenic contamination rather than natural background';
  if (ef < 50) return 'very severe enrichment, indicating substantial anthropogenic input';
  return 'extremely severe enrichment, pointing to a dominant, likely point-source contamination';
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

// Rows whose sample name starts with one of these are treated as the
// crustal/background reference row rather than as a sample.
const BACKGROUND_ROW = /^(background|crust|crustal|reference|baseline)\b/i;

function detectDelimiter(line) {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line, delimiter) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      fields.push(field);
      field = '';
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields.map(f => f.trim());
}

// "Cu", "Cu (µg/g)", "Cu_ppm", "Cu mg/kg" -> "Cu". "Copper" -> null.
function matchElement(header) {
  const m = header.trim().match(/^([A-Z][a-z]?)(?![a-z])/);
  return m && ELEMENT_LIST.includes(m[1]) ? m[1] : null;
}

function parseNumber(raw, decimalComma) {
  let s = raw.replace(/\s/g, '');
  if (decimalComma) s = s.replace(',', '.');
  return s !== '' && Number.isFinite(Number(s)) ? s : '';
}

/**
 * Parse a CSV/TSV of samples. First column = sample name, remaining columns =
 * element concentrations (µg/g), with element symbols in the header row.
 * Semicolon-delimited files (European Excel) may use decimal commas.
 */
export function parseSamplesCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 2) throw new Error('The file needs a header row and at least one data row.');

  const delimiter = detectDelimiter(lines[0]);
  const decimalComma = delimiter !== ',';
  const header = splitLine(lines[0], delimiter);
  const columns = header.slice(1).map(matchElement);
  const elements = [...new Set(columns.filter(Boolean))];
  const ignoredColumns = header.slice(1).filter((h, i) => !columns[i] && h !== '');

  if (elements.length === 0) {
    throw new Error(`No recognised element columns in the header. Expected symbols like ${ELEMENT_LIST.slice(0, 4).join(', ')}.`);
  }

  const samples = [];
  let background = null;
  let skippedCells = 0;

  lines.slice(1).forEach((line, i) => {
    const cells = splitLine(line, delimiter);
    const name = cells[0] || `Sample ${i + 1}`;
    const values = {};
    columns.forEach((el, j) => {
      if (!el) return;
      const raw = cells[j + 1] ?? '';
      const v = parseNumber(raw, decimalComma);
      if (raw !== '' && v === '') skippedCells++;
      values[el] = v;
    });
    if (BACKGROUND_ROW.test(name)) background = values;
    else samples.push({ name, values });
  });

  return { samples, background, elements, ignoredColumns, skippedCells };
}

export function templateCSV(elements) {
  return [
    ['Sample', ...elements].join(','),
    ['Background', ...elements.map(() => '')].join(','),
    ['Site A', ...elements.map(() => '')].join(','),
  ].join('\n');
}

export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Example dataset
// ---------------------------------------------------------------------------

// Illustrative round numbers only — NOT taken from a published crustal
// compilation and NOT real field data. They exist so first-time visitors can
// see what the tool does. Replace them with values from a source you trust.
export const EXAMPLE = {
  refElement: 'Fe',
  activeElements: ['Cu', 'Pb', 'Zn', 'Mn', 'Ni', 'Cr', 'Cd'],
  crustValues: { Fe: '30000', Cu: '25', Pb: '17', Zn: '65', Mn: '600', Ni: '20', Cr: '35', Cd: '0.1' },
  samples: [
    { name: 'Example – upslope control', values: { Fe: '28000', Cu: '22', Pb: '24', Zn: '80', Mn: '550', Ni: '18', Cr: '33', Cd: '0.2' } },
    { name: 'Example – near tailings', values: { Fe: '41000', Cu: '95', Pb: '2400', Zn: '9800', Mn: '900', Ni: '26', Cr: '40', Cd: '18' } },
    { name: 'Example – downstream floodplain', values: { Fe: '35000', Cu: '48', Pb: '410', Zn: '1650', Mn: '720', Ni: '22', Cr: '37', Cd: '6.5' } },
  ],
};
