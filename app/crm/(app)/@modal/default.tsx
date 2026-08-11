// Sin modal abierto no se pinta nada.
//
// Next exige este archivo para las rutas paralelas: sin él, cualquier navegación
// que no calce con un interceptor deja el slot sin resolver y la ruta entera
// devuelve 404.

export default function SinModal() {
  return null;
}
