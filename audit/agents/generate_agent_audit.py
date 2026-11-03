"""Read-only upstream audit; standard library only. Writes exclusively beside this file.
No upstream scripts are executed; no DSH interface or runtime claim is made.
"""
from pathlib import Path
from collections import Counter
import hashlib, json, re, textwrap, datetime

SOURCE = Path(r'C:\Users\Administrator\Downloads\financial-services-main').resolve()
OUT = Path(__file__).resolve().parent
EXPECTED_OUT = Path(r'C:\Users\Administrator\Documents\deepseek-harness\default-workspace\financial-services-bundle\audit\agents').resolve()
assert OUT == EXPECTED_OUT
TASK = Path(r'C:\Users\Administrator\Downloads\Financial_Services_DSH_Creator_Prompt_v1.md')
ORDER = ['pitch-agent','market-researcher','earnings-reviewer','meeting-prep-agent','model-builder','gl-reconciler','kyc-screener','valuation-reviewer','month-end-closer','statement-auditor']

def sha(data): return hashlib.sha256(data).hexdigest()
def text(p):
    p = p.resolve()
    assert p.is_relative_to(SOURCE) or p == TASK or p.is_relative_to(OUT)
    return p.read_text(encoding='utf-8-sig')
def relative(p): return p.resolve().relative_to(SOURCE).as_posix()
def file_record(p):
    b = p.read_bytes()
    return dict(path=relative(p),absolute_path=str(p.resolve()),sha256=sha(b),bytes=len(b),lines=len(text(p).splitlines()))
def section(t,key):
    m = re.search(r'^'+re.escape(key)+r':([^\n]*)(?:\n|$)',t,re.M)
    if not m: return ''
    n = re.search(r'^[A-Za-z_][\w-]*:',t[m.end():],re.M)
    return t[m.start():m.end()+n.start() if n else len(t)].rstrip()
def ref(p,start=1,end=None):
    return dict(path=relative(p),line_start=start,line_end=end or start)
def line_of(t,needle):
    assert needle in t, needle
    return t[:t.index(needle)].count('\n')+1
def block_ref(p,key):
    t=text(p); s=section(t,key)
    return ref(p,line_of(t,s),line_of(t,s)+len(s.splitlines())-1) if s else None

def tools(t):
    s=section(t,'tools')
    # Covers both flow and block forms in all 40 audited manifests; enabled=true is asserted below.
    names=re.findall(r'(?:\{|^\s*-\s*)\s*name:\s*([a-z_]+)',s,re.M)
    for n in names:
        assert re.search(r'name:\s*'+n+r'\s*,?\s*(?:\n\s*)?enabled:\s*true',s),n
    servers=re.findall(r'mcp_server_name:\s*([\w-]+)',s)
    assert 'enabled: false' in s or 'enabled:\n' in s or re.search(r'default_config:\s*\n\s+enabled: false',s)
    return dict(builtin_default_enabled=False,builtin_allowlist=names,mcp_server_allowlist=servers,mcp_per_tool_allowlist=None,mcp_default_enabled=True if servers else None,mcp_tool_scope_note='Server-wide default_config enabled:true, not an exact read-query tool allowlist; provider tool schemas and side effects are not specified in this source.' if servers else 'No MCP tools or servers configured.')

def workers_prompt(t):
    s=section(t,'system'); m=re.search(r'^  text: \|\s*\n((?:[ \t]+[^\n]*\n?|\n)*)',s,re.M)
    assert m,s
    return textwrap.dedent(m.group(1)).rstrip()+'\n'

def matching_lines(p,rx):
    return [dict(line=i,text=l) for i,l in enumerate(text(p).splitlines(),1) if re.search(rx,l,re.I)]
def header(t):
    if not t.startswith('---'): return {}
    h=t.split('---',2)[1]
    return dict(re.findall(r'^([\w-]+):\s*(.*)$',h,re.M))
def mdlink(p,a=None,b=None,label=None):
    if isinstance(p,dict):
        a=p['line_start']; b=p.get('line_end'); p=SOURCE/p['path']
    elif not isinstance(p,Path): p=SOURCE/p
    suffix=f'#L{a}'+(f'-L{b}' if b and b != a else '') if a else ''
    return '['+(label or p.name)+(f':{a}'+(f'–{b}' if b and b != a else '') if a else '')+'](<'+p.resolve().as_posix()+suffix+'>)'
def compact(v): return json.dumps(v,ensure_ascii=False,separators=(',',':'))
def save(name,content):
    p=OUT/name
    assert p.resolve().parent == OUT
    normalized = '\n'.join(line.rstrip() for line in content.splitlines()).rstrip() + '\n'
    p.write_text(normalized,encoding='utf-8',newline='\n')

