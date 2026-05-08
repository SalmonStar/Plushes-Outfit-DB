# 娃衣圖書館 · Plushes Outfit Archive

> 一個用來整理、瀏覽、收藏娃娃造型的輕量圖書館。

🔗 **線上網址：** [https://plushes-outfit-db.vercel.app/](https://plushes-outfit-db.vercel.app/)

---

## 功能介紹

- **瀏覽畫廊** — 響應式 Grid 排版，支援桌機與手機，圖片固定比例顯示
- **造型詳情** — 點擊任一卡片展開完整資訊（娃娃、款式、尺寸、產地、商家連結、備註）
- **多條件篩選** — 依款式、娃娃、尺寸範圍、標籤進行篩選，支援篩選欄內關鍵字搜尋
- **全文搜尋** — 即時搜尋造型名稱與娃娃名稱
- **新增造型** — 填寫表單並上傳照片，資料會自動寫入 Notion 資料庫
- **圖片壓縮** — 上傳前自動將圖片縮圖並轉換為 WebP 格式，節省儲存空間

---

## 技術架構

| 層級 | 技術 |
|------|------|
| 前端 | 純 HTML / CSS / Vanilla JS（單一 `index.html`，無框架） |
| 資料庫 | [Notion](https://notion.so) — 以 Database 作為造型資料來源 |
| 後端 API | [Supabase Edge Functions](https://supabase.com/docs/guides/functions) — `notion-proxy` 處理 Notion CRUD |
| 圖片儲存 | Supabase Storage（`outfit-photos` bucket） |
| 圖片 CDN | Supabase Storage 內建 CDN（Cloudflare）+ Image Transform API 生成縮圖 |
| 部署 | [Vercel](https://vercel.com) |

---

## 專案結構

```
/
└── index.html    # 整個應用程式（前端 + 所有邏輯）
```

---

## 本地開發

這個專案是純靜態單頁，不需要任何 build 步驟。

```bash
# 直接用瀏覽器打開，或用任意 static server
npx serve .
# 或
python3 -m http.server 8080
```

開啟後連到 `http://localhost:8080` 即可。

> **注意：** 前端直接呼叫 Supabase API，需確保 `SB_URL` 與 `SB_KEY` 正確，且 Supabase Edge Function `notion-proxy` 已部署。

---

## 環境變數 / 設定

目前設定值直接寫在 `index.html` 頂部的 `<script>` 區塊：

```js
const SB_URL = "https://<your-project>.supabase.co";
const SB_KEY = "<your-anon-key>";
```

若要部署到自己的環境，替換這兩個值即可。Notion 的連接設定（Database ID、Token）則放在 Supabase Edge Function 的環境變數中。

---

## Notion 資料庫欄位

| 欄位名稱 | 類型 | 說明 |
|----------|------|------|
| 娃衣名稱 | Title | 造型名稱（必填）|
| 試穿娃娃 | Select | 使用的娃娃 |
| 款式 | Multi-select | 例：上衣、配件、套裝 |
| 娃娃尺寸 | Number | 單位 cm |
| 標籤 | Multi-select | 自由標籤 |
| 產地 | Select | 台灣 / 日本 / 韓國 / 中國 / 不確定 |
| 商家連結或名稱 | Rich Text | 商家名稱或完整網址 |
| 備註 | Rich Text | 穿搭心得、尺寸建議等 |

---

## 授權

本專案為個人收藏用途，程式碼可自由參考與修改。
