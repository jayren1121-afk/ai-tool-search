"""離線測試提供者鏈（不用真實金鑰、不連外部 AI）：本機假伺服器模擬 Groq/OpenRouter 的成功、429(每分鐘/每日)、404。
用法：python3 tests/test_chain.py /path/to/data_copy   （data_copy 需有 scrape.jsonl、text/；會被寫入，請用複本）"""
import json,os,sys,threading,subprocess,re,shutil,collections
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
HERE=os.path.dirname(os.path.abspath(__file__)); CODE=os.path.dirname(HERE)
DATA=os.path.abspath(sys.argv[1])
V1={}
for f in ('llm_v1.jsonl','llm.jsonl'):
    p=os.path.join(DATA,f)
    if os.path.exists(p):
        for l in open(p):
            r=json.loads(l)
            if r.get('llm_status')=='ok': V1[r['url']]=r['result']
MODELS=json.load(open(os.environ.get('OR_MODELS_JSON','/tmp/or_models.json')))
S=dict(groq_ok_left=2,groq_minute_429_once=True,or_mode='ok',or_404_model=None,calls=collections.Counter(),bodies=[])
class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def send(self,code,obj,headers={}):
        b=json.dumps(obj).encode(); self.send_response(code)
        for k,v in headers.items(): self.send_header(k,v)
        self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self):
        if self.path.endswith('/models'): return self.send(200,MODELS)
        self.send(404,{})
    def ok(self,body):
        url=re.search(r'Product page: (\S+)',body['messages'][1]['content']).group(1)
        res=V1.get(url,{"plans":[],"free_tier":{"available":None}})
        return self.send(200,{"choices":[{"message":{"content":json.dumps(res)},"finish_reason":"stop"}],"usage":{"total_tokens":2000,"prompt_tokens":1500}})
    def do_POST(self):
        body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        auth=self.headers.get('Authorization','')
        S['bodies'].append((self.path,body.get('model')))
        if self.path.startswith('/groq'):
            S['calls']['groq']+=1
            if auth!='Bearer FAKE-GROQ': return self.send(401,{"error":{"message":"Invalid API Key"}})
            if S['groq_minute_429_once']:
                S['groq_minute_429_once']=False
                return self.send(429,{"error":{"message":"Rate limit reached for model openai/gpt-oss-120b on tokens per minute (TPM): Limit 8000"}},{'retry-after':'1'})
            if S['groq_ok_left']<=0:
                return self.send(429,{"error":{"message":"Rate limit reached for model `openai/gpt-oss-120b` in organization on tokens per day (TPD): Limit 200000, Used 199000"}},{'retry-after':'2000'})
            S['groq_ok_left']-=1; return self.ok(body)
        if self.path.startswith('/or'):
            S['calls']['openrouter']+=1
            if body.get('model')==S['or_404_model']: return self.send(404,{"error":{"message":"No endpoints found for "+body['model'],"code":404}})
            if S['or_mode']=='daily': return self.send(429,{"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 credits to unlock 1000 free model requests per day","code":429}})
            return self.ok(body)
        self.send(404,{})
srv=ThreadingHTTPServer(('127.0.0.1',0),H); port=srv.server_address[1]
threading.Thread(target=srv.serve_forever,daemon=True).start()
def runllm(env_extra,limit):
    env={k:v for k,v in os.environ.items() if not k.endswith('_API_KEY')}
    env.update(PRICE_DATA_DIR=DATA,GROQ_BASE_URL=f'http://127.0.0.1:{port}/groq',OPENROUTER_BASE_URL=f'http://127.0.0.1:{port}/or',LLM_LIMIT=str(limit),LLM_NO_THROTTLE='1',**env_extra)
    p=subprocess.run([sys.executable,'llm.py'],cwd=CODE,env=env,capture_output=True,text=True,timeout=600)
    return p.stdout+p.stderr,json.load(open(os.path.join(DATA,'llm_run.json')))
