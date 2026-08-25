import { redirect } from "next/navigation";

// /admin pasó a ser /torrecontrol/consola, y de paso dejó de ser una puerta
// abierta: ahora exige la sesión del tablero.
//
// El nombre viejo era el problema. "Admin" no decía qué administraba, y en un
// repo con tres áreas con sesión propia eso invita a suponer que administra
// todo. Administraba una sola cosa: qué vertical de TorreControl escucha.
export default function AdminMovido() {
  redirect("/torrecontrol/consola");
}
