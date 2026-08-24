// Renderizador de Markdown acotado al subconjunto que genera lib/informe.ts:
// encabezados de nivel 2 y 3, párrafos, listas y negrita.
//
// **No usa `dangerouslySetInnerHTML` y eso no es exceso de celo.** Hoy el
// Markdown lo escribe el propio servidor y es de fiar; mañana el informe podrá
// editarse a mano o venir redactado por un modelo. Construir nodos de React en
// vez de inyectar HTML significa que ese cambio no abre un agujero: el texto
// nunca puede convertirse en marcado.
//
// Sin librería porque el subconjunto es este y no va a crecer: si algún día
// hace falta Markdown completo, corresponde una dependencia, no parchar esto.

import { Fragment, type ReactNode } from "react";

/** Convierte `texto con **negrita**` en nodos, sin tocar el resto. */
function conNegrita(texto: string, clave: string): ReactNode[] {
  return texto.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) => {
    if (trozo.startsWith("**") && trozo.endsWith("**") && trozo.length > 4) {
      return <strong key={`${clave}-${i}`}>{trozo.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${clave}-${i}`}>{trozo}</Fragment>;
  });
}

export default function Markdown({ children }: { children: string }) {
  const lineas = children.split("\n");
  const bloques: ReactNode[] = [];

  let parrafo: string[] = [];
  let lista: string[] = [];

  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const texto = parrafo.join(" ");
    bloques.push(<p key={`p-${bloques.length}`}>{conNegrita(texto, `p${bloques.length}`)}</p>);
    parrafo = [];
  };

  const cerrarLista = () => {
    if (!lista.length) return;
    const items = lista;
    bloques.push(
      <ul key={`ul-${bloques.length}`}>
        {items.map((it, i) => (
          <li key={i}>{conNegrita(it, `li${bloques.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    lista = [];
  };

  for (const linea of lineas) {
    const l = linea.trimEnd();

    if (l.startsWith("### ")) {
      cerrarParrafo();
      cerrarLista();
      bloques.push(<h3 key={`h3-${bloques.length}`}>{l.slice(4)}</h3>);
    } else if (l.startsWith("## ")) {
      cerrarParrafo();
      cerrarLista();
      bloques.push(<h2 key={`h2-${bloques.length}`}>{l.slice(3)}</h2>);
    } else if (l.startsWith("- ")) {
      cerrarParrafo();
      lista.push(l.slice(2));
    } else if (l.trim() === "") {
      cerrarParrafo();
      cerrarLista();
    } else {
      cerrarLista();
      parrafo.push(l);
    }
  }
  cerrarParrafo();
  cerrarLista();

  return <div className="d360-prosa">{bloques}</div>;
}
