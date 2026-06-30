export const metadata = { title: "Acces interzis" };

export default function AccesInterzisPage() {
  return (
    <div className="page-shell">
      <div className="empty-state">
        <span className="empty-state__icon">🔒</span>
        <div className="empty-state__title">Acces interzis</div>
        <div className="empty-state__desc">
          Nu ai dreptul să accesezi această secțiune. Contactează administratorul asociației
          dacă ai nevoie de acces suplimentar.
        </div>
      </div>
    </div>
  );
}
