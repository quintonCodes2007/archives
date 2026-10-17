import { useEffect, useRef } from "react";
import Icon from "./Icon";
import { STATUS_LABELS } from "../utils/format";
export function Badge({ status, children }) {
  return (
    <span className={`badge badge--${status?.toLowerCase()}`}>
      {children || STATUS_LABELS[status] || status}
    </span>
  );
}
export function Live({ error, updatedAt }) {
  return (
    <span
      className={`live ${error ? "is-offline" : ""}`}
      title={
        updatedAt
          ? `Last updated ${updatedAt.toLocaleTimeString()}`
          : "Connecting"
      }
    >
      <i />
      {error ? "Reconnecting" : updatedAt ? "Live updates" : "Connecting"}
    </span>
  );
}
export function Empty({ title, children, icon = "bag" }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={27} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function PageHeader({ eyebrow, title, children, actions }) {
  return (
    <header className="page-header night-section-header">
      <div className="night-header-number" aria-hidden="true">N°</div>
      <div className="night-header-copy">
        {eyebrow && <div className="eyebrow"><span className="night-header-square" />{eyebrow}</div>}
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}
export function Loading() {
  return (
    <div className="skeleton-grid" aria-label="Loading" role="status">
      {[1, 2, 3].map((n) => (
        <div className="skeleton" key={n} />
      ))}
    </div>
  );
}
export function ErrorNotice({ message, onRetry }) {
  return (
    message && (
      <div className="error-notice" role="alert">
        <span>{message}</span>
        {onRetry && (
          <button onClick={onRetry} className="text-button">
            Try again
          </button>
        )}
      </div>
    )
  );
}
export function DataState({ query, children }) {
  return (
    <>
      <ErrorNotice message={query.error} onRetry={query.refresh} />
      {query.loading ? <Loading /> : query.data !== null ? children : null}
    </>
  );
}
export function Field({ label, children, hint }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Stat({ label, value, icon, accent }) {
  return (
    <article className={`stat ${accent ? "stat-accent" : ""}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="stat-icon">
        <Icon name={icon} size={24} />
      </span>
    </article>
  );
}
