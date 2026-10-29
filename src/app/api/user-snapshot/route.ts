import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "sidebery-snapshot-2026.10.22-00.48.27.json");
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    const content = fs.readFileSync(filePath, "utf-8");
    return new NextResponse(content, {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load snapshot" }, { status: 500 });
  }
}
