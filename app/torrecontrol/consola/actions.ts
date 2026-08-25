"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/dashboard360/auth.actions";
import { setActiveDemoSetting, type DemoVertical } from "@/lib/demo-settings";

// La sesión se vuelve a pedir acá, no solo en la página. Una server action es
// un endpoint: quien conozca su identificador la puede invocar sin haber pasado
// nunca por la pantalla que la dibuja. Es la misma regla que sigue el resto del
// repo —`requireSession()` en cada acción— y la razón por la que el proxy se
// describe a sí mismo como un control optimista.
export async function switchDemo(vertical: DemoVertical): Promise<void> {
  await requireSession();
  await setActiveDemoSetting(vertical);
  revalidatePath("/torrecontrol/consola");
  revalidatePath("/torrecontrol");
}
