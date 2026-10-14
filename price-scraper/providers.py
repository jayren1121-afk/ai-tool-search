"""LLM 提供者鏈。依 LLM_PROVIDERS 順序（預設 groq,openrouter,gemini,cerebras,mistral）；沒有設定 API key 的那家自動跳過。
每家的「每日額度用盡」(429 per-day / TPD / 402 額度不足) 或 key 無效 → 本次執行不再用該家，自動換下一家。
只有 groq + openai/gpt-oss-120b 的結果算「主要模型」；其他家一律記成 '<provider>:<model>'，final.py 會標 llm_fallback_model、不進自動核准清單。
新增一家：在 PROVIDERS 加一筆（OpenAI 相容的 chat/completions 端點），並在 workflow 的 env 加上對應的 secret。"""
import json,os,time,re,urllib.request,urllib.error
from collections import deque

PRIMARY_MODEL='openai/gpt-oss-120b'
def _env(k,d=None):
    v=os.environ.get(k); return v.strip() if v and v.strip() else d

PROVIDERS={
 'groq':dict(key='GROQ_API_KEY',base='GROQ_BASE_URL',url='https://api.groq.com/openai/v1',model_env='LLM_MODEL',model=PRIMARY_MODEL,
             tpm=7400,min_interval=0,style='groq'),
 'openrouter':dict(key='OPENROUTER_API_KEY',base='OPENROUTER_BASE_URL',url='https://openrouter.ai/api/v1',model_env='OPENROUTER_MODEL',
             model='nvidia/nemotron-3-super-120b-a12b:free',tpm=0,min_interval=3.5,style='openrouter'),   # 免費模型 20 次/分鐘
 'gemini':dict(key='GEMINI_API_KEY',base='GEMINI_BASE_URL',url='https://generativelanguage.googleapis.com/v1beta/openai',model_env='GEMINI_MODEL',
             model='gemini-3.8-flash',tpm=0,min_interval=6.5,style='gemini'),   # Google Gemini 免費方案（OpenAI 相容端點）；免費額度每分鐘次數少，每次間隔 6.5 秒
 'cerebras':dict(key='CEREBRAS_API_KEY',base='CEREBRAS_BASE_URL',url='https://api.cerebras.ai/v1',model_env='CEREBRAS_MODEL',
             model='gpt-oss-120b',tpm=50000,min_interval=2.2,style='cerebras'),
 'mistral':dict(key='MISTRAL_API_KEY',base='MISTRAL_BASE_URL',url='https://api.mistral.ai/v1',model_env='MISTRAL_MODEL',
             model='mistral-small-latest',tpm=0,min_interval=1.5,style='mistral'),
}

class ProviderDown(Exception):
    """這一家本次不能再用（每日額度用盡、key 無效、模型不存在…）"""
class PageError(Exception):
    """這一頁在這一家失敗（例如回傳不是 JSON），換下一頁"""

