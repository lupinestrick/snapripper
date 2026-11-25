import { NextRequest, NextResponse } from "next/server";

const BLOCKED_HOSTS = new Set([
  "169.254.169.254",
  "metadata.google.internal",
]);

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const targetUrl = String(payload?.url || "").trim();
    const method = String(payload?.method || "POST").toUpperCase();
    const headers: Record<string, string> =
      payload?.headers && typeof payload.headers === "object" ? payload.headers : {};
    const body = payload?.body;
    const timeoutMs = Math.min(Math.max(Number(payload?.timeoutMs) || 90000, 3000), 120000);

    if (!targetUrl || (!targetUrl.startsWith("https://") && !targetUrl.startsWith("http://"))) {
      return NextResponse.json(
        { error: "无效的目标 API 地址" },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "目标 URL 格式无效" }, { status: 400 });
    }

    if (BLOCKED_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
      return NextResponse.json({ error: "禁止访问保留元数据地址" }, { status: 403 });
    }

    const cleanHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      const lower = k.toLowerCase();
      if (lower === "host" || lower === "content-length" || lower === "origin" || lower === "referer") {
        continue;
      }
      if (typeof v === "string") {
        cleanHeaders[k] = v;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstreamRes = await fetch(targetUrl, {
        method,
        headers: cleanHeaders,
        body: method === "GET" || method === "HEAD" ? undefined : typeof body === "string" ? body : JSON.stringify(body),
        signal: controller.signal,
      });

      const responseText = await upstreamRes.text();
      const contentType = upstreamRes.headers.get("content-type") || "application/json; charset=utf-8";

      return new NextResponse(responseText, {
        status: upstreamRes.status,
        headers: {
          "Content-Type": contentType,
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    const isTimeout = err?.name === "AbortError";
    return NextResponse.json(
      {
        error: isTimeout
          ? "上游 AI 接口响应超时"
          : `代理请求上游接口失败: ${err?.message || "网络错误"}`,
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
