-- supabase_migration_006_release_dates.sql — 替既有工具補「推出日期」released_at（需先執行 supabase_migration_005.sql）
-- 由 ai-tools-dataset/backfill_release_dates.py 於 2026-10-09 產生；共 48 / 498 筆有可靠來源。
-- 來源：wikidata_p577（Wikidata 發布日期）、wikidata_p571（Wikidata 創立日期，僅限非公司實體）、github_created（GitHub repo 建立日）。
-- Wikidata 只採用「官方網站 P856 與工具網址主網域一致」且精確到日的資料；查不到的工具維持空白（不猜測）。
-- 只會填入目前為空的欄位（不覆蓋你手動修改過的日期）；可重複執行。
begin;
update public.ai_tools set released_at = '2022-12-03', released_source = 'github_created' where id = 'activepieces' and released_at is null;  -- https://github.com/activepieces/activepieces
update public.ai_tools set released_at = '2023-04-07', released_source = 'github_created' where id = 'agentgpt' and released_at is null;  -- https://github.com/reworkd/AgentGPT
update public.ai_tools set released_at = '2023-05-09', released_source = 'github_created' where id = 'aider' and released_at is null;  -- https://github.com/Aider-AI/aider
update public.ai_tools set released_at = '2023-03-16', released_source = 'github_created' where id = 'autogpt' and released_at is null;  -- https://github.com/Significant-Gravitas/AutoGPT
update public.ai_tools set released_at = '2024-10-31', released_source = 'github_created' where id = 'browser-use' and released_at is null;  -- https://github.com/browser-use/browser-use
update public.ai_tools set released_at = '2022-09-17', released_source = 'wikidata_p571' where id = 'character-ai' and released_at is null;  -- https://www.wikidata.org/wiki/Q115517493#P571
update public.ai_tools set released_at = '2022-11-30', released_source = 'wikidata_p577' where id = 'chatgpt' and released_at is null;  -- https://www.wikidata.org/wiki/Q115564437#P577
update public.ai_tools set released_at = '2022-10-11', released_source = 'github_created' where id = 'civitai' and released_at is null;  -- https://github.com/civitai/civitai
update public.ai_tools set released_at = '2024-07-06', released_source = 'github_created' where id = 'cline' and released_at is null;  -- https://github.com/cline/cline
update public.ai_tools set released_at = '2023-01-17', released_source = 'github_created' where id = 'comfyui' and released_at is null;  -- https://github.com/Comfy-Org/ComfyUI
update public.ai_tools set released_at = '2023-10-27', released_source = 'github_created' where id = 'crewai' and released_at is null;  -- https://github.com/crewAIInc/crewAI
update public.ai_tools set released_at = '2023-01-23', released_source = 'wikidata_p577' where id = 'cursor' and released_at is null;  -- https://www.wikidata.org/wiki/Q131980386#P577
update public.ai_tools set released_at = '2017-08-28', released_source = 'wikidata_p571' where id = 'deepl' and released_at is null;  -- https://www.wikidata.org/wiki/Q43968444#P571
update public.ai_tools set released_at = '2025-01-10', released_source = 'wikidata_p577' where id = 'deepseek' and released_at is null;  -- https://www.wikidata.org/wiki/Q132324293#P577
update public.ai_tools set released_at = '2023-04-12', released_source = 'github_created' where id = 'dify' and released_at is null;  -- https://github.com/langgenius/dify
update public.ai_tools set released_at = '2022-08-19', released_source = 'github_created' where id = 'dust' and released_at is null;  -- https://github.com/dust-tt/dust
update public.ai_tools set released_at = '2023-03-16', released_source = 'wikidata_p571' where id = 'ernie' and released_at is null;  -- https://www.wikidata.org/wiki/Q116894099#P571
update public.ai_tools set released_at = '2023-08-17', released_source = 'github_created' where id = 'facefusion' and released_at is null;  -- https://github.com/facefusion/facefusion
update public.ai_tools set released_at = '2024-04-15', released_source = 'github_created' where id = 'firecrawl' and released_at is null;  -- https://github.com/firecrawl/firecrawl
update public.ai_tools set released_at = '2023-03-31', released_source = 'github_created' where id = 'flowise' and released_at is null;  -- https://github.com/FlowiseAI/Flowise
update public.ai_tools set released_at = '2023-02-06', released_source = 'wikidata_p577' where id = 'gemini' and released_at is null;  -- https://www.wikidata.org/wiki/Q116698014#P577
update public.ai_tools set released_at = '2025-04-17', released_source = 'github_created' where id = 'gemini-cli' and released_at is null;  -- https://github.com/google-gemini/gemini-cli
update public.ai_tools set released_at = '2006-04-28', released_source = 'wikidata_p577' where id = 'google-translate' and released_at is null;  -- https://www.wikidata.org/wiki/Q135622#P577
update public.ai_tools set released_at = '2023-01-03', released_source = 'wikidata_p577' where id = 'gptzero' and released_at is null;  -- https://www.wikidata.org/wiki/Q122791560#P577
update public.ai_tools set released_at = '2023-11-04', released_source = 'wikidata_p571' where id = 'grok' and released_at is null;  -- https://www.wikidata.org/wiki/Q123361035#P571
update public.ai_tools set released_at = '2022-12-07', released_source = 'github_created' where id = 'immersive-translate' and released_at is null;  -- https://github.com/immersive-translate/immersive-translate
update public.ai_tools set released_at = '2023-08-17', released_source = 'github_created' where id = 'jan' and released_at is null;  -- https://github.com/janhq/jan
update public.ai_tools set released_at = '2025-06-17', released_source = 'github_created' where id = 'kiro' and released_at is null;  -- https://github.com/kirodotdev/Kiro
update public.ai_tools set released_at = '2023-02-08', released_source = 'github_created' where id = 'langflow' and released_at is null;  -- https://github.com/langflow-ai/langflow
update public.ai_tools set released_at = '2005-08-15', released_source = 'wikidata_p577' where id = 'languagetool' and released_at is null;  -- https://www.wikidata.org/wiki/Q15991270#P577
update public.ai_tools set released_at = '2023-02-12', released_source = 'github_created' where id = 'librechat' and released_at is null;  -- https://github.com/LibreChat-AI/LibreChat
update public.ai_tools set released_at = '2025-03-06', released_source = 'wikidata_p571' where id = 'manus' and released_at is null;  -- https://www.wikidata.org/wiki/Q133102805#P571
update public.ai_tools set released_at = '2023-06-20', released_source = 'github_created' where id = 'mem0' and released_at is null;  -- https://github.com/mem0ai/mem0
update public.ai_tools set released_at = '2022-07-12', released_source = 'wikidata_p577' where id = 'midjourney' and released_at is null;  -- https://www.wikidata.org/wiki/Q113070628#P577
update public.ai_tools set released_at = '2019-06-22', released_source = 'github_created' where id = 'n8n' and released_at is null;  -- https://github.com/n8n-io/n8n
update public.ai_tools set released_at = '2023-06-26', released_source = 'github_created' where id = 'ollama' and released_at is null;  -- https://github.com/ollama/ollama
update public.ai_tools set released_at = '2023-10-06', released_source = 'github_created' where id = 'open-webui' and released_at is null;  -- https://github.com/open-webui/open-webui
update public.ai_tools set released_at = '2024-02-28', released_source = 'github_created' where id = 'operator-skyvern' and released_at is null;  -- https://github.com/Skyvern-AI/skyvern
update public.ai_tools set released_at = '2020-01-22', released_source = 'github_created' where id = 'pipedream' and released_at is null;  -- https://github.com/PipedreamHQ/pipedream
update public.ai_tools set released_at = '2024-02-15', released_source = 'wikidata_p577' where id = 'sora' and released_at is null;  -- https://www.wikidata.org/wiki/Q124544998#P577
update public.ai_tools set released_at = '2022-08-22', released_source = 'wikidata_p571' where id = 'stable-diffusion' and released_at is null;  -- https://www.wikidata.org/wiki/Q113660857#P571
update public.ai_tools set released_at = '2024-04-10', released_source = 'wikidata_p577' where id = 'udio' and released_at is null;  -- https://www.wikidata.org/wiki/Q125475915#P577
update public.ai_tools set released_at = '2023-05-13', released_source = 'github_created' where id = 'vanna' and released_at is null;  -- https://github.com/vanna-ai/vanna
update public.ai_tools set released_at = '2021-07-08', released_source = 'github_created' where id = 'warp' and released_at is null;  -- https://github.com/warpdotdev/warp
update public.ai_tools set released_at = '2022-09-16', released_source = 'github_created' where id = 'whisper' and released_at is null;  -- https://github.com/openai/whisper
update public.ai_tools set released_at = '2020-12-08', released_source = 'wikidata_p571' where id = 'you-com' and released_at is null;  -- https://www.wikidata.org/wiki/Q111598768#P571
update public.ai_tools set released_at = '2024-05-30', released_source = 'wikidata_p577' where id = 'yuanbao' and released_at is null;  -- https://www.wikidata.org/wiki/Q133282409#P577
update public.ai_tools set released_at = '2021-02-20', released_source = 'github_created' where id = 'zed' and released_at is null;  -- https://github.com/zed-industries/zed
commit;

-- 檢查：select released_source, count(*) from public.ai_tools group by 1 order by 2 desc;
