import { db } from "@/db";
import { demoSettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type DemoVertical = "terreno" | "actas" | "mantencion";

export async function getActiveDemoSetting(): Promise<DemoVertical> {
  const [row] = await db.select().from(demoSettings).limit(1);
  return (row?.activeDemo as DemoVertical) ?? "terreno";
}

export async function setActiveDemoSetting(vertical: DemoVertical): Promise<void> {
  const [row] = await db.select({ id: demoSettings.id }).from(demoSettings).limit(1);
  if (row) {
    await db
      .update(demoSettings)
      .set({ activeDemo: vertical, updatedAt: new Date() })
      .where(eq(demoSettings.id, row.id));
  } else {
    await db.insert(demoSettings).values({ activeDemo: vertical });
  }
}
