import Repositorio from "@/components/gia/Repositorio";

export default function PaginaRepositorio() {
  return (
    <>
      <header>
        <div className="small muted">Etapa 2 · Centro de Excelencia</div>
        <h1>Repositorio de documentos</h1>
        <p style={{ margin: "8px 0 0", maxWidth: 760, color: "var(--g-suave)" }}>
          Políticas, estándares, guías y plantillas en un solo lugar, cada uno con su dueño y su versión.
        </p>
      </header>
      <Repositorio />
    </>
  );
}
