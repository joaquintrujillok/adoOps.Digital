#!/usr/bin/env python3
"""
fase0_sii.py — adoOps · Fase 0 del motor de nurturing

Descarga la nómina de personas jurídicas del SII, detecta sola el formato
(el SII no publica layout ni encoding), y arma la muestra del ICP lista para
el test de cobertura contra Prospeo y FullEnrich.

Uso típico:

    # 1. Bajar y ver qué trae realmente cada archivo
    python3 fase0_sii.py perfilar

    # 2. Armar la muestra: 200 empresas del ICP
    python3 fase0_sii.py muestra --acteco 62 63 --region 13 --n 200

    # 3. Ver los códigos ACTECO más frecuentes para elegir el ICP
    python3 fase0_sii.py actecos --top 40

Requiere: pandas, requests   ->   pip install pandas requests
"""

from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

try:
    import pandas as pd
    import requests
except ImportError:
    sys.exit("Falta una dependencia. Corre:  pip install pandas requests")


BASE = "https://www.sii.cl/estadisticas/nominas"

ARCHIVOS = {
    # clave          nombre del zip                     para qué sirve
    "nombres":      ("PUB_NOMBRES_PJ.zip",              "RUT, razon social, inicio y termino de giro"),
    "actecos":      ("PUB_NOM_ACTECOS.zip",             "Actividades economicas vigentes por RUT"),
    "direcciones":  ("PUB_NOM_DIRECCIONES.zip",         "Casa matriz y sucursales, historicas"),
    "empresas":     ("PUB_EMPRESAS_PJ_2020_A_2024.zip", "Tramo de ventas, N de trabajadores, region"),
}

DATOS = Path("datos_sii")
SALIDA = Path("salida")

ENCODINGS = ["utf-8", "latin-1", "cp1252"]
DELIMITADORES = ["|", ";", "\t", ","]


# ---------------------------------------------------------------- descarga

def descargar(clave: str) -> Path:
    """Baja el zip si no está, y devuelve la ruta del .txt que trae adentro."""
    zip_nombre, _ = ARCHIVOS[clave]
    DATOS.mkdir(exist_ok=True)
    destino = DATOS / zip_nombre

    if not destino.exists():
        url = f"{BASE}/{zip_nombre}"
        print(f"  bajando {zip_nombre} ...", end=" ", flush=True)
        r = requests.get(url, timeout=600, stream=True)
        r.raise_for_status()
        with open(destino, "wb") as f:
            for bloque in r.iter_content(chunk_size=1 << 20):
                f.write(bloque)
        print(f"{destino.stat().st_size / 1e6:.1f} MB")
    else:
        print(f"  {zip_nombre} ya estaba descargado")

    carpeta = DATOS / clave
    carpeta.mkdir(exist_ok=True)
    with zipfile.ZipFile(destino) as z:
        internos = [n for n in z.namelist() if not n.endswith("/")]
        z.extractall(carpeta)

    txts = sorted(carpeta.rglob("*"))
    txts = [p for p in txts if p.is_file()]
    if not txts:
        raise RuntimeError(f"{zip_nombre} no traía archivos adentro")
    # el más grande es el bueno
    return max(txts, key=lambda p: p.stat().st_size)


# ------------------------------------------------------------- detección

def detectar_formato(ruta: Path) -> tuple[str, str]:
    """
    El SII no documenta encoding ni delimitador. Los deducimos de la primera
    línea: gana la combinación que produce más columnas de forma consistente.
    """
    crudo = ruta.open("rb").read(200_000)

    encoding = None
    for enc in ENCODINGS:
        try:
            crudo.decode(enc)
            encoding = enc
            break
        except UnicodeDecodeError:
            continue
    if encoding is None:
        encoding = "latin-1"  # nunca falla, mapea todos los bytes

    texto = crudo.decode(encoding, errors="replace")
    lineas = [l for l in texto.splitlines()[:20] if l.strip()]
    if not lineas:
        raise RuntimeError(f"{ruta.name} parece vacío")

    mejor, mejor_n = ",", 0
    for d in DELIMITADORES:
        conteos = [l.count(d) for l in lineas[:10]]
        if not conteos:
            continue
        # consistente entre líneas y con más de una columna
        if min(conteos) == max(conteos) and min(conteos) > mejor_n:
            mejor, mejor_n = d, min(conteos)

    return encoding, mejor


