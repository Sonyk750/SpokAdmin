export default function FacturiEmisePage() {
  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <p className="page-kicker">SPV / e-Factură</p>
          <h1 className="page-title">Facturi emise</h1>
          <p className="page-sub">Facturi trimise prin ANAF e-Factură</p>
        </div>
      </div>
      <div className="empty-state">
        <span className="empty-state__icon">📤</span>
        <p className="empty-state__title">În curând</p>
        <p className="empty-state__desc">
          Modulul de emitere e-Facturi va fi disponibil într-o versiune viitoare.
        </p>
      </div>
    </div>
  )
}
