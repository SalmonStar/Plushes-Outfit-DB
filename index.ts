const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN")!;
const DATABASE_ID = "359bbd5f4aff80e38cbcd844fccfaaa9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { action, data } = await req.json();

  // ── LIST：查詢資料庫所有造型 ──────────────────────────────────────
  if (action === "list") {
    const res = await fetch(
      `https://api.notion.com/v1/databases/${DATABASE_ID}/query`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          page_size: 100,
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        }),
      }
    );
    const json = await res.json();
    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── CREATE：新增一筆造型到 Notion ─────────────────────────────────
  if (action === "create") {
    const res = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        parent: { database_id: DATABASE_ID },
        cover: data.imageUrl
          ? { type: "external", external: { url: data.imageUrl } }
          : undefined,
        properties: {
          "娃衣名稱": { title: [{ text: { content: data.name || "" } }] },
          "試穿娃娃": data.doll ? { select: { name: data.doll } } : undefined,
          "款式": data.style?.length
            ? { multi_select: data.style.map((s: string) => ({ name: s })) }
            : undefined,
          "娃娃尺寸": data.size ? { number: Number(data.size) } : undefined,
          "標籤": data.tags?.length
            ? { multi_select: data.tags.map((t: string) => ({ name: t })) }
            : undefined,
          "備註": data.note
            ? { rich_text: [{ text: { content: data.note } }] }
            : undefined,
          "商家連結或名稱": data.shop
            ? { rich_text: [{ text: { content: data.shop } }] }
            : undefined,
          "產地": data.origin ? { select: { name: data.origin } } : undefined,
        },
      }),
    });
    const json = await res.json();
    return new Response(JSON.stringify(json), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "unknown action" }), {
    status: 400,
    headers: corsHeaders,
  });
});