def rows():
    return [json.loads(l) for l in open(os.path.join(DATA,'llm.jsonl'))]
fails=[]
def check(c,msg):
    print(('PASS ' if c else 'FAIL ')+msg); (None if c else fails.append(msg))
n0=len(rows())
# 1) 沒有任何金鑰 → 不呼叫、正常結束
out,run=runllm({},3); check(run['pages_done']==0 and 'groq' in run['skipped_no_key'] and 'openrouter' in run['skipped_no_key'],'沒有金鑰：全部跳過且不報錯')
# 2) Groq：每分鐘 429 會等待重試；成功 2 頁後每日額度(TPD)用盡 → 自動換 OpenRouter（只設 Groq+OpenRouter，Cerebras/Mistral 沒 key 要跳過）
out,run=runllm(dict(GROQ_API_KEY='FAKE-GROQ',OPENROUTER_API_KEY='FAKE-OR'),5)
new=rows()[n0:]; n1=len(rows())
check([r['provider'] for r in new]==['groq','groq','openrouter','openrouter','openrouter'],f"Groq 2 頁 → TPD → OpenRouter 3 頁：{[r['provider'] for r in new]}")
check(new[0]['model']=='openai/gpt-oss-120b' and new[2]['model'].startswith('openrouter:'),'model 欄位：Groq=openai/gpt-oss-120b，備援=openrouter:<模型>')
check(run['per_provider']['groq']['down'] and '每日額度' in run['per_provider']['groq']['down'],'Groq 標記為每日額度用盡')
check(run['per_provider']['groq']['rl429']>=2,'每分鐘 429 有重試（rl429>=2）')
check(set(run['skipped_no_key'])=={'cerebras','mistral'},'Cerebras/Mistral 沒 key → 跳過')
# 3) OpenRouter 設定的模型不存在(404) → 自動從免費清單挑模型
S['groq_ok_left']=0; S['or_404_model']='bogus/nonexistent:free'
out,run=runllm(dict(GROQ_API_KEY='FAKE-GROQ',OPENROUTER_API_KEY='FAKE-OR',OPENROUTER_MODEL='bogus/nonexistent:free'),2)
new=rows()[n1:]; n2=len(rows())
check(len(new)==2 and all(r['provider']=='openrouter' and 'bogus' not in r['model'] for r in new),f"404 → 自動改用免費模型：{[r['model'] for r in new]}")
# 4) 所有家都每日額度用盡 → 停止並寫原因
S['or_mode']='daily'
out,run=runllm(dict(GROQ_API_KEY='FAKE-GROQ',OPENROUTER_API_KEY='FAKE-OR'),5)
check(run['pages_done']==0 and '額度都用完' in (run['stopped_reason'] or ''),f"全部用盡 → 停止：{run['stopped_reason']}")
# 5) 金鑰錯誤 → 停用該家（不重試、不當機）
out,run=runllm(dict(GROQ_API_KEY='WRONG',LLM_PROVIDERS='groq'),2)
check('金鑰無效' in (run['per_provider']['groq']['down'] or ''),'金鑰錯誤 → 停用並註明「金鑰無效」')
# 6) 隔天 Groq 有額度：先處理沒做過的，再把備援結果用 120b 重做
S['groq_ok_left']=1000; S['or_mode']='ok'
out,run=runllm(dict(GROQ_API_KEY='FAKE-GROQ',ONLY_UPGRADE_TEST='1'),1000)
best={}
for r in rows():
    k=(2 if r.get('llm_status')=='ok' and r.get('provider','groq')=='groq' else 1 if r.get('llm_status')=='ok' else 0)
    if r['url'] not in best or k>=best[r['url']]: best[r['url']]=k
check(all(v==2 for v in best.values()) and run['upgraded']==5,f"Groq 恢復後全部改用 120b（重做 {run['upgraded']} 頁）")
print('\n'.join(['','全部通過' if not fails else f'{len(fails)} 項失敗：{fails}']))
sys.exit(1 if fails else 0)
