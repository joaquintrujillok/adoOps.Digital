"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { ResumenChat } from "@/lib/vanni/conversaciones";

const FILTROS = [
  { id: "todas", texto: "Todas" },
  { id: "ofertas", texto: "Campaña" },
  { id: "tienda", texto: "Tienda" },
  { id: "sistema", texto: "Menú" },
] as const;

function iniciales(nombre: string | null, telefono: string): string {
  const base = (nombre ?? "").replace(/[^\p{L}\s]/gu, " ").trim();
  if (!base) return telefono.slice(-2);
  const p = base.split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

function telefonoCorto(t: string): string {
  return /^569\d{8}$/.test(t) ? `+56 9 ${t.slice(3, 7)} ${t.slice(7)}` : `+${t}`;
}

/** 14:32 si es de hoy, "Ayer", o 12-09. */
function cuando(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (mismoDia(d, hoy)) return d.toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" });
  const ayer = new Date(hoy.getTime() - 86_400_000);
  if (mismoDia(d, ayer)) return "Ayer";
  return d.toLocaleDateString("es-CL", { day: "2-digit", month: "2-digit" });
}

export default function ListaChats({ chats }: { chats: ResumenChat[] }) {
  const ruta = usePathname();
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]["id"]>("todas");
  const [q, setQ] = useState("");

  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return chats.filter(
      (c) =>
        (filtro === "todas" || c.flujo === filtro) &&
        (!t || (c.nombre ?? "").toLowerCase().includes(t) || c.telefono.includes(t.replace(/\D/g, "") || "§")),
    );
  }, [chats, filtro, q]);

  return (
    <aside className="vn-chats-lista">
      <div className="vn-chats-buscar">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o teléfono" className="vn-input" />
        <div className="vn-chats-filtros">
          {FILTROS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)} className={filtro === f.id ? "activo" : ""}>
              {f.texto}
            </button>
          ))}
        </div>
      </div>
      <div className="vn-chats-items">
        {visibles.map((c) => {
          const activo = ruta === `/vanni/conversaciones/${c.telefono}`;
          return (
            <Link key={c.telefono} href={`/vanni/conversaciones/${c.telefono}`} className={`vn-chat-item ${activo ? "activo" : ""}`}>
              <span className={`vn-avatar ${c.telefono.startsWith("569000") ? "vn-avatar-ejemplo" : ""}`}>{iniciales(c.nombre, c.telefono)}</span>
              <span className="vn-chat-item-cuerpo">
                <span className="vn-chat-item-fila">
                  <b>{c.nombre ?? telefonoCorto(c.telefono)}</b>
                  <time className={c.sinResponder ? "pendiente" : ""}>{cuando(c.ultimo)}</time>
                </span>
                <span className="vn-chat-item-fila">
                  <span className="vn-chat-item-preview">
                    {c.direccion === "out" && <span className="vn-check">✓ </span>}
                    {c.texto.replace(/\*/g, "")}
                  </span>
                  <span className={`vn-flujo vn-flujo-${c.flujo}`}>{c.flujo === "sistema" ? "menú" : c.flujo}</span>
                </span>
              </span>
            </Link>
          );
        })}
        {!visibles.length && <p className="vn-vacio">Sin conversaciones con ese filtro.</p>}
      </div>
    </aside>
  );
}
