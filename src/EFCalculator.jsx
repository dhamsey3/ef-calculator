import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// NOTE ON REFERENCE VALUES:
// This tool intentionally ships with NO built-in "crustal background" values.
// Enrichment Factor results are only as good as the baseline you normalize against,
// and baselines vary by region, rock type, and which compilation you use. Commonly
// cited sources for upper continental crust composition include:
//   - Wedepohl, K.H. (1995), Geochimica et Cosmochimica Acta 59(7), 1217-1232
//   - Taylor, S.R. & McLennan, S.M. (1995), Reviews of Geophysics 33(2), 241-265
//   - Rudnick, R.L. & Gao, S. (2003), Treatise on Geochemistry 3, 1-64
// Look up the specific element values from one of these (or your own regional/local
// background dataset) and enter them below. Do not assume any tool's built-in numbers
// are correct for your study without checking the primary source yourself.

const ELEMENT_LIST = ['Cu', 'Pb', 'Zn', 'Mn', 'Ni', 'Cr', 'Fe', 'Ca', 'Mg', 'Al', 'Cd', 'Tl', 'Rb'];

const SAMPLE_COLORS = ['#2563eb', '#e5533d', '#16a085', '#8e44ad', '#d68910', '#2c3e50', '#c0392b', '#27ae60'];

function classifyEF(ef) {
  if (ef <= 1) return { label: 'No enrichment', color: '#2e7d32' };
  if (ef < 3) return { label: 'Minor enrichment', color: '#66bb6a' };
  if (ef < 5) return { label: 'Moderate enrichment', color: '#ffca28' };
  if (ef < 10) return { label: 'Moderate–severe', color: '#ffa726' };
  if (ef < 25) return { label: 'Severe enrichment', color: '#fb8c00' };
  if (ef < 50) return { label: 'Very severe', color: '#e53935' };
  return { label: 'Extremely severe', color: '#b71c1c' };
}

const emptyCrust = () => ELEMENT_LIST.reduce((acc, el) => ({ ...acc, [el]: '' }), {});

