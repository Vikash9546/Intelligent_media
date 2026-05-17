const renderMetric = (value, precision = 1, unit = "") => {
  if (value === null || value === void 0) return "\u2014";
  return `${value.toFixed(precision)}${unit}`;
};
const renderConfidence = (value) => {
  if (value === null || value === void 0) return "\u2014";
  return `${Math.round(value * 100)}%`;
};
const renderLabel = (label, fallback = "Analyzing...") => {
  return label ?? fallback;
};
const renderResolution = (w, h) => {
  if (w === null || h === null || w === void 0 || h === void 0) return "Calculating...";
  return `${w} \xD7 ${h}`;
};
const SeverityBadge = ({ severity, children }) => {
  const styles = {
    success: "bg-secondary/10 text-secondary border-secondary/20",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    error: "bg-error-container text-on-error-container border-error/10",
    pending: "bg-surface-container-highest text-outline border-outline-variant animate-pulse",
    info: "bg-secondary-fixed text-on-secondary-fixed-variant border-outline-variant"
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${styles[severity] ?? styles.info}`}>
      {children}
    </span>;
};
export {
  SeverityBadge,
  renderConfidence,
  renderLabel,
  renderMetric,
  renderResolution
};