class Provider:
    def __init__(self,name,cfg):
        self.name=name; self.cfg=cfg; self.key=_env(cfg['key'])
        self.base=(_env(cfg['base']) or cfg['url']).rstrip('/')
        self.model=_env(cfg['model_env']) or cfg['model']
        self.down=None; self.win=deque(); self.recent=deque(maxlen=6); self.last=0.0
        self.stats=dict(calls=0,ok=0,tokens=0,rl429=0,errors=0)
        self.consec_fail=0; self.autopicked=False
    @property
    def label(self):   # 寫進 llm.jsonl 的 model 欄位
        return self.model if self.name=='groq' else f'{self.name}:{self.model}'
    @property
    def is_primary(self): return self.name=='groq' and self.model==PRIMARY_MODEL
    def throttle(self):
        if _env('LLM_NO_THROTTLE')=='1': return   # 只給離線測試用
        tpm=self.cfg['tpm']; mi=self.cfg['min_interval']
        if mi:
            w=mi-(time.time()-self.last)
            if w>0: time.sleep(w)
        if tpm:
            est=int(sum(self.recent)/len(self.recent)*1.2) if self.recent else 3000
            while True:
                now=time.time()
                while self.win and now-self.win[0][0]>62: self.win.popleft()
                if sum(t for _,t in self.win)+est<=tpm or not self.win: break
                time.sleep(min(10,max(1,62-(now-self.win[0][0]))))
    def body(self,sys_prompt,prompt,attempt):
        st=self.cfg['style']
        b={"model":self.model,"messages":[{"role":"system","content":sys_prompt},{"role":"user","content":prompt}],"temperature":0}
        if attempt==0: b["response_format"]={"type":"json_object"}
        if st=='groq': b.update(max_tokens=1800 if attempt==0 else 3000,reasoning_effort="low")
        elif st=='openrouter': b.update(max_tokens=6000 if attempt==0 else 9000,reasoning={"effort":"low"})
        elif st=='gemini': b.update(max_tokens=6000 if attempt==0 else 9000,reasoning_effort="low")
        elif st=='cerebras': b.update(max_completion_tokens=3000 if attempt==0 else 5000,reasoning_effort="low")
        else: b.update(max_tokens=3000)
        return b
    def post(self,body):
        h={"Authorization":"Bearer "+self.key,"Content-Type":"application/json","User-Agent":"jAytalPriceBot/1.0"}
        if self.cfg['style']=='openrouter': h.update({"HTTP-Referer":"https://www.jaytaimark.com","X-Title":"ai-tool-search price update"})
        req=urllib.request.Request(self.base+"/chat/completions",data=json.dumps(body).encode(),headers=h)
        return urllib.request.urlopen(req,timeout=int(_env('LLM_HTTP_TIMEOUT','150')))
    def autopick(self):
        """OpenRouter：設定的模型不存在時，從目前免費模型清單挑一個（支援 response_format、上下文 ≥32K、參數越大越前面）"""
        if self.cfg['style']!='openrouter' or self.autopicked: return False
        self.autopicked=True
        try:
            d=json.loads(urllib.request.urlopen(urllib.request.Request(self.base+'/models',headers={"User-Agent":"jAytalPriceBot/1.0"}),timeout=30).read())['data']
        except Exception: return False
        m=pick_free_model(d,exclude={self.model})
        if not m: return False
        print(f'[openrouter] 模型 {self.model} 無法使用，自動改用免費模型 {m}',flush=True); self.model=m; return True

def is_free(m):
    p=m.get('pricing') or {}
    try: return float(p.get('prompt',1))==0 and float(p.get('completion',1))==0
    except Exception: return False
def pick_free_model(models,exclude=()):
    c=[m for m in models if is_free(m) and m['id'] not in exclude and m['id']!='openrouter/free'
       and 'response_format' in (m.get('supported_parameters') or []) and (m.get('context_length') or 0)>=32000
       and 'text' in ((m.get('architecture') or {}).get('output_modalities') or ['text'])
       and not re.search(r'safety|guard|lyria|image|audio|tts|embed',m['id'],re.I)]
    def size(m):
        x=re.findall(r'(\d+(?:\.\d+)?)b\b',m['id'].lower()); return max(map(float,x)) if x else 0
    c.sort(key=lambda m:(-size(m),-(m.get('context_length') or 0)))
    return c[0]['id'] if c else None

DAILY=re.compile(r'per[ -]day|tpd|rpd|daily|free-models-per-day|quota',re.I)
MINUTE=re.compile(r'per ?minute|PerMinute',re.I)
def classify_429(body,headers,style=None):
    ra=headers.get('retry-after') if headers else None
    try: ra=float(ra) if ra else None
    except ValueError: ra=None
    if style=='gemini':   # Gemini：429 RESOURCE_EXHAUSTED / quota → 視為今天免費額度用完（除非明確寫每分鐘限制）
        if MINUTE.search(body or '') and not re.search(r'per ?day|PerDay',body or '',re.I): return 'minute',ra
        return 'daily',ra
    if DAILY.search(body or '') or (ra is not None and ra>900): return 'daily',ra
    return 'minute',ra

