'use client';
import { useState } from 'react';

/**
 * MethodologyPanel — Panel de Metodología Reutilizable
 *
 * Explica de forma consistente en TODAS las vistas analíticas:
 *  - Qué pregunta urbana responde
 *  - Cómo funciona el algoritmo o cálculo
 *  - Cómo se busca en los datos (query/proceso)
 *  - Cómo interpretar el resultado
 *  - Referencia académica (cuando aplica)
 *
 * @param {string}   question    — ¿Qué pregunta responde?
 * @param {string}   algorithm   — ¿Cómo funciona el algoritmo?
 * @param {string}   dataSource  — ¿Cómo se busca en los datos?
 * @param {string}   howToRead   — ¿Cómo se interpreta?
 * @param {string}   reference   — Referencia académica (opcional)
 * @param {string}   limitation  — Limitación o dato faltante (opcional)
 * @param {boolean}  defaultOpen — Si el panel inicia expandido
 */
export default function MethodologyPanel({
  question,
  algorithm,
  dataSource,
  howToRead,
  reference,
  limitation,
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,210,255,0.05) 0%, rgba(58,123,213,0.08) 100%)',
      border: '1px solid rgba(0,210,255,0.2)',
      borderRadius: '10px',
      marginBottom: '1.5rem',
      overflow: 'hidden',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      {/* Header clickable */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 1.2rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#00d2ff',
          fontSize: '0.85rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1rem' }}>🔬</span>
          Metodología &amp; Interpretación
        </span>
        <span style={{
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
          opacity: 0.7,
        }}>▼</span>
      </button>

      {/* Contenido expandible */}
      {open && (
        <div style={{ padding: '0 1.2rem 1.2rem', display: 'grid', gap: '0.9rem' }}>

          {question && (
            <Row icon="❓" label="¿Qué pregunta responde?" color="#00d2ff">
              {question}
            </Row>
          )}

          {algorithm && (
            <Row icon="⚙️" label="¿Cómo funciona el algoritmo?" color="#a78bfa">
              {algorithm}
            </Row>
          )}

          {dataSource && (
            <Row icon="🗄️" label="¿Cómo se busca en los datos?" color="#34d399">
              <code style={{
                background: 'rgba(52,211,153,0.08)',
                padding: '0.4rem 0.6rem',
                borderRadius: '4px',
                fontSize: '0.78rem',
                display: 'block',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                color: '#6ee7b7',
              }}>{dataSource}</code>
            </Row>
          )}

          {howToRead && (
            <Row icon="👁️" label="¿Cómo interpretar el resultado?" color="#fbbf24">
              {howToRead}
            </Row>
          )}

          {limitation && (
            <Row icon="⚠️" label="Limitación / Datos necesarios" color="#f87171">
              {limitation}
            </Row>
          )}

          {reference && (
            <Row icon="📚" label="Referencia académica" color="#94a3b8">
              <em style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{reference}</em>
            </Row>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, color, children }) {
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.1rem' }}>{icon}</span>
      <div>
        <div style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '0.25rem',
        }}>{label}</div>
        <div style={{ fontSize: '0.83rem', color: '#cbd5e1', lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
