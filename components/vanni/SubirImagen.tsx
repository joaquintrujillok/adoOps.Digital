"use client";

import { useState } from "react";

/**
 * Elige la pieza gráfica, la sube al tiro y deja su URL en un campo oculto
 * (`name`) del formulario que la contiene. Muestra cómo va a quedar.
 */
export default function SubirImagen({ name, inicial = null }: { name: string; inicial?: string | null }) {
  const [url, setUrl] = useState<string | null>(inicial);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivo: File) {
    setSubiendo(true);
    setError(null);
    try {
      const datos = new FormData();
      datos.set("archivo", archivo);
      const r = await fetch("/api/vanni/imagen", { method: "POST", body: datos });
      const j = (await r.json()) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error ?? "No se pudo subir");
      setUrl(j.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name={name} value={url ?? ""} />
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa de lo que se va a mandar, tal cual
        <img src={url} alt="Imagen de la campaña" style={{ maxWidth: 260, borderRadius: 10, border: "1px solid var(--vn-border)" }} />
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={subiendo}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void subir(f);
          }}
        />
        {url && (
          <button type="button" className="vn-btn vn-btn-sm vn-btn-sec" onClick={() => setUrl(null)}>
            Quitar imagen
          </button>
        )}
      </div>
      {subiendo && <p className="vn-ayuda">Subiendo…</p>}
      {error && <p className="vn-aviso vn-aviso-rojo">{error}</p>}
      <p className="vn-ayuda">PNG o JPG, hasta 5 MB. Sale como imagen con el mensaje de epígrafe.</p>
    </div>
  );
}
