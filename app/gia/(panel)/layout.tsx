import NavPanel from "@/components/gia/NavPanel";

/** El back office: barra lateral y contenido, como en los mockups. */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="gia-panel">
      <NavPanel />
      <main className="gia-main">{children}</main>
    </div>
  );
}