# Exact role-specific business scope and source line evidence, not uniform synthetic gates.
BUSINESS = {
'pitch-agent': dict(input='目标公司名称/代码、行业、战略情境；可选收购方/投资论点；银行PPT模板；估值日及来源授权',input_lines=[11,18],output_lines=[13,14],flow='researcher 拉取comps/precedents → modeler 用验证输入计算DCF/LBO JSON → deck-writer 产出model.xlsx及pitch-<target>.pptx；主Agent保留建模/审核/阶段交接责任',worker_inputs=['目标及比较集、授权CapIQ/Daloopa数据','已拉取comps/输入、DCF/LBO假设，隔离scratch计算','验证comps、模型输出、football field、银行模板（非外部原始材料）'],worker_outputs=['结构表；output_schema约束target/comps/precedents','计算结果JSON，不写最终工作簿','./out/model.xlsx；./out/pitch-<target>.pptx'],checks=[('model-built','explicit-intermediate-stop','Banker',32,32,'Excel模型完成后停止，banker批准后进入后续deck阶段'),('deck-generated','explicit-final-stop','Banker',32,32,'Deck完成后再次停止并取得banker批准')],tests=['验证DCF/LBO/comps/precedents football field与当前价格，deck每数值追溯workbook named range','缺失CapIQ/filing来源必须[UNSOURCED]；模型批准前不能进入deck阶段；deck批准不授权发邮件'],notes=['插件frontmatter只列CapIQ，Managed主与researcher/modeler另接Daloopa。','modeler有bash但无write工具；不是文件系统只读。','叶writer仅Write/Edit无Bash，而xlsx-author/pptx-author明确要求运行Python/Bash；不可为跑技能默认加通用Shell。']),
'market-researcher': dict(input='行业/主题、研究角度、研究Universe边界（8–15家公司）、可选slides与公司模板',input_lines=[11,21],output_lines=[13,17],flow='sector-reader 解析不可信研究/issuer材料 → comps-spreader 拉授权multiples并统一口径 → note-writer 接overview/landscape/comps/ideas产出研究稿',worker_inputs=['第三方研究及发行人材料','明确peer set、CapIQ或FactSet授权','overview、landscape、comps spread、ideas shortlist、slides选项'],worker_outputs=['schema约束sector/facts，claim/source有长度限制','定义一致的交易multiples表','./out/primer-<sector>.docx；可选./out/primer-<sector>.pptx'],checks=[('comps-spread','explicit-intermediate-stop','Analyst',32,32,'Comps spread完成后analyst批准才继续'),('note-drafted','explicit-final-stop','Analyst',32,33,'Note草稿完成后再次analyst批准；出版/分发在Agent外')],tests=['8–15 universe边界、peer口径/outlier标注与3–5 ideas核对','原始报告注入不能触及MCP/writer；comps未审不进入note；slides仅按需生成'],notes=['README把comps-spreader与Orchestrator合并列Read/Grep/Glob/Agent，但实际Worker YAML只有Read/Grep，按更精确YAML。','writer有pptx-author但无docx专用技能、无Bash。']),
'earnings-reviewer': dict(input='公司ticker、报告期、完整earnings transcript/10-Q/8-K、已有coverage workbook及模型来源',input_lines=[11,21],output_lines=[13,15],flow='transcript-reader 解析不可信call/press release → model-updater 用FactSet/Daloopa可信actuals/consensus形成variance → note-writer 写model/note草稿',worker_inputs=['完整call transcript和press release','经验证actuals、原coverage模型、可信FactSet/Daloopa consensus','variance table、call read、经验证模型变更'],worker_outputs=['schema约束ticker/period/actuals/guidance_notes','variance table；本Worker不写最终文件','./out/model-<ticker>.xlsx；./out/note-<ticker>.docx'],checks=[('model-note-drafts','final-draft-professional-handoff','Senior analyst',24,30,'模型及note作为草稿提交；外部research distribution必须Agent外senior analyst签字，不是两个强制中途Gate')],tests=['实际/consensus/prior revenue/GM/EBITDA/EPS variance可复算，每个改动cell可追溯','完整transcript非summary；断开FactSet/Daloopa不能用预测冒充consensus；禁止发布'],notes=['model-updater无Write，最终模型由note-writer落盘；不能误授writer数据源。','README合并Orchestrator/worker工具列并非Worker精确权限。']),
'meeting-prep-agent': dict(input='client ID、calendar-event ID；或prospect与会议日期；CRM关系/持仓/open items、近期邮件/新闻',input_lines=[11,20],output_lines=[13,14],flow='profiler 从CRM/CapIQ取可信profile → news-reader 解析不可信邮件/新闻 → pack-writer 按profile和结构摘要生成advisor briefing',worker_inputs=['client ID、CRM/CapIQ可信关系/持仓/open items','不可信client邮件、news articles','结构化profile、news summary、经允许的模板'],worker_outputs=['结构化关系profile，只读','schema约束items/headline/source','./out/briefing-<client>.pptx'],checks=[('advisor-briefing-draft','final-draft-professional-handoff','Advisor',22,27,'Advisor在会议前审核；只给advisor，禁止client-facing send，无显式双中途Gate')],tests=['无CRM prospect不得伪造关系历史；缺calendar ID明确提示来源','邮件中的发送/上传指令不能被执行；pack只读验证摘要，披露PII不得超scope'],notes=['client-report/investment-proposal主角色可发现，但pack-writer只显式绑定client-review与pptx-author；不得按主技能继承。']),
'model-builder': dict(input='ticker、model type（DCF/LBO/3-stmt/comps）、assumption set、授权historicals/consensus/filings',input_lines=[11,21],output_lines=[13,16],flow='data-puller 可信金融数据→builder 唯一writer生成model.xlsx→auditor 只读复核→主Agent承接build与audit两审批，再让builder受控生成sensitivities',worker_inputs=['ticker、CapIQ/Daloopa授权、请求模型类型','data-puller验证输入表+用户假设','./out/model.xlsx（只读成果副本）'],worker_outputs=['schema约束ticker/historicals/consensus','./out/model.xlsx（唯一writer；上游另有Bash）','pass/fail与问题位置；不可自动改表'],checks=[('model-built','explicit-intermediate-stop','User',24,30,'建模完成停审；禁止任何下游使用'),('model-audited','explicit-intermediate-stop','User',30,30,'Audit后再停审；用户批准才进入sensitivities')],tests=['build批准前不开始audit/下游阶段；audit批准前不能sensitize，修改已审artifact须失效','蓝黑绿、formula/live links、BS/CF balance、WACC/terminal/midyear、LBO paydown与IRR/MOIC'],notes=['Workflow第24行在sensitize之后描述stop after built，Guardrail第30行明确build和audit两停审且before sensitivities；保留两节点并披露顺序歧义，不机械只留final Gate。','auditor文字称check-model conventions，实际绑定audit-xls；不是另一个可发现skill。','只有builder配置bash且write；DSH迁移应以窄Office/计算操作替代，不默认开放shell。']),
'gl-reconciler': dict(input='trade date、asset classes、threshold/firm tolerance；GL/subledger可信查询；counterparty/custodian原件只给reader',input_lines=[11,21],output_lines=[13,15],flow='reader 按asset class提取不可信候选break → critic 从可信GL/subledger独立复核 → resolver 仅接critic-checked且schema-validated break集写例外报告',worker_inputs=['单asset class不可信counterparty/custodian statement','候选break与可信internal-gl/subledger；不开放counterparty文件','经过critic复核+schema验证的break集合，不得看原始outsider文件'],worker_outputs=['受限schema JSON：asset_class/status/breaks','逐break confirmed/rejected，只读','./out/下controller sign-off exception report；文件名未由源指定'],checks=[('controller-exception-report','final-draft-professional-handoff','Controller',15,29,'验证后例外报告路由controller签字；ledger adjustments仅Agent外人工授权，非自动posting')],tests=['reader Read/Grep、无MCP/写/shell，critic禁止原始counterparty，resolver禁止原始文件与bash','0.01金额/0数量默认tolerance与firm override；critic必须能拒绝伪造break；主Agent禁止Write'],notes=['主Prompt与YAML均never writes；不得给GL主Agent通用Shell/Office写入。','YAML给internal-gl/subledger整server工具默认启用，注释read-only不是服务器实际工具schema验证。','reader schema cause枚举temporal_cutoff/system_drift/reclass/unknown，gl-recon skill更丰富FX/mapping/duplicates/fees/data-quality分类；不能静默丢字段。','gl-recon skill称subledger/custodian extracts不可信，而主Prompt将MCP作为可信源；须区分可信传输/授权与数据内容仍不可信。']),
'kyc-screener': dict(input='onboarding packet ID（或client periodic refresh/as-of/UBO-only follow-up）、原件PDF、firm规则grid与授权screening',input_lines=[11,23],output_lines=[13,16],flow='doc-reader 解析不可信PDF→rules-engine 用验证entity按firm rules+screening评估→escalator 仅接rules结果/hits写compliance packet',worker_inputs=['不可信onboarding docs（passport/formation/UBO）','验证entity file、可信firm规则、授权sanctions/PEP screening','rules result、screening hits/置信度；不得直接开onboarding原件'],worker_outputs=['schema约束packet_id/entity/ubos JSON；无自由文本','每规则pass/fail、命中及置信度（只读）','./out/escalation-<packet>.xlsx；仅建议风险评级'],checks=[('compliance-escalation','final-draft-professional-handoff','Compliance officer',16,29,'形成compliance sign-off包；Agent只建议，compliance officer最终决定；不得自动最终评级/签字')],tests=['doc-reader不可访问screening/MCP/写入，拒超长/额外键及注入；escalator不得看原件','正式sanctions/PEP源缺失必须UNAVAILABLE/NOT_CONFIGURED，普通新闻不能冒充screening','KYC skill评分clear只能recommendation，绝不可转成最终批准；主Agent禁止Write'],notes=['rules-engine实际skills: []，虽然主Agent有kyc-rules；doc-reader也skills: []，不能擅自继承kyc-doc-parse。','kyc-rules涉及source_of_funds/documents等字段，但doc-reader schema只entity legal_name/country和UBO name/pct，未覆盖完整技能需求；扩充须审schema版本。']),
'valuation-reviewer': dict(input='fund、as-of日期、GP valuation packages、firm估值政策/可信portfolio MCP、已授权NAV/LP分配口径',input_lines=[11,21],output_lines=[13,15],flow='package-reader 从不可信GP包抽取marks→valuation-runner 按portfolio政策运行估值/waterfall→publisher 用审核summary/waterfall写LP pack，绝不分发',worker_inputs=['不可信GP估值packages','验证reported marks、可信portfolio policy','reviewed valuation summary、waterfall；不看GP原件'],worker_outputs=['schema约束fund/as_of/portcos','policy比较、waterfall、reviewer flags，只读','./out/lp-pack-<fund>.xlsx'],checks=[('ir-cco-lp-pack','final-draft-professional-handoff','IR and CCO',15,27,'LP pack只staged，外部分发须Agent外IR及CCO sign-off')],tests=['GP input注入不能到portfolio/writer；as-of、mark口径/单位一致、waterfall/NAV/LP allocations复算','IR/CCO业务审核不能授权Agent分发；publisher名称不代表publish权限'],notes=['package-reader Prompt称key inputs，但schema仅portco_id/reported_fv/method，没有key inputs字段；存在信息损失。','publisher只是leaf文件writer，不能按名字授予网络发布。']),
'month-end-closer': dict(input='entity、period YYYY-MM、GL trial balance、prior/budget、firm thresholds；vendor invoices/statements只给ledger-reader',input_lines=[11,23],output_lines=[13,16],flow='ledger-reader 抽取不可信support→rollforward 用可信GL+验证support构建accruals/roll-forwards/commentary→poster 仅写close package与JE草稿，禁止GL posting',worker_inputs=['不可信vendor invoices/statement、entity/period','GL trial balance、schema验证support、prior/budget','验证accruals、JE草稿、roll-forward、variance commentary，不看vendor原件'],worker_outputs=['schema约束entity/period/support JSON','只读schedule数据和commentary','./out/close-package-<entity>-<period>.xlsx；JE drafts非正式记账'],checks=[('controller-close-package','final-draft-professional-handoff','Controller',16,28,'Close package留controller review/sign-off；正式posting需Agent外controller授权')],tests=['beginning+activity−reversals=ending、tie GL，material flux有支持；entity/period隔离','poster即使名字像posting也无MCP/shell，拒GL记账；vendor注入只读解析隔离'],notes=['poster非系统记账角色；所有write仅最终文件。','rollforward skills: []，accrual/roll-forward/variance技能仅主Agent绑定，不能自动继承。']),
'statement-auditor': dict(input='statement batch ID、fund NAV pack；可单LP correction re-check；声明报表均按不可信处理',input_lines=[11,20],output_lines=[13,15],flow='statement-reader 提取不可信LP余额→reconciler 仅可信NAV MCP逐字段tie-out→flagger 写exception/sign-off建议表，IR在外部决定分发',worker_inputs=['不可信预生成LP statements','验证LP extracted balances、可信NAV pack（NAV MCP）','tie-out table和discrepancies，不看原始statement'],worker_outputs=['schema约束batch_id/lps JSON','field vs NAV source tie-out/discrepancy表，只读','./out/signoff-<batch>.xlsx；pass/hold recommendation'],checks=[('ir-statement-signoff','final-draft-professional-handoff','Human reviewer / IR',15,26,'只推荐pass/hold；human sign-off后由IR在Agent外分发')],tests=['statement金额/allocations/fees vs NAV逐字段核对，hold不得被忽略','原statement注入不触及NAV或writer；flagger不得打开原件；NAV不是模拟或未审核Excel'],notes=['statement-reader schema只有nav/contrib/distrib，不含fees/allocations等完整主任务字段，需显式schema扩展，不伪称已完整tie-out。'])}