def extract_json(msg):
    if msg is None: raise ValueError('empty content')
    try: return json.loads(msg)
    except Exception:
        m=re.search(r'\{.*\}',msg,re.S)
        if not m: raise ValueError('bad json')
        return json.loads(m.group(0))

def call_page(pv,sys_prompt,prompt,sleep=time.sleep):
    """回傳 (obj,usage,attempts,finish)。每日額度用盡/金鑰問題 → ProviderDown；這頁失敗 → PageError。"""
    last_err=''
    for attempt in range(6):
        pv.throttle()
        try:
            pv.last=time.time(); resp=pv.post(pv.body(sys_prompt,prompt,min(attempt,1)))
            data=json.loads(resp.read())
            if 'error' in data and not data.get('choices'):   # OpenRouter 有時以 200 回傳錯誤
                e=data['error']; code=int(e.get('code') or 500) if str(e.get('code','')).isdigit() else 500
                raise urllib.error.HTTPError(pv.base,code,str(e.get('message')),{},None)
            usage=data.get('usage') or {}; used=int(usage.get('total_tokens') or 0)
            pv.win.append((time.time(),used)); pv.recent.append(used or 2500); pv.stats['calls']+=1; pv.stats['tokens']+=used
            ch=data['choices'][0]; obj=extract_json(ch['message'].get('content'))
            if not isinstance(obj,dict): raise ValueError('not an object')
            pv.consec_fail=0; return obj,usage,attempt+1,ch.get('finish_reason')
        except urllib.error.HTTPError as e:
            try: b=e.read().decode('utf-8','replace')[:600]
            except Exception: b=str(e.reason if hasattr(e,'reason') else e)
            b=b or str(getattr(e,'msg',''))
            last_err=f'HTTP {e.code} {b[:200]}'
            if e.code==429:
                pv.stats['rl429']+=1; kind,ra=classify_429(b,e.headers,pv.cfg['style'])
                if kind=='daily': raise ProviderDown(f'{pv.name} 每日額度用盡（429）：{b[:160]}')
                if attempt>=4: raise ProviderDown(f'{pv.name} 連續被限流：{b[:160]}')
                sleep((ra or 20)+1); continue
            if e.code in (401,403): raise ProviderDown(f'{pv.name} 金鑰無效或沒有權限（HTTP {e.code}）：{b[:160]}')
            if e.code==400 and re.search(r'API[ _]?key',b,re.I): raise ProviderDown(f'{pv.name} 金鑰無效或沒有權限（HTTP 400）：{b[:160]}')
            if e.code==402: raise ProviderDown(f'{pv.name} 額度/點數不足（HTTP 402）：{b[:160]}')
            if e.code==404 or (e.code==400 and re.search(r'model|endpoint',b,re.I) and not re.search(r'json',b,re.I)):
                if pv.autopick(): continue
                raise ProviderDown(f'{pv.name} 模型 {pv.model} 無法使用（HTTP {e.code}）：{b[:160]}')
            if e.code==400 and re.search(r'json|response_format',b,re.I): sleep(2); continue
            if e.code>=500: sleep(5*(attempt+1)); continue
            raise PageError(last_err)
        except (ProviderDown,PageError): raise
        except Exception as e:
            last_err=f'{type(e).__name__}: {str(e)[:150]}'
            if attempt>=2: raise PageError(last_err)
            sleep(3)
    raise PageError('retries exhausted: '+last_err)

def build_chain(log=print):
    order=[x.strip() for x in (_env('LLM_PROVIDERS') or 'groq,openrouter,gemini,cerebras,mistral').split(',') if x.strip()]
    chain=[];skipped=[]
    for n in order:
        if n not in PROVIDERS: log(f'未知的提供者 {n}，略過'); continue
        p=Provider(n,PROVIDERS[n])
        if not p.key: skipped.append(n); continue
        chain.append(p)
    return chain,skipped
