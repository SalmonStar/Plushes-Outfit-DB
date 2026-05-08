# 娃衣圖書館 · Plushes Outfit Archive

> 一個用來整理、瀏覽、收藏娃娃造型的輕量圖書館。

🔗 **線上網址：** https://plushes-outfit-db.vercel.app/

---

## 功能介紹

- **瀏覽畫廊** — 響應式 Grid 排版，支援桌機與手機，圖片固定比例顯示
- **造型詳情** — 點擊任一卡片展開完整資訊（娃娃、款式、尺寸、產地、商家連結、備註）
- **多條件篩選** — 依款式、娃娃 chip、尺寸範圍、標籤進行篩選，支援篩選欄內關鍵字搜尋
- **全文搜尋** — 即時搜尋造型名稱與娃娃名稱
- **新增造型** — 填寫表單並上傳照片，資料即時寫入 Supabase DB，並非同步備份至 Notion
- **圖片壓縮** — 上傳前自動將圖片縮圖並轉換為 WebP 格式，節省儲存空間

---

## 技術架構

\`\`\`
使用者瀏覽器
     │
     │  靜態 HTML/CSS/JS（單一 index.html）
     │  部署於 Vercel
     │
     ├─── 讀取造型資料 ───────────────────────────────────────────────────┐
     │    GET /rest/v1/outfits                                           │
     │                                                                   ▼
     ├─── 讀取清單（娃娃 / 款式 / 標籤）─────────────────────────────────┤
     │    GET /rest/v1/dolls                                       Supabase
     │    GET /rest/v1/styles                                    PostgreSQL DB
     │    GET /rest/v1/tags                                             │
     │                                                                   │
     ├─── 新增造型 ───────────────────────────────────────────────────────┤
     │    POST /rest/v1/outfits（馬上寫入，立即顯示）                      │
     │                                                                   │
     └─── 上傳圖片 ──────────────────────────────────────────────────────┤
          PUT /storage/v1/object/outfit-photos/<filename>               │
                                                                        ▼
                                                           Supabase Storage
                                                           bucket: outfit-photos
                                                           CDN: Cloudflare
                                                           縮圖: Image Transform API

     新增造型後，背景非同步備份至 Notion：
     POST /functions/v1/notion-proxy  { action: "create" }
          └─ notion-proxy (Deno Edge Function)
               └─ POST https://api.notion.com/v1/pages
\`\`\`

| 層級 | 技術 |
|------|------|
| 前端 | 純 HTML / CSS / Vanilla JS（單一 `index.html`，無框架） |
| 主資料庫 | [Supabase](https://supabase.com) PostgreSQL — 造型快取、娃娃／款式／標籤清單 |
| 備份資料庫 | [Notion](https://notion.so) — 新增造型時非同步備份，方便人工管理 |
| 後端 API | [Supabase Edge Functions](https://supabase.com/docs/guides/functions) — `notion-proxy`（備份）、`sync-notion`（初始匯入） |
| 圖片儲存 | Supabase Storage（`outfit-photos` bucket） |
| 圖片 CDN | Supabase Storage 內建 CDN（Cloudflare）+ Image Transform API 生成縮圖 |
| 部署 | [Vercel](https://vercel.com) |

---

## 資料流說明

### 讀取造型

\`\`\`
index.html
  └─ GET /rest/v1/outfits?order=created_at.desc
       └─ Supabase PostgreSQL（outfits table）
            └─ 回傳 JSON → 前端解析並渲染畫廊
\`\`\`

### 新增造型

\`\`\`
index.html（使用者填表 + 選擇照片）
  ├─ 1. 圖片壓縮（Canvas → WebP, max 800px）
  ├─ 2. PUT Supabase Storage → 取得公開圖片 URL
  ├─ 3. POST /rest/v1/outfits → 寫入 Supabase DB（馬上出現在網站）
  ├─ 4. 自動把新娃娃／款式／標籤寫入對應 table
  └─ 5. 非同步 POST /functions/v1/notion-proxy { action: "create" }（備份）
\`\`\`

### 初始資料匯入（從 Notion 同步至 Supabase）

\`\`\`
curl -X POST .../functions/v1/sync-notion
  └─ sync-notion (Deno Edge Function)
       ├─ 從 Notion Database 拉所有造型
       └─ Upsert 進 Supabase outfits table
\`\`\`

---

## Supabase 資料表結構

### outfits
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 主鍵 |
| notion_id | text | Notion 頁面 ID（用於 upsert 防重複） |
| name | text | 造型名稱（必填） |
| doll | text | 試穿娃娃 |
| style | text[] | 款式（陣列） |
| size | numeric | 娃娃尺寸 cm |
| tags | text[] | 標籤（陣列） |
| note | text | 備註 |
| shop | text | 商家連結 |
| origin | text | 產地 |
| cover | text | 圖片 URL |
| created_at | timestamptz | 建立時間 |

### dolls / styles / tags
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 主鍵 |
| name | text | 名稱（unique） |
| created_at | timestamptz | 建立時間 |

---

## 專案結構

\`\`\`
/
├── index.html                           # 整個前端應用（HTML + CSS + JS）
├── README.md
└── supabase/
    └── functions/
        ├── notion-proxy/
        │   └── index.ts                 # Notion CRUD proxy（備份用）
        └── sync-notion/
            └── index.ts                 # 從 Notion 一次性匯入資料至 Supabase DB
\`\`\`

---

## 本地開發

這個專案是純靜態單頁，不需要任何 build 步驟。

\`\`\`bash
# 直接用瀏覽器打開，或用任意 static server
npx serve .
# 或
python3 -m http.server 8080
\`\`\`

開啟後連到 `http://localhost:8080` 即可。

> **注意：** 前端直接呼叫 Supabase API，需確保 `SB_URL` 與 `SB_KEY` 正確。

---

## 部署 Edge Functions

\`\`\`bash
# 安裝 Supabase CLI
npm install -g supabase

# 登入並連結專案
supabase login
supabase link --project-ref <your-project-ref>

# 設定 Notion Token（不要 commit 進 git！）
supabase secrets set NOTION_TOKEN=secret_xxxxxxxxxxxx

# 部署
supabase functions deploy notion-proxy
supabase functions deploy sync-notion
\`\`\`

---

## 環境變數 / 設定

### 前端（index.html 頂部 `<script>`）

\`\`\`js
const SB_URL = "https://<your-project>.supabase.co";
const SB_KEY = "<your-anon-key>";   // Supabase public anon key（可公開）
\`\`\`

### Edge Function 環境變數

| 變數名稱 | 說明 |
|----------|------|
| `NOTION_TOKEN` | Notion Integration Token（`secret_...`），**請勿 commit 至 git** |
| `SUPABASE_URL` | 自動由 Supabase 注入，無需手動設定 |
| `SUPABASE_SERVICE_ROLE_KEY` | 自動由 Supabase 注入，無需手動設定 |

---

## Notion 資料庫欄位（備份用）

| 欄位名稱 | 類型 | 說明 |
|----------|------|------|
| 娃衣名稱 | Title | 造型名稱（必填） |
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

如果這個專案對你有幫助，歡迎到 [GitHub](https://github.com/SalmonStar/Plushes-Outfit-DB) 給個 ⭐ 支持一下！