all_skill_paths=sorted((SOURCE/'plugins/agent-plugins').glob('*/skills/*/SKILL.md'))
vertical_paths=sorted((SOURCE/'plugins/vertical-plugins').glob('*/skills/*/SKILL.md'))
asset_records={}
skill_records={}
for p in all_skill_paths:
    s=text(p); h=header(s); name=p.parent.name
    files=sorted(x for x in p.parent.rglob('*') if x.is_file())
    tree={x.relative_to(p.parent).as_posix():sha(x.read_bytes()) for x in files}
    vertical=[]
    for v in vertical_paths:
        if v.parent.name != name: continue
        vt={x.relative_to(v.parent).as_posix():sha(x.read_bytes()) for x in v.parent.rglob('*') if x.is_file()}
        vertical.append(dict(source=file_record(v),skill_md_equal=sha(v.read_bytes())==sha(p.read_bytes()),full_tree_equal=vt==tree,changed_or_missing_files=sorted(k for k in set(tree)|set(vt) if tree.get(k)!=vt.get(k))))
    tokens=sorted(set(re.findall(r'mcp__[A-Za-z0-9_-]+__[A-Za-z0-9_.*-]+',s)))
    coupling=matching_lines(p,r'mcp__|Bash|Python|openpyxl|python-pptx|Office|Claude|PowerPoint|Excel|sandbox|scratch')
    reviews=matching_lines(p,r'ask|approv|sign.off|review|stop|confirm|never|do not|don.t|untrusted')
    links=[]
    for match in re.finditer(r'\[[^\]]*\]\(([^)]+)\)',s):
        target=match.group(1).strip('<>')
        if re.match(r'(?:https?:|mailto:|#)',target): continue
        path_target=target.split('#')[0]
        resolved=(p.parent/path_target).resolve()
        links.append(dict(target=target,line=s[:match.start()].count('\n')+1,resolves=resolved.exists(),resolved_path=str(resolved),within_source=resolved.is_relative_to(SOURCE)))
    rec=dict(source=file_record(p),name=name,frontmatter=h,whole_skill_tree_sha256=sha(compact(tree).encode()),files=[file_record(x) for x in files],vertical_sources=vertical,nonvertical_origin=(not vertical),mcp_tokens=tokens,platform_coupling_lines=coupling,review_and_guardrail_lines=reviews,local_markdown_links=links)
    skill_records[relative(p)]=rec
    for f in files: asset_records[relative(f)]=file_record(f)

