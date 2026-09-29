import { cuponPorToken, qrPng, urlCupon } from "@/lib/vanni/cupones";

// El QR del cupón como PNG. Lo usa el bot para mandarlo por WhatsApp como
// imagen: WaSender necesita una URL pública, y un SVG no se ve en WhatsApp.
// Es público por el mismo motivo que la ficha: lo protege el token.
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const cupon = await cuponPorToken(token);
  if (!cupon) return new Response("No existe", { status: 404 });
  const png = await qrPng(urlCupon(token));
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, immutable" },
  });
}
