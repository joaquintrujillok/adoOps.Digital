import { IBM_Plex_Mono } from "next/font/google";
import "@/app/_web/sitio.css";
import "./pulso.css";

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

/**
 * El armazón de Pulso IA: los tokens y la tipografía de la web (sitio.css),
 * sin la barra ni el pie de `Sitio`. Quien escanea un QR en una charla no vino
 * a navegar la web, y la pantalla proyectada no puede tener un menú.
 */
export default function Marco({ children }: { children: React.ReactNode }) {
  return <div className={`v2 ${plexMono.variable}`}>{children}</div>;
}
