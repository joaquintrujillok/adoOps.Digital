import BancoIdeas from "@/components/gia/BancoIdeas";

export default function PaginaIdeas() {
  return (
    <>
      <header>
        <div className="small muted">Etapa 2 · Centro de Excelencia</div>
        <h1>Banco de ideas</h1>
        <p style={{ margin: "8px 0 0", maxWidth: 760, color: "var(--g-suave)" }}>
          Las personas proponen cómo usar IA en su trabajo, sus equipos votan y el CoE evalúa. La cultura de ideas que pide la etapa 2.
        </p>
      </header>
      <BancoIdeas />
    </>
  );
}
