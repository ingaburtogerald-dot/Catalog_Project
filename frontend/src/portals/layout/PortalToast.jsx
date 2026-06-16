export default function PortalToast({ message, show }) {
  return (
    <div className={`toast${show ? ' show' : ''}`} role="status" aria-live="polite" hidden={!show && !message}>
      {message}
    </div>
  );
}