def leer(ruta: Path, nrows: int | None = None, usecols=None) -> pd.DataFrame:
    """
    Con el formato ya detectado usamos el motor C: sobre los 378 MB de la
    nomina de empresas el motor de Python tarda minutos, y la muestra lee
    dos archivos grandes seguidos. `usecols` va con los nombres ORIGINALES
    del SII (con tildes y minusculas); el upper() viene despues.
    """
    encoding, sep = detectar_formato(ruta)
    df = pd.read_csv(
        ruta, sep=sep, encoding=encoding, dtype=str,
        nrows=nrows, on_bad_lines="skip", engine="c",
        usecols=usecols,
    )
    df.columns = [sin_tilde(c) for c in df.columns]
    return df


# Las regiones vienen como texto con numeral romano: "XIII REGION
# METROPOLITANA". No hay codigo numerico en el archivo, asi que --region 13
# se traduce al romano y se compara contra la primera palabra.
ROMANOS = {
    1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII",
    9: "IX", 10: "X", 11: "XI", 12: "XII", 13: "XIII", 14: "XIV", 15: "XV",
    16: "XVI",
}


def archivo_mas_reciente(carpeta_clave: str, ruta: Path) -> Path:
    """
    El zip de empresas trae un .txt por ano comercial (2020..2024). El mas
    grande no tiene por que ser el mas nuevo: elegimos por el ano del nombre.
    """
    hermanos = [q for q in ruta.parent.rglob("*") if q.is_file()]
    con_ano = []
    for q in hermanos:
        anos = [int(t) for t in re.findall(r"(20\d{2})", q.name)]
        if anos:
            con_ano.append((max(anos), q))
    if con_ano:
        return max(con_ano)[1]
    return ruta


def sin_tilde(texto: str) -> str:
    """El SII escribe 'Razon social' o 'Razón social' segun el archivo."""
    plano = unicodedata.normalize("NFKD", str(texto))
    return "".join(c for c in plano if not unicodedata.combining(c)).strip().upper()


def solo(*columnas: str):
    """usecols tolerante a tildes: se compara la version sin acentos."""
    quiero = {sin_tilde(c) for c in columnas}
    return lambda c: sin_tilde(c) in quiero


def col_rut(df: pd.DataFrame) -> str:
    """Encuentra la columna que trae el RUT, se llame como se llame."""
    for c in df.columns:
        if "RUT" in c and "DV" not in c:
            return c
    return df.columns[0]


def normalizar_rut(serie: pd.Series) -> pd.Series:
    return (serie.astype(str)
                 .str.replace(r"[.\-\s]", "", regex=True)
                 .str.upper()
                 .str.lstrip("0"))


# ------------------------------------------------------------- comandos

def cmd_perfilar(args):
    print("\nPERFILADO DE LA NOMINA DEL SII")
    print("Anota lo que sale acá: es el layout que el SII no publica.\n")

    claves = args.archivos or ["nombres", "actecos"]
    for clave in claves:
        _, para_que = ARCHIVOS[clave]
        print(f"\n{'=' * 70}\n{clave.upper()}  —  {para_que}\n{'=' * 70}")
        ruta = descargar(clave)
        enc, sep = detectar_formato(ruta)
        print(f"  archivo     : {ruta.name}")
        print(f"  tamaño      : {ruta.stat().st_size / 1e6:.1f} MB")
        print(f"  encoding    : {enc}")
        print(f"  delimitador : {sep!r}")

        df = leer(ruta, nrows=5)
        print(f"  columnas    : {len(df.columns)}")
        for c in df.columns:
            print(f"      - {c}")
        print("\n  primeras filas:")
        with pd.option_context("display.max_columns", None, "display.width", 200):
            print(df.head(3).to_string(index=False, max_colwidth=28))


def cmd_actecos(args):
    print("\nCODIGOS ACTECO MAS FRECUENTES")
    print("Elige de acá los prefijos de tu ICP.\n")
    ruta = descargar("actecos")
    df = leer(ruta)

    col = next((c for c in df.columns if "ACTECO" in c or "ACTIV" in c or "COD" in c), None)
    if col is None:
        sys.exit(f"No encontré la columna de actividad. Columnas: {list(df.columns)}")

    top = df[col].astype(str).str[:2].value_counts().head(args.top)
    print(f"{'prefijo':>8}  {'empresas':>10}")
    print(f"{'-' * 8}  {'-' * 10}")
    for prefijo, n in top.items():
        print(f"{prefijo:>8}  {n:>10,}")
    print("\nLos prefijos de 2 dígitos son la división CIIU. Para afinar, usa 3 o 4.")


