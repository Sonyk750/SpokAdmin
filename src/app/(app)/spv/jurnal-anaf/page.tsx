export default function JurnalAnafPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">SPV / e-Factură</p>
          <h1 className="page-title">Jurnal ANAF</h1>
          <p className="page-sub">Istoricul activităților din SPV</p>
        </div>
      </div>
      <div className="empty-state">
        <span className="empty-state__icon">📝</span>
        <p className="empty-state__title">În curând</p>
        <p className="empty-state__desc">
          Jurnalul activităților ANAF va fi disponibil în curând.
        </p>
      </div>
    </div>
  )
}
