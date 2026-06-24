export default function DeclaratiiPage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">SPV / e-Factură</p>
          <h1 className="page-title">Declarații fiscale</h1>
          <p className="page-sub">Declarații depuse prin SPV ANAF</p>
        </div>
      </div>
      <div className="empty-state">
        <span className="empty-state__icon">📋</span>
        <p className="empty-state__title">În curând</p>
        <p className="empty-state__desc">
          Vizualizarea declarațiilor fiscale depuse prin SPV va fi disponibilă în curând.
        </p>
      </div>
    </div>
  )
}
