import Simulador from "@/components/vanni/Simulador";
import { hayModelo } from "@/lib/vanni/llm";

export const dynamic = "force-dynamic";

export default function PaginaSimulador() {
  const modelo = hayModelo();
  return (
    <>
      <div className="vn-top">
        <div>
          <h1>Simulador</h1>
          <p>El mismo motor que atiende el WhatsApp de Vanni —llaves, campaña, tienda, pedidos— sin enviar nada. Sirve para ensayar una demo y para probar cambios.</p>
        </div>
        <span className={`vn-chip ${modelo ? "vn-chip-teal" : "vn-chip-aviso"}`} title="Cómo decide el motor">
          {modelo ? "Motor con IA" : "Motor por reglas (sin OPENAI_API_KEY)"}
        </span>
      </div>
      <Simulador telefonoInicial="56900090001" />
    </>
  );
}
