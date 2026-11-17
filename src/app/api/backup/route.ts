import { connection } from "next/server";
import { exportBackup, importBackup } from "@/lib/server/backup";
import { today } from "@/lib/server/session";

/** Download all progress as a JSON file. */
export async function GET() {
  await connection();
  const body = JSON.stringify(exportBackup(), null, 1);
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="german-teacher-backup-${today()}.json"`,
    },
  });
}

/** Replace all progress with an uploaded backup. */
export async function POST(req: Request) {
  try {
    const data = await req.json();
    return Response.json({ ok: true, ...importBackup(data) });
  } catch (e) {
    return Response.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
