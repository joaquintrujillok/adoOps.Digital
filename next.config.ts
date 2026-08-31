import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Las fotos de las visitas de Tuniche viven en Vercel Blob. Habilitarlas
    // acá no es un trámite: es lo que permite que `next/image` sirva una
    // miniatura de unos pocos KB en vez de la foto original.
    //
    // Importa más de lo que parece. Un teléfono saca 900x1600 y ~180 KB por
    // foto; una bandeja con treinta visitas de tres fotos son dieciséis megas
    // bajados para mirar recuadros de 132 px — en el celular de alguien que
    // está en un campo con mala señal.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
};

export default nextConfig;
