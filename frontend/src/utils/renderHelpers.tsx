/**
 * Safe Rendering Helpers
 * 
 * Provides consistent formatting and fallback handling for CV metrics.
 */

import React from 'react';

/** Renders a numeric metric with safe fallback and decimal precision */
export const renderMetric = (value: number | null | undefined, precision: number = 1, unit: string = ''): string => {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(precision)}${unit}`;
};

/** Renders confidence as a percentage or '—' */
export const renderConfidence = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '—';
  return `${Math.round(value * 100)}%`;
};

/** Renders a perceptual label with optional color logic */
export const renderLabel = (label: string | null | undefined, fallback: string = 'Analyzing...'): string => {
  return label ?? fallback;
};

/** Renders dimensions as W x H or placeholder */
export const renderResolution = (w: number | null | undefined, h: number | null | undefined): string => {
  if (w === null || h === null || w === undefined || h === undefined) return 'Calculating...';
  return `${w} × ${h}`;
};

/** Badge component for severity levels */
export const SeverityBadge: React.FC<{ severity: string, children: React.ReactNode }> = ({ severity, children }) => {
  const styles: Record<string, string> = {
    success: 'bg-secondary/10 text-secondary border-secondary/20',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    error: 'bg-error-container text-on-error-container border-error/10',
    pending: 'bg-surface-container-highest text-outline border-outline-variant animate-pulse',
    info: 'bg-secondary-fixed text-on-secondary-fixed-variant border-outline-variant'
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[severity] ?? styles.info}`}>
      {children}
    </span>
  );
};
