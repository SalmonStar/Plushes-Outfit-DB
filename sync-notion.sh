#!/bin/bash

echo "🔄 Syncing Notion → Supabase..."

RESULT=$(curl -s -X POST https://jakxuqbfplyohjshqnlp.supabase.co/functions/v1/sync-notion \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impha3h1cWJmcGx5b2hqc2hxbmxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxNDUxOTksImV4cCI6MjA5MzcyMTE5OX0.PtSj2MKFARo88C0Hp4HTRDobanaI2xPSG3goPmNkCLM")

echo "$RESULT"

if echo "$RESULT" | grep -q '"success":true'; then
  echo "✅ Sync 成功！"
else
  echo "❌ Sync 失敗，請確認網路或 Supabase 狀態"
fi