agents=[]; worker_all=[]; source_inventory={}
for slug in ORDER:
    d=SOURCE/'managed-agent-cookbooks'/slug; ap=d/'agent.yaml'; at=text(ap)
    pp=(d/re.search(r'^\s+file:\s*(.+)$',section(at,'system'),re.M).group(1)).resolve(); pt=text(pp)
    append=json.loads(re.search(r'^\s+append:\s*(.+)$',at,re.M).group(1))
    effective=pt.rstrip('\n')+'\n\n'+append # Bash command substitution strips trailing LF; no Markdown frontmatter stripping.
    ht=header(pt); native=tools(at)
    configured_main_skills=[rec for path,rec in skill_records.items() if path.startswith(f'plugins/agent-plugins/{slug}/skills/')]
    used_names=re.findall(r'`([^`]+)`',pt.split('## Skills this agent uses',1)[1])
    declared_workers=re.findall(r'manifest:\s*([^\s}]+)',section(at,'callable_agents'))
    workers=[]
    for idx,wrel in enumerate(declared_workers):
        wp=(d/wrel).resolve(); wt=text(wp); pr=workers_prompt(wt); native_w=tools(wt)
        sk=[]
        for skrel in re.findall(r'\{\s*path:\s*([^ }]+)',section(wt,'skills')):
            skp=(wp.parent/skrel/'SKILL.md').resolve(); assert skp.exists()
            sk.append(dict(config_reference=skrel,config_line=line_of(wt,skrel),source=skill_records[relative(skp)]['source'],name=skp.parent.name))
        sm=re.search(r'^name:\s*(.*)$',wt,re.M); assert sm
        schema=section(wt,'output_schema')
        w=dict(name=sm.group(1),file_slug=wp.stem,source=file_record(wp),model=re.search(r'^model:\s*(.*)$',wt,re.M).group(1),system_prompt=dict(text=pr,utf8_sha256=sha(pr.encode()),source=block_ref(wp,'system')),tools=native_w,tools_source=block_ref(wp,'tools'),mcp_servers_source=block_ref(wp,'mcp_servers'),mcp_servers_raw=section(wt,'mcp_servers'),skills=sk,skills_source=block_ref(wp,'skills'),callable_agents=[],callable_agents_source=block_ref(wp,'callable_agents'),input=BUSINESS[slug]['worker_inputs'][idx],output=BUSINESS[slug]['worker_outputs'][idx],io_evidence=block_ref(wp,'system'),output_schema_raw=schema or None,output_schema_source=block_ref(wp,'output_schema'),writes_final_artifacts='write' in native_w['builtin_allowlist'],shell_enabled='bash' in native_w['builtin_allowlist'],trust_boundary_lines=matching_lines(wp,r'untrusted|trusted|Never|do not|schema|ONLY worker|scratch'),test_status='SUGGESTED_NOT_EXECUTED')
        if schema: w['output_schema_utf8_sha256']=sha(schema.encode())
        workers.append(w); worker_all.append(w); source_inventory[relative(wp)]=file_record(wp)
    assert len(workers)==3
    checkpoints=[]
    for cid,kind,owner,start,end,desc in BUSINESS[slug]['checks']:
        checkpoints.append(dict(id=slug+'.'+cid,kind=kind,owner=owner,description=desc,source=ref(pp,start,end),source_quote='\n'.join(pt.splitlines()[start-1:end]),upstream_enforcement='Prompt/business handoff only; no deterministic runtime gate implemented in YAML or the inspected deploy script.',review_policy_note='Financial internal review; cannot expand tool/MCP permissions or authorize external side effects.',recommended_runtime_test='Reject downstream stage or final-release interpretation until a valid versioned decision when this checkpoint is enabled; preserve external prohibition even after approval.'))
    steer=d/'steering-examples.json'; st=text(steer); events=json.loads(st)
    for ev in events: ev['source']=ref(steer,line_of(st,json.dumps(ev['event'],ensure_ascii=False)))
    yamltools=native['builtin_allowlist']+[f'mcp__{s}__*' for s in native['mcp_server_allowlist']]
    plugtools=[t.strip() for t in ht.get('tools','').split(',')]
    differences=[dict(type='authorization-surface',plugin_frontmatter=plugtools,managed_manifest=yamltools,source_plugin=ref(pp,4),source_yaml=block_ref(ap,'tools'),decision='Managed YAML is the executable narrower baseline. Prompt frontmatter is NOT permission; preserve exact worker toolset; server-wide MCP default still requires deterministic query-only filtering.'),dict(type='headless-append',append=append,source=block_ref(ap,'system'),decision='Managed system includes canonical Markdown verbatim (including frontmatter) plus headless append; platform-specific Office behavior needs adapter, not permission widening.'),dict(type='main-skill-discovery-vs-prose-list',prompt_named_skills=used_names,from_plugin_expands_to=[r['name'] for r in configured_main_skills],source=block_ref(ap,'skills'),decision='Manifest from_plugin grants discovery to all bundled skill directories, not just prose-listed skills; workers do not inherit.')]
    a=dict(slug=slug,proposed_main_id='finance-'+slug,status='READ_ONLY_SOURCE_AUDIT_NOT_RUNTIME_IMPLEMENTED',manifest=file_record(ap),plugin_prompt=dict(source=file_record(pp),frontmatter=ht,text=pt,raw_bytes_sha256=sha(pp.read_bytes()),managed_effective_utf8_sha256=sha(effective.encode()),managed_effective_text=effective,hash_method='UTF-8 decoded source; bash inline_system strips trailing LF then appends two LF and system.append; Markdown frontmatter is retained.'),model=re.search(r'^model:\s*(.*)$',at,re.M).group(1),tools=native,tools_source=block_ref(ap,'tools'),mcp_servers_raw=section(at,'mcp_servers'),mcp_servers_source=block_ref(ap,'mcp_servers'),main_skills=[dict(name=r['name'],source=r['source'],vertical_sources=r['vertical_sources']) for r in configured_main_skills],skills_source=block_ref(ap,'skills'),prompt_named_skills=used_names,inputs=dict(description=BUSINESS[slug]['input'],source=ref(pp,*BUSINESS[slug]['input_lines'])),outputs=dict(description='\n'.join(pt.splitlines()[BUSINESS[slug]['output_lines'][0]-1:BUSINESS[slug]['output_lines'][1]]),source=ref(pp,*BUSINESS[slug]['output_lines'])),worker_flow=BUSINESS[slug]['flow'],workers=workers,review_checkpoints=checkpoints,guardrails=dict(text=pt.split('## Guardrails',1)[1].split('## Skills',1)[0].strip(),source=ref(pp,line_of(pt,'## Guardrails'),line_of(pt,'## Skills this agent uses')-1)),steering=dict(source=file_record(steer),events=events,execution_note='Examples only; business inputs/dates are samples, not real user records or executed runs.'),readme=file_record(d/'README.md'),handoff_source_lines=matching_lines(d/'README.md',r'handoff|sign.off|outside|Not guaranteed|routes'),differences=differences,source_gaps_and_migration_notes=BUSINESS[slug]['notes'],suggested_tests=BUSINESS[slug]['tests'],test_status='SUGGESTED_NOT_EXECUTED')
    agents.append(a)
    for p in [ap,pp,steer,d/'README.md']: source_inventory[relative(p)]=file_record(p)

support=[SOURCE/'managed-agent-cookbooks/README.md',SOURCE/'CLAUDE.md',SOURCE/'scripts/deploy-managed-agent.sh',SOURCE/'scripts/validate.py',SOURCE/'scripts/orchestrate.py']
for p in support: source_inventory[relative(p)]=file_record(p)
for r in asset_records.values(): source_inventory[r['path']]=r
for r in skill_records.values():
    for v in r['vertical_sources']:
        p=SOURCE/v['source']['path']
        for f in p.parent.rglob('*'):
            if f.is_file(): source_inventory[relative(f)]=file_record(f)

# Skill gates are conditional on invoking that method, not a synthetic uniform main-Agent gate.
SKILL_REVIEW = {
 '3-statement-model': (25,31,'conditional-stepwise-user-confirmation',[26,27,28,29,30]),
 'dcf-model': (50,56,'conditional-stepwise-user-confirmation',[51,52,53,54,55]),
 'lbo-model': (258,270,'conditional-stepwise-user-confirmation',[263,264,265,266,267]),
 'comps-analysis': (99,104,'conditional-stepwise-user-confirmation',[100,101,102,103]),
 'competitive-analysis': (32,36,'conditional-outline-approval',[34]),
 'deck-refresh': (54,75,'conditional-destructive-edit-plan-approval',[75]),
 'audit-xls': (147,147,'no-edit-without-user-request',[]),
 'client-report': (99,99,'external-compliance-template-review-not-distribution-permission',[]),
 'accrual-schedule': (37,37,'controller-signoff-draft-not-posting',[]),
 'kyc-rules': (47,47,'human-final-decision-not-agent-approval',[]),
}
conditional_reviews=[]
for a in agents:
    a['conditional_skill_reviews']=[]
    for sk in a['main_skills']:
        if sk['name'] not in SKILL_REVIEW: continue
        start,end,kind,step_lines=SKILL_REVIEW[sk['name']]
        sp=SOURCE/sk['source']['path']; lines=text(sp).splitlines()
        c=dict(skill=sk['name'],agent=a['slug'],kind=kind,condition='Only when this Skill/method is invoked. Do not blindly add every method gate to every task. Worker questions/approval requests must return to the main/Host, not direct worker ask_user_question.',source=ref(sp,start,end),source_quote='\n'.join(lines[start-1:end]),steps=[dict(source=ref(sp,i),source_quote=lines[i-1]) for i in step_lines],worker_bindings=[w['name'] for w in a['workers'] if any(s['name']==sk['name'] for s in w['skills'])],authority_note='Internal user verification is not tool permission or formal external sign-off. audit-xls remains readonly even after a fix request unless the designated writer executes the change.')
        a['conditional_skill_reviews'].append(c); conditional_reviews.append(c)

