export default function HomePage(): React.ReactElement {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
      }}
    >
      <h1 style={{ fontSize: '2.5rem', margin: 0 }}>Veritine</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '32rem' }}>
        A Staked Knowledge War. Foundation stage - the full landing page ships in Phase 10.
      </p>
    </main>
  );
}
