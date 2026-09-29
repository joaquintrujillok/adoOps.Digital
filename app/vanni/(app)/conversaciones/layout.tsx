import ListaChats from "@/components/vanni/ListaChats";
import Refrescar from "@/components/vanni/Refrescar";
import { listaConversaciones } from "@/lib/vanni/conversaciones";

export const dynamic = "force-dynamic";

// La bandeja como un chat: la lista a la izquierda se queda fija y la
// conversación abierta ocupa el resto. Se refresca sola para que un mensaje que
// entra por WhatsApp aparezca sin recargar.
export default async function LayoutConversaciones({ children }: { children: React.ReactNode }) {
  const chats = await listaConversaciones();
  return (
    <>
      <Refrescar segundos={8} />
      <div className="vn-top" style={{ marginBottom: 12 }}>
        <div>
          <h1>Conversaciones</h1>
          <p>Todo lo que pasó por el WhatsApp de Vanni, como lo vio el cliente.</p>
        </div>
      </div>
      <div className="vn-chats">
        <ListaChats chats={chats} />
        <section className="vn-chat-panel">{children}</section>
      </div>
    </>
  );
}