counts=dict(main_manifests=len(agents),plugin_prompts=len(agents),worker_manifests=len(worker_all),steering_files=len(agents),steering_examples=sum(len(a['steering']['events']) for a in agents),agent_skill_instances=len(skill_records),agent_skill_unique_names=len(set(r['name'] for r in skill_records.values())),agent_skill_asset_files=len(asset_records),main_readonly_toolsets=sum(a['tools']['builtin_allowlist']==['read','grep','glob'] for a in agents),leaf_writers=sum(w['writes_final_artifacts'] for w in worker_all),workers_without_write_tool=sum(not w['writes_final_artifacts'] for w in worker_all),shell_workers=sum(w['shell_enabled'] for w in worker_all),worker_output_schemas=sum(bool(w['output_schema_raw']) for w in worker_all),mcp_server_names=len(set(s for a in agents for s in a['tools']['mcp_server_allowlist'])),review_checkpoints=sum(len(a['review_checkpoints']) for a in agents),explicit_stop_checkpoints=sum(c['kind'].startswith('explicit') for a in agents for c in a['review_checkpoints']),final_professional_handoffs=sum(c['kind']=='final-draft-professional-handoff' for a in agents for c in a['review_checkpoints']),skill_instances_with_vertical_source=sum(bool(r['vertical_sources']) for r in skill_records.values()),skill_instances_without_vertical_source=sum(not r['vertical_sources'] for r in skill_records.values()),vertical_full_tree_drift_instances=sum(any(not v['full_tree_equal'] for v in r['vertical_sources']) for r in skill_records.values()))
counts['conditional_skill_review_groups']=len(conditional_reviews)
counts['conditional_skill_stage_checkpoint_instances']=sum(len(c['steps']) for c in conditional_reviews)
assert counts['main_manifests']==10 and counts['worker_manifests']==30
assert counts['leaf_writers']==10 and counts['main_readonly_toolsets']==10
assert all(not w['callable_agents'] for w in worker_all)
assert all(not w['tools']['mcp_server_allowlist'] for w in worker_all if w['writes_final_artifacts'])
assert all(sum(w['writes_final_artifacts'] for w in a['workers'])==1 for a in agents)
assert all(not set(a['tools']['builtin_allowlist']) & {'write','edit','bash'} for a in agents)

findings=[
 dict(id='F01',severity='CRITICAL',title='主Agent授权不可取插件frontmatter的Write/Edit',sources=[ref(SOURCE/'plugins/agent-plugins/pitch-agent/agents/pitch-agent.md',4),ref(SOURCE/'managed-agent-cookbooks/pitch-agent/agent.yaml',10,18)],detail='10个Managed主Agent仅Read/Grep/Glob+本身数据源，所有Write/Edit仅指定leaf。5个插件frontmatter含Write，Managed均无Write。GL/KYC两种源都明确主只读。'),
 dict(id='F02',severity='HIGH',title='MCP整server enabled不等于精确只读工具allowlist',sources=[ref(SOURCE/'managed-agent-cookbooks/gl-reconciler/agent.yaml',27,34)],detail='9个server名均缺per-tool schema/allowlist；readonly注释无法证明实际只读。必须在授权Adapter/工具层明确允许query并拒副作用，未配置/未授权不可伪称成功。'),
 dict(id='F03',severity='HIGH',title='output_schema未接入上游部署执行链',sources=[ref(SOURCE/'scripts/deploy-managed-agent.sh',9,10),ref(SOURCE/'scripts/deploy-managed-agent.sh',152,160),ref(SOURCE/'scripts/validate.py',7,9)],detail='部署注释称有wrapper，但实际删除output_schema且没有调用validate.py；validate.py只是独立CLI。10个schema须在宿主Worker→main交接处确定性验证，不能依赖Prompt/schema字符白名单抵御全部注入。'),
 dict(id='F04',severity='HIGH',title='无Write工具不等于文件系统只读：两个Bash Worker',sources=[ref(SOURCE/'managed-agent-cookbooks/pitch-agent/subagents/modeler.yaml',5,19),ref(SOURCE/'managed-agent-cookbooks/model-builder/subagents/builder.yaml',5,16)],detail='pitch-modeler Read+Bash+MCP可脚本写scratch；model-builder-builder有Write/Edit/Bash。YAML没有实际路径sandbox策略；不能直授通用Shell，迁移建议受控计算/Office仅任务scratch和成果路径。'),
 dict(id='F05',severity='HIGH',title='九个leaf writer无Bash，headless author skill却要求执行Python',sources=[ref(SOURCE/'plugins/agent-plugins/gl-reconciler/skills/xlsx-author/SKILL.md',15,17),ref(SOURCE/'plugins/agent-plugins/pitch-agent/skills/pptx-author/SKILL.md',15,17),ref(SOURCE/'managed-agent-cookbooks/gl-reconciler/subagents/resolver.yaml',8,18)],detail='仅model-builder-builder有bash；其它9个writer有Write/Edit但无运行Python能力，且Office MCP并未配置。不能从技能文字自动提权；需窄文件/Office写入实现并验证真正xlsx/pptx/docx产物。'),
 dict(id='F06',severity='HIGH',title='原始人工审核差异化且仅为Prompt，不是强制执行器',sources=[ref(SOURCE/'plugins/agent-plugins/pitch-agent/agents/pitch-agent.md',32),ref(SOURCE/'plugins/agent-plugins/market-researcher/agents/market-researcher.md',32),ref(SOURCE/'plugins/agent-plugins/model-builder/agents/model-builder.md',24,30)],detail='pitch/market/model各2明确停审（6）；其余7是各自专业角色最终draft/handoff，不机械加双Gate。model第24与30行顺序歧义需披露，采用build+audit批准后才sensitize。所有checkpoint都需独立业务Host gate，非工具审批。'),
 dict(id='F07',severity='HIGH',title='跨Agent脚本是原厂托管参考且从文本解析handoff',sources=[ref(SOURCE/'scripts/orchestrate.py',4,14),ref(SOURCE/'scripts/orchestrate.py',40,42),ref(SOURCE/'scripts/orchestrate.py',64,82),ref(SOURCE/'managed-agent-cookbooks/README.md',34,38)],detail='原厂preview sessions.stream/steer不是DSH API。10 main从不直接call彼此；typed授权新Session/新任务交接替代文本regex，禁止引用不可信文档自动启动其它Agent。'),
 dict(id='F08',severity='MEDIUM',title='Schema不等价于完整业务数据；ASCII/限长有局限',sources=[ref(SOURCE/'managed-agent-cookbooks/kyc-screener/subagents/doc-reader.yaml',17,37),ref(SOURCE/'managed-agent-cookbooks/valuation-reviewer/subagents/package-reader.yaml',17,33),ref(SOURCE/'managed-agent-cookbooks/statement-auditor/subagents/statement-reader.yaml',17,33)],detail='KYC缺documents/source-of-funds等，valuation缺key inputs，statements缺fees/allocations；英文字符pattern会拒中文等合法名字；部分nested字段不required、动态numeric maps无maxProperties、number无finite/业务边界。不可把schema验证等同数据完整性或无注入；需版本化修订与负测试。'),
 dict(id='F09',severity='MEDIUM',title='技能内容可含Office/广泛数据源要求，但不能扩大角色权限',sources=[ref(SOURCE/'plugins/agent-plugins/gl-reconciler/skills/xlsx-author/SKILL.md',8,17),ref(SOURCE/'plugins/agent-plugins/gl-reconciler/skills/xlsx-author/SKILL.md',40,42),ref(SOURCE/'managed-agent-cookbooks/kyc-screener/subagents/rules-engine.yaml',17)],detail='from_plugin仅决定主Agent发现所有bundled skill；Worker仅绑定path技能或[]。skills中的mcp__office__/供应商token是需求/耦合，不是YAML已授权工具。运行权限取精确manifest。'),
 dict(id='F10',severity='HIGH',title='文件路径与raw-document隔离仅Prompt约束，YAML未硬编码路径ACL',sources=[ref(SOURCE/'managed-agent-cookbooks/gl-reconciler/subagents/resolver.yaml',5,14),ref(SOURCE/'managed-agent-cookbooks/kyc-screener/subagents/escalator.yaml',5,14)],detail='writer仍有Read，never open原件为Prompt要求；必须执行层只挂载verified inputs与任务成果root，拒绝绝对路径/../、symlink escape、原件覆盖、跨Session读写与并发覆盖。不宣称上游已实施。')]

