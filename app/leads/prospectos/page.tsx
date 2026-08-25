import { redirect } from "next/navigation";

// Arrastra los filtros: `bloqueos()` emite `?sin=dominio` y ese enlace tiene que
// seguir llegando a la lista ya filtrada, no a la lista completa.
export default async function ProspectosMovido({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string") query.set(k, v);
    else if (Array.isArray(v) && v[0]) query.set(k, v[0]);
  }
  const cola = query.toString();
  redirect(`/dashboard360/motor/prospectos${cola ? `?${cola}` : ""}`);
}