def cmd_muestra(args):
    """
    La base es PUB_EMPRESAS_PJ del ano comercial mas reciente: es el UNICO
    archivo del SII que trae tramo de ventas y region, que es lo que hace
    del ICP un WHERE. La nomina de ACTECOS aporta el codigo de actividad.
    """
    print("\nARMANDO LA MUESTRA DEL ICP\n")

    ruta_e = archivo_mas_reciente("empresas", descargar("empresas"))
    ruta_a = descargar("actecos")

    print(f"\n  base: {ruta_e.name}")
    print("  cargando empresas ...", flush=True)
    emp = leer(ruta_e, usecols=solo(
        "Ano comercial", "RUT", "DV", "Razon social", "Tramo segun ventas",
        "Fecha termino de giro", "Rubro economico", "Region", "Comuna",
        "Numero de trabajadores dependie", "Actividad economica",
    ))
    print(f"    {len(emp):,} empresas")

    print("  cargando actecos ...", flush=True)
    act = leer(ruta_a, usecols=solo("RUT", "CODIGO ACTIVIDAD"))

    emp["_rut"] = normalizar_rut(emp[col_rut(emp)])
    act["_rut"] = normalizar_rut(act[col_rut(act)])

    df = emp

    # --- giro vigente ----------------------------------------------------
    # La columna se llama "FECHA TERMINO DE GIRO"; el codigo anterior la
    # buscaba en la nomina de nombres, donde se llama FECHA_TG_VIG y no
    # contiene "TERM": el filtro nunca corria y nadie se enteraba.
    col_term = next((c for c in df.columns if "TERMINO DE GIRO" in c), None)
    if col_term is None:
        sys.exit(f"No encontre la fecha de termino de giro: {list(df.columns)}")
    antes = len(df)
    vacia = df[col_term].isna() | (df[col_term].astype(str).str.strip().isin(["", "nan"]))
    df = df[vacia]
    print(f"  con giro vigente: {len(df):,}  (se descartaron {antes - len(df):,})")

    # --- region ----------------------------------------------------------
    col_reg = next((c for c in df.columns if "REGION" in c), None)
    if args.region:
        romanos = set()
        for r in args.region:
            r = str(r).strip().upper()
            romanos.add(ROMANOS.get(int(r), r) if r.isdigit() else r)
        primera = df[col_reg].astype(str).str.split().str[0].str.upper()
        df = df[primera.isin(romanos)]
        print(f"  region {sorted(romanos)} -> {len(df):,} empresas")

    # --- tramo de ventas --------------------------------------------------
    col_tramo = next((c for c in df.columns if "TRAMO" in c and "VENTAS" in c), None)
    if args.tramo:
        tramos = {str(int(t)) for t in args.tramo}
        df = df[df[col_tramo].astype(str).str.strip().isin(tramos)]
        print(f"  tramo de ventas {sorted(tramos, key=int)} -> {len(df):,} empresas")

    # --- rubro por glosa --------------------------------------------------
    col_rubro = next((c for c in df.columns if "RUBRO" in c), None)
    if args.rubro and col_rubro:
        patron = "|".join(args.rubro).upper()
        df = df[df[col_rubro].astype(str).str.upper().str.contains(patron, na=False, regex=True)]
        print(f"  rubro {args.rubro} -> {len(df):,} empresas")

    # --- empresas operativas ----------------------------------------------
    # El 78% del rubro financiero son fondos y sociedades de inversion: no
    # tienen trabajadores, no tienen operacion y no hay a quien escribirle.
    # Filtrarlos NO es opcional: sin esto la muestra se llena de cascarones y
    # se queman los creditos de enriquecimiento en empresas que no existen.
    col_actividad = next((c for c in df.columns if "ACTIVIDAD ECONOMICA" in c), None)
    if args.excluir and col_actividad:
        patron = "|".join(args.excluir).upper()
        antes = len(df)
        df = df[~df[col_actividad].astype(str).str.upper().str.contains(patron, na=False, regex=True)]
        print(f"  excluyendo {args.excluir} -> {len(df):,} empresas  (fuera {antes - len(df):,})")

    col_trab = next((c for c in df.columns if "TRABAJADORES" in c), None)
    if args.min_trabajadores is not None and col_trab:
        antes = len(df)
        n = pd.to_numeric(df[col_trab], errors="coerce").fillna(0)
        df = df[n >= args.min_trabajadores]
        print(f"  con {args.min_trabajadores}+ trabajadores -> {len(df):,}  (fuera {antes - len(df):,})")

    # --- actividad economica (codigo ACTECO) ------------------------------
    col_act = next((c for c in act.columns if "CODIGO ACTIVIDAD" in c), None)
    if args.acteco:
        patron = "^(" + "|".join(args.acteco) + ")"
        act = act[act[col_act].astype(str).str.match(patron, na=False)]
        print(f"  ACTECO {args.acteco} -> {len(act):,} actividades")
    ruts = act[["_rut", col_act]].drop_duplicates("_rut")
    df = df.merge(ruts, on="_rut", how="inner")
    print(f"\n  empresas que califican: {len(df):,}")

    if len(df) == 0:
        sys.exit("\nLa muestra quedo vacia. Revisa los filtros con:  fase0_sii.py actecos")

    muestra = df.sample(n=min(args.n, len(df)), random_state=args.semilla)

    col_rs = next((c for c in muestra.columns if "RAZON" in c or "SOCIAL" in c),
                  muestra.columns[3])
    col_dv = next((c for c in muestra.columns if c.strip() == "DV"), None)

    # El RUT del SII viene sin digito verificador y en columna aparte.
    # ChileCompra y los proveedores de enriquecimiento lo esperan completo.
    rut_completo = (muestra["_rut"] + "-" + muestra[col_dv].astype(str).str.strip()
                    if col_dv else muestra["_rut"])

    salida = pd.DataFrame({
        "rut": rut_completo,
        "rut_sin_dv": muestra["_rut"],
        "razon_social": muestra[col_rs],
        "acteco": muestra[col_act],
        "tramo_ventas": muestra[col_tramo] if col_tramo else "",
        "region": muestra[col_reg] if col_reg else "",
        "comuna": next((muestra[c] for c in muestra.columns if "COMUNA" in c), ""),
        "actividad": next((muestra[c] for c in muestra.columns if "ACTIVIDAD ECONOMICA" in c), ""),
        "trabajadores": next((muestra[c] for c in muestra.columns if "TRABAJADORES" in c), ""),
        # columnas que llenas despues con el test
        "dominio": "",
        "prospeo_email": "",
        "prospeo_ok": "",
        "fullenrich_email": "",
        "fullenrich_ok": "",
        "linkedin_url": "",
        "notas": "",
    })

    SALIDA.mkdir(exist_ok=True)
    destino = SALIDA / args.salida
    salida.to_csv(destino, index=False, encoding="utf-8-sig", quoting=csv.QUOTE_MINIMAL)

    print(f"\n  -> {destino}  ({len(salida)} empresas)")
    print("""
  SIGUIENTE PASO
  1. Completa la columna 'dominio' (busqueda web o Google Maps).
     Sin dominio, ningun proveedor de enriquecimiento encuentra nada.
  2. Sube el CSV a Prospeo (100 creditos gratis/mes) en modo company enrichment.
  3. Los que Prospeo no resuelva, pasalos por FullEnrich (50 creditos gratis).
  4. Cuenta cuantos de 200 quedaron con email verificado.
     Ese numero es la decision del proyecto.
""")


