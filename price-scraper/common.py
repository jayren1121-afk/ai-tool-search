import re,json,hashlib,os
UA="jAytalPriceBot/1.0 (+https://www.jaytaimark.com)"
CODE=os.path.dirname(os.path.abspath(__file__))
# 資料（checkpoint、輸出）放在 PRICE_DATA_DIR（GitHub Actions 中是 price-data 分支的資料夾）；未設定時用程式所在資料夾
BASE=os.path.abspath(os.environ.get('PRICE_DATA_DIR') or CODE)
DATASET=os.environ.get('AI_TOOLS_DATASET') or os.path.join(CODE,'ai_tools.json')
os.makedirs(BASE+'/text',exist_ok=True)
def uhash(url): return hashlib.sha1(url.encode()).hexdigest()[:12]
CUR=r'(?:US\$|NT\$|A\$|C\$|HK\$|R\$|\$|€|£|¥|₩|₹|元|USD|EUR|GBP)'
AMT=re.compile(CUR+r'\s{0,3}\d[\d,]*(?:\.\d+)?|\b\d[\d,]*(?:\.\d+)?\s?(?:USD|EUR|GBP|€|元)')
HINT=re.compile(r'/\s?(?:mo|month|yr|year|user|seat)|per\s+(?:month|year|user|seat|member|editor)|billed|annual|monthly|yearly|free\b|\bfree plan|trial|custom pricing|contact sales|starting|credits',re.I)
MARK=re.compile(r'^=== 計費模式: .* ===$')
def sec_hash(sec): return hashlib.sha1((sec or '').encode()).hexdigest()[:16]
def fresh(l,sc):
    """LLM 結果是不是用「目前這份抓取文字」做的（文字指紋 sec_hash 相同）。舊結果沒有指紋：抓取也是舊版、或重抓後文字沒變 → 算新鮮。"""
    if not sc or not sc.get('sec_hash'): return True
    if l.get('sec_hash'): return l['sec_hash']==sc['sec_hash']
    return sc.get('prev_sec_hash')==sc['sec_hash']
MARK_IN=re.compile(r'=== 計費模式: [^=]*?\((default|monthly|yearly|toggled)\)[^=]*===')
def billing_sections(N,q):
    """引文 q 在（正規化後的）全文 N 中出現的所有位置，各自屬於哪個計費模式段落：回傳 {'default','monthly','yearly','toggled'} 子集；沒有段落標記回傳空集合。
    預設畫面若標記為「＝年繳/月繳」，也算該模式。"""
    marks=[(m.start(),m.group(0)) for m in MARK_IN.finditer(N)]
    if not marks or not q: return set()
    out=set(); key=q.split(' … ')[-1]
    for o in [m.start() for m in re.finditer(re.escape(key),N)]:
        prev=[t for p,t in marks if p<=o]
        if not prev: continue
        t=prev[-1]
        if '＝年繳' in t: out.add('yearly'); continue
        if '＝月繳' in t: out.add('monthly'); continue
        for k in ('default','monthly','yearly','toggled'):
            if f'({k})' in t: out.add(k); break
    return out
def norm(s): return re.sub(r'\s+',' ',s).strip()
def price_section(txt,budget=4500):
    """有計費模式段落標記時：每段各自擷取，保留標記行；總長上限放寬到 7500。"""
    lines=txt.split('\n')
    if any(MARK.match(l.strip()) for l in lines):
        parts=[];cur=None;buf=[]
        for l in lines:
            if MARK.match(l.strip()):
                if cur is not None or buf: parts.append((cur,'\n'.join(buf)))
                cur=l.strip();buf=[]
            else: buf.append(l)
        parts.append((cur,'\n'.join(buf)))
        parts=[(m,b) for m,b in parts if m]
        each=max(1500,7500//max(1,len(parts)))
        return '\n'.join(f"{m}\n{_section(b,each)}" for m,b in parts)
    return _section(txt,budget)
def _section(txt,budget=4500):
    lines=[l.strip() for l in txt.split('\n')]
    lines=[l[:240] for l in lines]
    n=len(lines); hit=[False]*n; amt=[False]*n
    for i,l in enumerate(lines):
        if not l: continue
        if AMT.search(l): hit[i]=amt[i]=True
        elif HINT.search(l) and len(l)<160: hit[i]=True
    keep=[False]*n
    for i in range(n):
        if amt[i]:
            for j in range(max(0,i-4),min(n,i+4)): keep[j]=True
        elif hit[i]:
            keep[i]=True
            for j in range(max(0,i-1),min(n,i+2)): keep[j]=True
    out=[];size=0;prev=-2
    # priority: windows containing amounts first, in page order, budget-limited
    for i in range(n):
        if keep[i] and lines[i]:
            add=len(lines[i])+1
            if size+add>budget: break
            if i!=prev+1 and out: out.append('---'); size+=4
            out.append(lines[i]); size+=add; prev=i
    return '\n'.join(out)
def tools():
    return json.load(open(DATASET))
