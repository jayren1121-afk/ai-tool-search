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
def norm(s): return re.sub(r'\s+',' ',s).strip()
def price_section(txt,budget=4500):
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