# ------------------------------------------------------------------ main

def main():
    p = argparse.ArgumentParser(
        description="Fase 0 · nómina del SII y muestra del ICP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("perfilar", help="baja los archivos y muestra su layout real")
    a.add_argument("--archivos", nargs="+", choices=list(ARCHIVOS))
    a.set_defaults(func=cmd_perfilar)

    b = sub.add_parser("actecos", help="lista los códigos de actividad más frecuentes")
    b.add_argument("--top", type=int, default=30)
    b.set_defaults(func=cmd_actecos)

    c = sub.add_parser("muestra", help="arma la muestra del ICP para el test")
    c.add_argument("--acteco", nargs="+", help="prefijos de código, ej: 62 63")
    c.add_argument("--region", nargs="+", help="región: número (13) o romano (XIII)")
    c.add_argument("--tramo", nargs="+", type=int, help="tramos de venta del SII, ej: 5 6 7")
    c.add_argument("--rubro", nargs="+", help="glosa del rubro, ej: FINANCIERAS")
    c.add_argument("--excluir", nargs="+", help="glosas de actividad a excluir, ej: 'SOCIEDADES DE INVERSION'")
    c.add_argument("--min-trabajadores", type=int, dest="min_trabajadores",
                   help="minimo de trabajadores dependientes: descarta cascarones")
    c.add_argument("--n", type=int, default=200)
    c.add_argument("--semilla", type=int, default=42, help="fija la muestra: dos corridas dan lo mismo")
    c.add_argument("--salida", default="muestra_icp.csv")
    c.set_defaults(func=cmd_muestra)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
