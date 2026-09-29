/** Un mensaje que el motor quiere mandar. Con imagen, el texto va de epígrafe. */
export interface Salida {
  texto: string;
  imagenUrl?: string | null;
}
