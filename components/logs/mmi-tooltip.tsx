'use client';

import { useRef, useState } from 'react';

const MMI_PATTERN = /missing\s*\/\s*miscommunicated\s*info/i;

/**
 * Wraps its text child and — only when the content matches "Missing /
 * Miscommunicated Info" — attaches a custom tooltip that appears after a
 * 500ms hover delay. Everything else renders as plain text.
 */
export function MmiText({ value }: { value: string | null | undefined }) {
  const timerRef = useRef<number | null>(null);
  const [show, setShow] = useState(false);

  if (!value) return <>—</>;
  const match = MMI_PATTERN.test(value);
  if (!match) return <>{value}</>;

  function handleEnter() {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setShow(true), 500);
  }
  function handleLeave() {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShow(false);
  }

  return (
    <span
      className="relative inline-block cursor-help"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
      tabIndex={0}
    >
      {value}
      {show ? (
        <span className="cqip-mmi-bubble" role="tooltip">
          📞 Have you tried... talking to each other?
        </span>
      ) : null}
    </span>
  );
}

/** Renders a comma-joined list, piping each value through MmiText so any
 *  "Missing / Miscommunicated Info" entry gets the tooltip. */
export function MmiList({ values }: { values: string[] | null | undefined }) {
  if (!Array.isArray(values) || values.length === 0) return <>—</>;
  return (
    <>
      {values.map((v, i) => (
        <span key={`${v}-${i}`}>
          <MmiText value={v} />
          {i < values.length - 1 ? ', ' : ''}
        </span>
      ))}
    </>
  );
}