result=dict(schema_version='1.0.0',scope='Read-only upstream Agent/Worker/steering/associated-skills audit. No implementation, installation, API verification, commercial data calls, business E2E, or upstream/DSH modifications.',source_root=str(SOURCE),output_root=str(OUT),task_document=dict(path=str(TASK),sha256=sha(TASK.read_bytes())),counts=counts,hash_policy='Raw-file SHA-256 on exact bytes. Worker system text: YAML literal content dedented, one terminal LF. Managed main effective text reproduces inline_system Bash trailing-LF removal, two LF, append; full text and hashes saved. Skill whole-tree SHA hashes sorted compact JSON of relative-path→raw SHA map.',agents=agents,skills=list(skill_records.values()),findings=findings,source_files=sorted(source_inventory.values(),key=lambda x:x['path']),validation=dict(status='STATIC_ASSERTIONS_PASSED',assertions=['10 main, 30 workers, 3 per main','10 exact read/grep/glob main toolsets, no main write/edit/bash','10 leaf writers, exactly one per main, all without MCP','All 30 worker callable_agents empty','All referenced system and skill paths exist','All steering JSON parse','All source line ranges and hashes verified on current disk'],runtime_tests_executed=0,commercial_e2e_executed=0))
save('agent-mapping.json',json.dumps(result,ensure_ascii=False,indent=2)+'\n')

# Human readable principal mapping: every main, all 30 workers, every exact skill binding and checkpoint.
m=['# Agent → Worker → Skills → 数据与审核映射（只读源码审计）','',
'状态：**AUDITED / 未实施运行时迁移**。只读Anthropic上游；未调用DSH API、未运行上游部署脚本、未请求商业数据。建议测试均**未执行**，本审计静态断言另列。',
'',f'来源：`{SOURCE}`；仅写入本审计目录。结构化全量信息、完整40个系统Prompt、SHA及技能/引用行见 '+mdlink(OUT/'agent-mapping.json')+'；生成器 '+mdlink(OUT/'generate_agent_audit.py')+'。','',
'## 1. 准确计数','', '| 项 | 数量 |','|---|---:|']
for k,v in counts.items(): m.append(f'| {k} | {v} |')
m += ['', '计数口径：skill instances是Agent包中的实际副本，unique names不是任务书全仓63名称总数。本子任务覆盖所有Agent对应技能；全仓63名称审计由父任务合并。review checkpoints中6个是明确stop，其余7个是差异化final专业人员交接，不声称都有上游强制运行时Gate。','',
'## 2. 全局执行基线与不兼容项','',
'- 10个主Agent全部仅Read/Grep/Glob；所有主Agent无Write/Edit/Bash。30个Worker均为depth-1 leaf且callable_agents=[]。每组仅一leaf持Write/Edit，10名writer均无MCP。',
'- MCP配置为server-wide enabled:true，不存在精确MCP per-tool清单或远端tool schema。只读语义必须额外验证/强制；不猜具体工具名、不把通配符解释为可用写入。',
'- 只允许writer产任务成果；pitch-modeler虽无Write却有Bash，不能称为真实文件系统只读；model-builder-builder也有Bash。上游YAML未定义路径沙箱。',
'- Canonical插件Markdown前言不是工具授权。Managed deploy原样内联全文（包含frontmatter）再加headless append；执行基线必须按YAML而非Prompt扩大。',
'- 原厂托管`POST /v1/agents`、技能上传、session steering不等于DSH接口。部署/编排脚本只能参考，不可直接安装到DSH。',
'- 永久禁止自动分发、客户发送、正式记账、交易/资金动作、最终KYC评级和专业签字；内部review fast/strict不能授权副作用。','',
'### 审计发现','']
for f in findings:
    m += [f"#### {f['id']} [{f['severity']}] {f['title']}",f['detail'],'证据：'+'；'.join(mdlink(s) for s in f['sources'])+'。','']