function EFCalculator() {
  const [refElement, setRefElement] = useState('Fe');
  const [crustValues, setCrustValues] = useState(emptyCrust());
  const [samples, setSamples] = useState([
    { id: 1, name: 'Sample 1', values: { Cu: '', Pb: '', Zn: '', Mn: '', Ni: '', Cr: '', Fe: '', Ca: '', Mg: '' } }
  ]);
  const [activeElements, setActiveElements] = useState(['Cu', 'Pb', 'Zn', 'Mn', 'Ni', 'Cr', 'Ca', 'Mg']);
  const [expandedCalc, setExpandedCalc] = useState(null);

  const addSample = () => {
    const newId = Math.max(...samples.map(s => s.id)) + 1;
    const emptyValues = {};
    activeElements.forEach(el => { emptyValues[el] = ''; });
    emptyValues[refElement] = '';
    setSamples([...samples, { id: newId, name: `Sample ${newId}`, values: emptyValues }]);
  };

  const removeSample = (id) => {
    if (samples.length > 1) setSamples(samples.filter(s => s.id !== id));
  };

  const updateSampleName = (id, name) => {
    setSamples(samples.map(s => s.id === id ? { ...s, name } : s));
  };

  const updateValue = (sampleId, element, value) => {
    setSamples(samples.map(s =>
      s.id === sampleId ? { ...s, values: { ...s.values, [element]: value } } : s
    ));
  };

  const toggleElement = (el) => {
    if (activeElements.includes(el)) {
      setActiveElements(activeElements.filter(e => e !== el));
    } else {
      setActiveElements([...activeElements, el]);
    }
  };

  const updateCrustValue = (el, value) => {
    setCrustValues({ ...crustValues, [el]: value });
  };

  const results = useMemo(() => {
    return samples.map(sample => {
      const refVal = parseFloat(sample.values[refElement]);
      const crustRefVal = parseFloat(crustValues[refElement]);
      const elementResults = activeElements
        .filter(el => el !== refElement)
        .map(el => {
          const cx = parseFloat(sample.values[el]);
          const cCrust = parseFloat(crustValues[el]);
          let ef = null;
          let warning = null;

          if (isNaN(cx)) {
            warning = `No ${el} value entered`;
          } else if (isNaN(refVal) || refVal <= 0) {
            warning = `No valid ${refElement} value for this sample`;
          } else if (isNaN(cCrust) || cCrust <= 0) {
            warning = `Missing crustal reference for ${el}`;
          } else if (isNaN(crustRefVal) || crustRefVal <= 0) {
            warning = `Missing crustal reference for ${refElement}`;
          } else {
            ef = (cx / refVal) / (cCrust / crustRefVal);
            if (ef > 200) warning = 'Unusually high — check units/inputs';
          }

          return {
            element: el, value: cx, ef,
            classification: ef !== null ? classifyEF(ef) : null,
            warning,
            sampleRatio: (!isNaN(cx) && !isNaN(refVal) && refVal > 0) ? cx / refVal : null,
            crustRatio: (!isNaN(cCrust) && !isNaN(crustRefVal) && crustRefVal > 0) ? cCrust / crustRefVal : null
          };
        });
      return { ...sample, elementResults };
    });
  }, [samples, activeElements, refElement, crustValues]);

  const chartData = useMemo(() => {
    const elements = activeElements.filter(el => el !== refElement);
    return elements.map(el => {
      const row = { element: el };
      results.forEach(sample => {
        const r = sample.elementResults.find(er => er.element === el);
        row[sample.name] = r && r.ef !== null ? Number(r.ef.toFixed(2)) : 0;
      });
      return row;
    });
  }, [results, activeElements, refElement]);

  const hasAnyResult = results.some(s => s.elementResults.some(r => r.ef !== null));

  const exportCSV = () => {
    const elements = activeElements.filter(el => el !== refElement);
    const header = ['Sample', refElement + ' (ref)', ...elements.flatMap(el => [`${el} (µg/g)`, `${el} EF`, `${el} Classification`])];
    const rows = results.map(sample => {
      const row = [sample.name, sample.values[refElement] ?? ''];
      elements.forEach(el => {
        const r = sample.elementResults.find(er => er.element === el);
        row.push(r?.value ?? '', r?.ef !== null && r?.ef !== undefined ? r.ef.toFixed(3) : '', r?.classification?.label ?? '');
      });
      return row;
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'enrichment_factors.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: 1040, margin: '0 auto', padding: '24px', color: '#1a1a1a'
    }}>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px 0' }}>
            Soil Heavy Metal Enrichment Factor Calculator
          </h1>
          <p style={{ fontSize: 14, color: '#666', margin: 0, maxWidth: 600 }}>
            Source apportionment tool for contaminated soil studies — classifies geogenic vs. anthropogenic
            origin using the Birch (2003) enrichment factor scheme.
          </p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!hasAnyResult}
          style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #2563eb',
            background: hasAnyResult ? '#2563eb' : '#a9c3f0', color: 'white',
            fontWeight: 700, fontSize: 13, cursor: hasAnyResult ? 'pointer' : 'not-allowed',
            whiteSpace: 'nowrap'
          }}
        >
          ⬇ Export CSV
        </button>
      </div>

      {/* Reference element */}
      <div style={{ background: '#f7f7f8', borderRadius: 12, padding: 16, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 4 }}>Reference element</label>
          <select
            value={refElement}
            onChange={(e) => setRefElement(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #d0d0d5', fontSize: 14 }}
          >
            <option value="Fe">Fe (iron)</option>
            <option value="Al">Al (aluminum)</option>
          </select>
        </div>
        <div style={{ fontSize: 13, color: '#666', maxWidth: 460 }}>
          Fe (Ergin et al. 1991) and Al are both common choices — Fe is typical for mining-impacted
          soils/sediments, Al for broader crustal normalization. Pick whichever your methodology specifies.
        </div>
      </div>

      {/* Crustal reference values — required, no defaults */}
      <div style={{ background: '#fffdf5', border: '1px solid #f0e4b8', borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Crustal / background reference values (µg/g)</div>
        <p style={{ fontSize: 13, color: '#7a6a2a', margin: '0 0 12px 0', lineHeight: 1.5 }}>
          This tool does not ship with built-in baseline values — EF results depend entirely on which
          background you normalize against, and that choice should be deliberate. Look up values from a
          source appropriate to your study (e.g. Wedepohl 1995; Taylor &amp; McLennan 1995; Rudnick &amp; Gao
          2003 for generic upper continental crust; or better, your own regional/local background
          samples) and enter them below.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {ELEMENT_LIST.map(el => (
            <div key={el}>
              <label style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{el}</label>
              <input
                type="number"
                value={crustValues[el]}
                onChange={(e) => updateCrustValue(el, e.target.value)}
                placeholder="enter value"
                style={{ width: '100%', padding: '5px 8px', borderRadius: 6, border: '1px solid #d0d0d5', fontSize: 13 }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Element selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>Elements to include</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {ELEMENT_LIST.map(el => (
            <button
              key={el}
              onClick={() => toggleElement(el)}
              style={{
                padding: '5px 12px', borderRadius: 20,
                border: activeElements.includes(el) ? '1px solid #2563eb' : '1px solid #d0d0d5',
                background: activeElements.includes(el) ? '#2563eb' : 'white',
                color: activeElements.includes(el) ? 'white' : '#444',
                fontSize: 13, fontWeight: 600, cursor: 'pointer'
              }}
            >
              {el}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison chart */}
      {samples.length > 1 && hasAnyResult && (
        <div style={{ border: '1px solid #e5e5e8', borderRadius: 12, padding: 16, marginBottom: 24 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Enrichment factor comparison</div>
          <div style={{ fontSize: 12.5, color: '#666', marginBottom: 12 }}>
            One bar group per element, one bar per sample.
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="element" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'EF', angle: -90, position: 'insideLeft', fontSize: 12 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {samples.map((s, i) => (
                <Bar key={s.id} dataKey={s.name} fill={SAMPLE_COLORS[i % SAMPLE_COLORS.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sample input tables */}
      {samples.map(sample => {
        const sampleResult = results.find(r => r.id === sample.id);
        return (
          <div key={sample.id} style={{ border: '1px solid #e5e5e8', borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
            <div style={{ background: '#fafafa', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e5e5e8' }}>
              <input
                value={sample.name}
                onChange={(e) => updateSampleName(sample.id, e.target.value)}
                style={{ fontWeight: 700, fontSize: 15, border: 'none', background: 'transparent', outline: 'none', flex: 1 }}
              />
              {samples.length > 1 && (
                <button
                  onClick={() => removeSample(sample.id)}
                  style={{ border: 'none', background: 'transparent', color: '#c0392b', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                >
                  Remove
                </button>
              )}
            </div>

            <div style={{ padding: 16 }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>{refElement} (reference, µg/g)</label>
                <input
                  type="number"
                  value={sample.values[refElement] ?? ''}
                  onChange={(e) => updateValue(sample.id, refElement, e.target.value)}
                  style={{ width: 140, display: 'block', marginTop: 4, padding: '6px 10px', borderRadius: 6, border: '1px solid #2563eb', fontSize: 13 }}
                  placeholder="0"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
                {activeElements.filter(el => el !== refElement).map(el => (
                  <div key={el}>
                    <label style={{ fontSize: 12, fontWeight: 600, display: 'block' }}>{el} (µg/g)</label>
                    <input
                      type="number"
                      value={sample.values[el] ?? ''}
                      onChange={(e) => updateValue(sample.id, el, e.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #d0d0d5', fontSize: 13 }}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px dashed #e0e0e3', paddingTop: 14 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sampleResult?.elementResults.map(r => {
                    const key = `${sample.id}-${r.element}`;
                    const isExpanded = expandedCalc === key;
                    return (
                      <div
                        key={r.element}
                        onClick={() => setExpandedCalc(isExpanded ? null : key)}
                        style={{
                          minWidth: 110, padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
                          background: r.classification ? r.classification.color + '22' : (r.warning ? '#fff3e0' : '#f0f0f0'),
                          border: `1px solid ${r.classification ? r.classification.color : (r.warning ? '#f39c12' : '#ccc')}`,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{r.element}</span>
                          <span style={{ fontSize: 10, color: '#888' }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: r.classification?.color || '#c07a00' }}>
                          {r.ef !== null ? r.ef.toFixed(2) : '⚠'}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#555' }}>
                          {r.warning || (r.classification ? r.classification.label : 'enter values')}
                        </div>
                        {isExpanded && r.ef !== null && (
                          <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #ccc', fontSize: 11, color: '#444', lineHeight: 1.6 }}>
                            <div>(C<sub>{r.element}</sub>/C<sub>{refElement}</sub>)<sub>sample</sub> = {r.sampleRatio?.toFixed(5)}</div>
                            <div>(C<sub>{r.element}</sub>/C<sub>{refElement}</sub>)<sub>crust</sub> = {r.crustRatio?.toFixed(6)}</div>
                            <div style={{ fontWeight: 700, marginTop: 4 }}>EF = {r.sampleRatio?.toFixed(5)} ÷ {r.crustRatio?.toFixed(6)} = {r.ef.toFixed(2)}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={addSample}
        style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #2563eb', background: 'white', color: '#2563eb', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 28 }}
      >
        + Add sample
      </button>

      <div style={{ background: '#f7f7f8', borderRadius: 12, padding: 16, fontSize: 12.5 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Birch (2003) classification scheme</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
          {[
            [1, 'EF ≤ 1: No enrichment', '#2e7d32'],
            [3, '1 < EF < 3: Minor', '#66bb6a'],
            [5, '3 < EF < 5: Moderate', '#ffca28'],
            [10, '5 < EF < 10: Moderate–severe', '#ffa726'],
            [25, '10 < EF < 25: Severe', '#fb8c00'],
            [50, '25 < EF < 50: Very severe', '#e53935'],
            [999, 'EF > 50: Extremely severe', '#b71c1c'],
          ].map(([k, label, color]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, color: '#666' }}>
          Formula: EF = (Cₓ/C_ref)<sub>sample</sub> ÷ (Cₓ/C_ref)<sub>crust</sub>. EF ≈ 1 suggests geogenic
          origin; EF {'>'} 10 is generally interpreted as anthropogenic (non-crustal) input. Click any
          element card above to see the calculation breakdown.
        </div>
      </div>
    </div>
  );
}

export default EFCalculator;
