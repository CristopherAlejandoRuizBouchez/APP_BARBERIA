export default function LayoutAutenticacion({ children }: { children: React.ReactNode }) {
  return (
    <main
      id="contenido"
      className="grid min-h-dvh place-items-center bg-carbon px-5 py-12 text-marfil"
    >
      {children}
    </main>
  );
}