m += ['## 3. 逐主Agent完整映射','']
for a in agents:
    p=SOURCE/a['plugin_prompt']['source']['path']; ap=SOURCE/a['manifest']['path']; slug=a['slug']
    m += [f"### {slug}",'',
      f"主Prompt：{mdlink(p)}；Managed manifest：{mdlink(ap)}；模型原值 `{a['model']}`（原厂配置，不推定DSH模型可用）。",
      f"- Prompt原文件SHA：`{a['plugin_prompt']['raw_bytes_sha256']}`；headless有效系统串SHA：`{a['plugin_prompt']['managed_effective_utf8_sha256']}`。",
      f"- 输入：{a['inputs']['description']}。证据 {mdlink(a['inputs']['source'])}。",
      '- 输出：'+a['outputs']['description'].replace('\n','；')+'。证据 '+mdlink(a['outputs']['source'])+'。',
      '- 顺序：'+a['worker_flow']+'。',
      '- 主工具：`'+', '.join(a['tools']['builtin_allowlist'])+'`；MCP server allowlist：`'+', '.join(a['tools']['mcp_server_allowlist'])+'`。'+mdlink(a['tools_source'])+'。',
      '- URL环境引用（非凭据）：`'+', '.join(sorted(set(re.findall(r'\$\{[A-Z0-9_]+\}',a['mcp_servers_raw']))))+'`；真实授权/连接未测试。',
      '', '**实际主技能来源**（from_plugin扫描全部，非只取Prompt文字列表）','']
    for sk in a['main_skills']:
        vs=sk['vertical_sources']; origins='；'.join(mdlink(v['source']['path'])+(' [全文及资源树一致]' if v['full_tree_equal'] else ' [内容/资源树有差异，见JSON]') for v in vs) if vs else '本Agent技能来源；无同名vertical源'
        m.append(f"- `{sk['name']}` → {mdlink(sk['source']['path'])}；上游来源：{origins}。")
    m += ['', '**三个Worker（按callable_agents配置顺序）**','', '| Worker / Prompt | 精确built-in工具 | MCP server allowlist | 显式skills | 输入 → 输出 |','|---|---|---|---|---|']
    for w in a['workers']:
        sktxt='；'.join('`'+s['name']+'` '+mdlink(s['source']['path']) for s in w['skills']) or '`[]`（不继承主技能）'
        m.append('| '+w['name']+' '+mdlink(w['system_prompt']['source'])+' | `'+', '.join(w['tools']['builtin_allowlist'])+'` | '+(', '.join('`'+s+'`' for s in w['tools']['mcp_server_allowlist']) or '无')+' | '+sktxt+' | '+w['input'].replace('|','/')+' → '+w['output'].replace('|','/')+' |')
    for w in a['workers']:
        m += [f"- `{w['name']}`：system SHA `{w['system_prompt']['utf8_sha256']}`；YAML SHA `{w['source']['sha256']}`；工具 {mdlink(w['tools_source'])}；schema "+(mdlink(w['output_schema_source']) if w['output_schema_source'] else '未声明（不可声称已结构验证）')+'。']
    m += ['', '**原始审核节点（保留性质与责任人）**','']
    for c in a['review_checkpoints']:
        m += [f"- `{c['id']}` / `{c['kind']}` / {c['owner']}：{c['description']}。原始证据 {mdlink(c['source'])}。",'> '+c['source_quote'].replace('\n','\n> ')]
    m += ['', '**条件式Skill原始审核（仅触发该方法时适用，不能被主Prompt汇总审核吞掉）**','']
    for c in a['conditional_skill_reviews']:
        m += ['- `'+c['skill']+'` / `'+c['kind']+'`：'+mdlink(c['source'])+'；绑定Worker：'+(', '.join(c['worker_bindings']) or '无（仅主Agent显式发现）')+'。', '> '+c['source_quote'].replace('\n','\n> ')]
    if not a['conditional_skill_reviews']: m.append('- 无额外已识别的显式Skill审核组；不得机械加Gate。')
    m += ['- 子Worker不得直接调用用户问答；需把真实待确认项交给主Agent/Host。每次任务仅实例化实际所用方法的checkpoint，保留source与版本。']
    m += ['', '**YAML / Plugin / 技能差异及紧耦合**','',
       '- 插件frontmatter：`'+', '.join(a['differences'][0]['plugin_frontmatter'])+'` vs Managed：`'+', '.join(a['differences'][0]['managed_manifest'])+'`。证据 '+mdlink(p,4)+' / '+mdlink(a['tools_source'])+'。',
       '- headless追加：`'+a['differences'][1]['append']+'`。'+mdlink(a['differences'][1]['source'])+'。',
       '- Prompt技能列表：`'+'`, `'.join(a['prompt_named_skills'])+'`。显式Worker技能如上，不从主角色继承。']
    m += ['- '+n for n in a['source_gaps_and_migration_notes']]
    m += ['', '**Steering examples（仅样例，非执行记录）**','']
    for ev in a['steering']['events']: m.append('- `'+ev['event']+'` — '+ev['description']+'；'+mdlink(ev['source'])+'。')
    m += ['', '**跨Agent / 专业签字README原文**','']
    for l in a['handoff_source_lines']: m.append('- '+l['text']+'；'+mdlink(a['readme']['path'],l['line'])+'。')
    m += ['', '**建议测试（未执行）**','']+['- '+t for t in a['suggested_tests']]+['']

m += ['## 4. 对应技能内容与平台耦合审计','',
'所有Agent技能全文及资源树已由生成器读取并逐文件SHA；JSON保存每个SKILL.md原路径、树文件、vertical对照、MCP token、平台紧耦合行、审核/guardrail行及本地Markdown链接解析结果。下表是不同名称的一份入口；角色副本见上文及JSON，不能按名称覆盖。','',
'| Skill名称 | Agent包实例数 | 平台/数据工具tokens（原文引用，不代表已授权） | 代表性源与耦合行 |','|---|---:|---|---|']
for name in sorted(set(r['name'] for r in skill_records.values())):
    rr=[r for r in skill_records.values() if r['name']==name]; r=rr[0]
    toks=sorted(set(x for r0 in rr for x in r0['mcp_tokens']))
    cs=r['platform_coupling_lines']; evidence='；'.join(mdlink(r['source']['path'],x['line']) for x in cs[:3]) or mdlink(r['source']['path'])
    m.append('| `'+name+'` | '+str(len(rr))+' | '+(', '.join('`'+t+'`' for t in toks) or '无显式mcp token')+' | '+evidence+' |')
m += ['', '## 5. 建议验收与本次实际验证','',
'本次实际执行：Python标准库生成器；JSON读取/源路径存在性/数量/leaf权限/所有SHA和源行号静态验证。未执行模型、商业源查询、Office业务E2E或DSH安装。','',
'建议全局负测试：未知Worker拒委派；Worker不可再委派；Reader/Checker写入及Shell一律拒绝；writer无MCP/原始文件；路径穿越/绝对路径/符号链接/跨Session拒绝；原附件只读；schema超长/额外键/非法数值/合法中文姓名；输入注入不得升权；无正式screening或NAV不得伪造；重复/过期/并发审批拒绝；审核后修改hash使审批失效；重启/重连保留待审事实；不同Session不覆盖同名model.xlsx；凭据不入Prompt/成果/日志。','',
'**限制**：这是源码映射而非运行时安全验收。read-only工具列表并不证明真实路径隔离，MCP名称不证明授权/可查询；输出schema的存在不证明执行链调用它；所有迁移建议均需父任务按真实DSH接口另行实施。','']
save('AGENT_MAPPING.md','\n'.join(m))

p=['# Worker 权限审计与安全边界','',
'**仅源码事实与迁移约束；未实施DSH运行时权限。** Managed YAML为工具白名单基线，插件Prompt frontmatter不是提权来源。主Prompt/Worker全文与所有SHA见 '+mdlink(OUT/'agent-mapping.json')+'；完整业务链见 '+mdlink(OUT/'AGENT_MAPPING.md')+'。','',
'## 1. 主Agent：全体只读调度','',
'| Main | Built-in allowlist | MCP server allowlist（均server-wide，非per-tool） | Worker白名单 | 证据 |','|---|---|---|---|---|']
for a in agents:
    p.append('| '+a['slug']+' | `'+', '.join(a['tools']['builtin_allowlist'])+'` | `'+', '.join(a['tools']['mcp_server_allowlist'])+'` | '+', '.join('`'+w['name']+'`' for w in a['workers'])+' | '+mdlink(a['tools_source'])+'；'+mdlink(a['manifest']['path'],block_ref(SOURCE/a['manifest']['path'],'callable_agents')['line_start'])+' |')
p += ['', '**GL/KYC特别约束**：主Agent不可持Write/Edit/Bash、不可被通用Office写入工具绕过；只接验证结构数据。GL resolver仅verified critic-checked breaks；KYC escalator仅rules/hits。Read的存在不是可读所有源文件的授权，原始附件只向对应reader映射。','',
'## 2. 三十个Worker精确权限（没有三十个同权通用Subagent）','',
'所有默认built-in disabled；表中才是enabled名单。全部callable_agents=[]。所有MCP server默认enabled:true，原仓库未列实际远端tools，不伪造MCP具体方法名。','',
'| Main / Worker | Built-in allowlist | MCP servers | Final writer | Bash | Skill names | 输出schema | 证据 |','|---|---|---|---|---|---|---|---|']
for a in agents:
    for w in a['workers']:
        p.append('| '+a['slug']+' / '+w['name']+' | `'+', '.join(w['tools']['builtin_allowlist'])+'` | '+(', '.join(w['tools']['mcp_server_allowlist']) or '无')+' | '+('是' if w['writes_final_artifacts'] else '否')+' | '+('有' if w['shell_enabled'] else '无')+' | '+(', '.join(s['name'] for s in w['skills']) or '[]')+' | '+(mdlink(w['output_schema_source']) if w['output_schema_source'] else '无')+' | '+mdlink(w['tools_source'])+' |')
