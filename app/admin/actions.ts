"use server";

import { revalidatePath } from "next/cache";
import { setActiveDemoSetting, type DemoVertical } from "@/lib/demo-settings";

export async function switchDemo(vertical: DemoVertical): Promise<void> {
  await setActiveDemoSetting(vertical);
  revalidatePath("/admin");
}
