export const dynamic = "force-dynamic";

export default function SinConversacionAbierta() {
  return (
    <div className="vn-chat-vacio">
      <div>
        <div className="vn-display" style={{ fontSize: 20, fontWeight: 600 }}>Elige una conversación</div>
        <p>Los chats de <b>campaña</b> son respuestas a una promoción; los de <b>tienda</b>, compras. El motor responde solo: acá se ve qué le dijo a cada cliente.</p>
      </div>
    </div>
  );
}
