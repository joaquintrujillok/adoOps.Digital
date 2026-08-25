import { redirect } from "next/navigation";

// Los tres tableros de WhatsApp se agruparon bajo /torrecontrol: nunca fueron
// tres módulos, sino tres verticales de la misma tubería.
//
// El redirect se queda por el mismo motivo que el de /leads: hay enlaces
// guardados y QR impresos apuntando acá, y un 404 obliga a adivinar dónde
// quedó la pantalla.
export default function TerrenoMovido() {
  redirect("/torrecontrol/terreno");
}
