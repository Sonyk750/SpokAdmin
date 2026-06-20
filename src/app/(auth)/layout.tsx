export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="bg-scene">
        <div className="bg-scene__violet" />
        <div className="bg-scene__cyan" />
        <div className="bg-scene__grid" />
      </div>
      {children}
    </div>
  );
}
