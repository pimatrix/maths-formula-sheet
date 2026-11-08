export default function Loading() {
  return (
    <div className="fs-root">
      <div className="fs-hero">
        <div className="fs-hero-inner">
          <div className="fs-skel fs-skel-title" />
          <div className="fs-skel fs-skel-line" style={{ width: "55%" }} />
        </div>
      </div>
      <main className="fs-main">
        <p className="fs-loading" style={{ paddingBottom: 8 }}>
          <span className="fs-spinner dark" /> Loading formulas…
        </p>
        <div className="fs-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="fs-skel fs-skel-card" />
          ))}
        </div>
      </main>
    </div>
  );
}
