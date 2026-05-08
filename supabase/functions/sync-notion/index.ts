const NOTION_TOKEN = Deno.env.get("NOTION_TOKEN")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DATABASE_ID = "359bbd5f4aff80e38cbcd844fccfaaa9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const notionRes = await fetch(
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
    const notionData = await notionRes.json();

    const outfits = (notionData.results || []).map((pg: any) => {
      const p = pg.properties;
      const cover = pg.cover?.external?.url || pg.cover?.file?.url || null;
      const safeCover = cover && !cover.includes("amazonaws.com") ? cover : null;
      
      // 試穿娃娃：支援 select（舊）和 multi_select（新）
      const dollSelect = p["試穿娃娃"]?.select?.name;
      const dollMulti = p["試穿娃娃"]?.multi_select?.map((t: any) => t.name) || [];
      const doll = dollMulti.length ? dollMulti : (dollSelect ? [dollSelect] : null);

      return {
        notion_id: pg.id,
        name: p["娃衣名稱"]?.title?.[0]?.text?.content || "Untitled",
        doll,
        style: p["款式"]?.multi_select?.map((t: any) => t.name) || [],
        size: p["娃娃尺寸"]?.number || null,
        tags: p["標籤"]?.multi_select?.map((t: any) => t.name) || [],
        note: p["備註"]?.rich_text?.[0]?.text?.content || null,
        shop: p["商家連結或名稱"]?.rich_text?.[0]?.text?.content || null,
        origin: p["產地"]?.select?.name || null,
        cover: safeCover,
      };
    });

    const upsertRes = await fetch(
      `${SUPABASE_URL}/rest/v1/outfits?on_conflict=notion_id`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "apikey": SUPABASE_SERVICE_KEY,
          "Prefer": "resolution=merge-duplicates",
        },
        body: JSON.stringify(outfits),
      }
    );

    if (!upsertRes.ok) {
      const err = await upsertRes.text();
      throw new Error(`Supabase upsert failed: ${err}`);
    }

    return new Response(
      JSON.stringify({ success: true, synced: outfits.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