p += ['', '## 3. 信任隔离与文件写入范围','',
'| 角色 | 允许数据 | 禁止 | 迁移必须增加的确定性约束 |','|---|---|---|---|',
'| 不可信文件reader（8个） | 仅授权任务原件、Read/Grep | MCP、Write/Edit、Shell、继续委派 | 挂载只读原件；返回schema数据；主Agent消费前Host验证 |',
'| 可信查询Worker | 仅本角色授权金融查询/验证数据 | 写入、原始outsider文档、未知MCP、继续委派 | 明确query工具allowlist、Session/source scope；不因有MCP就信任返回的指令 |',
'| pitch-modeler（例外） | 验证输入与受控scratch计算 | 最终文件写入、广泛Shell/网络或跨目录 | 用窄计算工具替代bash；只能隔离scratch，不能借MCP越权 |',
'| 10 leaf writers | 验证结构数据、批准模板及本任务成果root | 原件、MCP、外部发送/记账/交易、跨任务写 | 仅writer暴露窄Office/文件生成器；校验规范路径/版本/审批；默认无通用Shell |',
'| 主Agent | 验证Worker结果、授权金融查询、仅所属三Worker | Write/Edit/Bash、原始outsider内容直达高权限工具、跨main直接调用 | 精确角色Preset、所属worker白名单、深度1与任务root授权 |','',
'不可信reader数量8：market sector、earnings transcript、meeting news、GL reader、KYC doc、valuation package、month ledger、statement reader。另pitch researcher与model data-puller也有schema但访问金融MCP，不能混算为不可信隔离reader。','',
'**上游配置不是完整sandbox**：YAML仅开关工具；未提供每工具路径ACL、symlink检查或raw-file屏蔽。never open原件是Prompt边界，必须在迁移工具层落实。九个无Bash writer却绑定要求Bash/Python的author skill，是执行缺口，不是添加Shell的理由。','',
'## 4. MCP与技能：最小授权，不继承','',
'- server名：`'+', '.join(sorted(set(s for a in agents for s in a['tools']['mcp_server_allowlist'])))+'`。全部URL是环境占位符；本次未连接、未检验商业授权、未检验远端tool schema。',
'- 未配置服务必须NOT_CONFIGURED/UNAVAILABLE_EXTERNAL_DEPENDENCY。普通新闻不等于正式screening；预测不等于consensus；任意Excel不等于正式NAV。',
'- Skill只提供方法/需求，不授工具权限；主from_plugin完整技能目录不向Worker继承。大量Worker明确skills:[]；只有manifest.path列明的技能才绑定。',
'- MCP整server通配范围必须适配成真实已验证query工具白名单；新增Provider不得自动授给所有Agent。写能力即使远端存在也默认拒绝。',
'- 不向reader/checker提供通用Shell、脚本执行、任意URL fetch、宽泛filesystem或可写MCP替代通道。主Agent不能通过subagent继承/绝对路径绕过。','',
'## 5. 原始审核不是工具审批','',
'13条主Prompt差异化业务checkpoint：6条明确stop（pitch/market/model各2），7条draft/professional handoff（其他角色各1）。另有条件式Skill节点：DCF/3-statement/LBO分节确认、comps分节确认、competitive outline与deck-refresh编辑计划审批，及audit只报不改/专业签字边界；详见逐Agent conditional_skill_reviews，不能只保留13条而吞掉Skill内原始确认。原始责任人、源路径与行号逐Agent见 '+mdlink(OUT/'AGENT_MAPPING.md')+'。不可机械统一双Gate。',
'原始review仅Prompt；所有Policy都不能给权限提级，不可授权发布/客户发送/GL记账/交易/资金/最终KYC决定/IR、CCO或Controller签字。模型审核结论不是外部签字。',
'拟迁移：Host在阶段入口验证固定policy快照与artifact hash/version；只一次性结算；拒重复/过期；修改后失效；断线/重启恢复待审事实。建议方案，不声称本次已实现。','',
'## 6. 建议安全测试（本次未执行）','',
'1. 10主Agent逐一拒Write/Edit/Bash；30Worker逐工具白名单验证；拒委派非三Worker或深度2。',
'2. 8不可信reader尝试MCP/写入/Shell/网络被拒；10writer尝试原件读取、MCP、外部发送/记账被拒。',
'3. pitch-modeler测试Python文件/网络/绝对路径绕过；model-builder-builder同测，必须被受控替代或隔离。',
'4. 注入原件、研究报告、邮件、GP包、statements以及MCP返回，要求忽略指令并验证schema；测试合法非ASCII名称，长字符串、多层对象、额外键、NaN/Infinity、dynamic numeric maps大小。',
'5. ../../、绝对路径、symlink、UNC、原件覆盖、跨Session、同名model.xlsx并发覆盖全部拒绝。',
'6. MCP只读声明但实际提供mutate工具时必须拒；source/session越权、无凭据/撤销授权不可静默fallback冒充正式数据。',
'7. Review fast/custom不得开Shell/MCP写；重复/过期/并发审批、hash/version变化、重启恢复都拒错误放行。',
'8. 财务输出检查formula/来源/单位/时点、正式NAV与KYC身份；审计与日志不含凭据/PII不当外泄。','',
'## 7. 本次静态验证','',
f"生成器断言通过：{counts['main_manifests']}主、{counts['worker_manifests']}Worker、{counts['leaf_writers']}writer、{counts['shell_workers']}Bash、{counts['worker_output_schemas']}output_schema；全部Worker空callable_agents；每组三叶且恰一writer、writer全无MCP；引用的system/skills存在。未执行业务E2E。",'']
save('WORKER_PERMISSIONS.md','\n'.join(p))

# Explicitly verify every evidence line range and original-source SHA after generation.
assert len(list((SOURCE/'managed-agent-cookbooks').glob('*/agent.yaml')))==10
assert len(list((SOURCE/'managed-agent-cookbooks').glob('*/subagents/*.yaml')))==30
assert len(list((SOURCE/'plugins/agent-plugins').glob('*/agents/*.md')))==10
checks=0
for r in result['source_files']:
    assert sha((SOURCE/r['path']).read_bytes())==r['sha256']; checks+=1

def walk(obj):
    global checks
    if isinstance(obj,dict):
        if 'line_start' in obj and 'path' in obj:
            n=len(text(SOURCE/obj['path']).splitlines())
            assert 1<=obj['line_start']<=obj['line_end']<=n,obj
            checks+=1
        for v in obj.values(): walk(v)
    elif isinstance(obj,list):
        for v in obj: walk(v)
walk(result)
validation=dict(status='PASS',source_hash_and_line_checks=checks,counts=counts,runtime_tests_executed=0,commercial_e2e_executed=0,upstream_modified=False,dsh_modified=False,files=['agent-mapping.json','AGENT_MAPPING.md','WORKER_PERMISSIONS.md','generate_agent_audit.py'],findings=len(findings))
save('validation.json',json.dumps(validation,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(validation,ensure_ascii=False,indent=2))
