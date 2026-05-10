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
    // ── Step 1：從 Notion 拉所有資料 ──────────────────────────────
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
    const notionPages = notionData.results || [];

    // Notion 名稱 → page ID 的對照表（用來補缺少 notion_id 的筆）
    const notionNameMap: Record<string, string> = {};
    for (const pg of notionPages) {
      const name = pg.properties["娃衣名稱"]?.title?.[0]?.text?.content || "";
      if (name) notionNameMap[name] = pg.id;
    }

    // ── Step 2：補齊 Supabase 裡缺少 notion_id 的筆 ───────────────
    // 找出 notion_id 為 null 或空字串的舊資料，嘗試用名稱比對補上
    const missingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/outfits?or=(notion_id.is.null,notion_id.eq.)&select=id,name`,
      {
        headers: {
          "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
          "apikey": SUPABASE_SERVICE_KEY,
        },
      }
    );
    const missingRows = await missingRes.json();

    for (const row of (missingRows || [])) {
      const notionId = notionNameMap[row.name];
      if (!notionId) continue; // Notion 裡也找不到同名的，跳過

      await fetch(
        `${SUPABASE_URL}/rest/v1/outfits?id=eq.${row.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
            "apikey": SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ notion_id: notionId }),
        }
      );
    }

    // ── Step 3：正常 upsert（用 notion_id 做 merge key）────────────
    // cover 欄位刻意不帶，保留 Supabase Storage 裡已上傳的圖片 URL
    const outfits = notionPages.map((pg: any) => {
      const p = pg.properties;

      // 試穿娃娃：相容舊版 select 與新版 multi_select
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

    // ── Step 4：同步 dolls / styles / tags 清單 table 並計算 count ─────────────
    // 建立一個統計出現次數的輔助函式
    const countOccurrences = (itemsArray) => {
      const counts = {};
      itemsArray.forEach(item => {
        counts[item] = (counts[item] || 0) + 1;
      });
      // 轉為 Supabase 需要的格式： [{ name: 'A', count: 5 }, { name: 'B', count: 1 }]
      return Object.keys(counts).map(name => ({ name, count: counts[name] }));
    };

    // 分別統計三種標籤的數量
    const dollData = countOccurrences(outfits.flatMap(o => o.doll ?? []).filter(Boolean));
    const styleData = countOccurrences(outfits.flatMap(o => o.style ?? []).filter(Boolean));
    const tagData = countOccurrences(outfits.flatMap(o => o.tags ?? []).filter(Boolean));

    const listHeaders = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      "apikey": SUPABASE_SERVICE_KEY,
      // 變更為 merge-duplicates：遇到相同的 name 時，覆寫（更新）其 count 數值
      "Prefer": "resolution=merge-duplicates",
    };

    const syncList = async (tableName, itemsData) => {
      if (itemsData.length === 0) return 0;
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?on_conflict=name`, {
        method: "POST",
        headers: listHeaders,
        body: JSON.stringify(itemsData)
      });
      
      if (!res.ok) {
        const errText = await res.text();
        console.error(`[Sync Error] ${tableName} 寫入失敗:`, errText);
        throw new Error(`Failed to sync ${tableName}: ${errText}`);
      }
      return itemsData.length;
    };

    // 等待所有清單同步完成
    await Promise.all([
      syncList('dolls', dollData),
      syncList('styles', styleData),
      syncList('tags', tagData)
    ]);

    // ── 回傳結果摘要 ───────────────────────────────────────────────
    return new Response(
      JSON.stringify({
        success: true,
        synced: outfits.length,
        notion_id_patched: (missingRows || []).filter((r: any) => notionNameMap[r.name]).length,
        // 新增：回傳各清單寫入了幾筆，方便確認
        lists_synced: {
          dolls:  dollData.length,   // 改為 dollData
          styles: styleData.length,  // 改為 styleData
          tags:   tagData.length,    // 改為 tagData
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
