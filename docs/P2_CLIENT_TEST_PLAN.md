# P2 原生 Client ↔ Host TEST_ONLY 验收

## 当前交付与执行门禁

本fixture仅实现验收，不改产品。构建不会安装、启动server、创建Session或运行验收。安装和卸载由父任务明确控制；应先完成产品Host完整重启，再review后安装。fixture的Client每次页面激活执行一次，安装后应保持页面不刷新、不切换Session、不输入、不提交，直到结果落盘。

- [Client源码](<../tests/p2-client/client.js>)：无组件、无React/DOM渲染，无产品feature值导入；只调用已挂载production StoredEntry.inject()返回的真实callback。
- [Host源码](<../tests/p2-client/host.js>)：独立TypertRemoteService，只用严格native descriptors接收结果和辅助读取/清理，不开HTTP路由，不用fetch/自定义credential，不注册模型工具。
- [严格共享描述符](<../tests/p2-client/contract.js>)：所有request/result为strictObject；结果为至多2,000,000 UTF-8字节的已验证JSON文本（TextEncoder实测字节数），不接收用户原draft。
- [构建脚本](<../scripts/build-p2-client-fixture.mjs>)：仅写tests/p2-client/fixture-retry-2内的单包Host+Client产物，不构建产品。依赖由现有项目提供，不自行安装。

构建命令（使用父任务已加载的托管Node）：

```powershell
& '<managed-node.exe>' --check tests/p2-client/client.js
& '<managed-node.exe>' --check tests/p2-client/host.js
& '<managed-node.exe>' --check tests/p2-client/contract.js
& '<managed-node.exe>' --check scripts/build-p2-client-fixture.mjs
& '<managed-node.exe>' scripts/build-p2-client-fixture.mjs
```

生成的package为`@local/dsh-financial-services-p2-client-retry-2`，版本`0.0.1`，独立产物目录为[fixture-retry-2](<../tests/p2-client/fixture-retry-2/>)。父先remove前一TEST_ONLY包，然后安装新identity；不覆盖已加载Host module以规避native Node import cache。只有一个Host安装行及同包Client，无产品导航、Preset、Tool、配置UI。icon/locale例外仅适用于这个一次性、renderless、明确TEST_ONLY的测试单元，不是产品发行例外。

## retry-2：独立于故障Remote通道的本地Inspect

父实际刷新后retry-1仍无Client checkpoint，但公开runtime inspector确认生产及retry-1的materialization/registry/fiber均ACTIVE、无加载错误，7个services存在，modules.entries.state无failures且releaseChange为null；因此“未加载/缺DI/必须刷新”不再是当前解释。原始0.0.1的历史停点仍未知。retry-1的activate catch隐藏实际异常，是明确诊断缺陷。

retry-2外层硬inject `remote/cordisInspect`，metadata再列`@deepseek-ai/dsh-cordis-client-runner`。apply同步通过`ctx.effect(() => ctx.cordisInspect.register(...))`注册`FinanceP2ClientFixtureState.state({})`，query只克隆apply闭包内的stage/error/checkpointResult/history，不做Remote mount或业务调用，卸载自动注销。该公开注册signature已核[Inspect registry:48–73](<../audit/dsh-reference/packages/extensions/cordis-client-runner/src/client/inspect-registry.ts#L48-L73>)。

启动阶段逐步记录`CONTRACT_CREATE_START/END`、`REMOTE_MOUNT_START/END`及每个checkpoint的`START/END`。首次异常保留失败operation及name/code/message/stack/detailsJson/remoteStack，单字段明确截断到256/4096/8192/12288字符；history至多32条。checkpoint保留实际RemoteResult的ok/value或name/code/message/details/stack，不再只抛generic rejected。只记录fixture自有启动错误和固定checkpoint请求的返回，不读取/导出任何用户draft字段。

retry-2改为同一package的一次full `$mount(remote)`，不再拆diagnostic owner。纯读同版RemoteStore.register/validateInvocation显示原`/diagnostic`贡献的package与descriptor/typeSymbol前缀无强制相等检查，故没有证据把owner mismatch定为retry-1根因；保留首个实际错误再决定修复。纯生成不执行fixture、不安装、不预写验收PASS。

## 原始NoReport诊断结论与retry-1

历史停点仍为`UNDETERMINED`，不把安装applied、子Inspect timeout或conversation未catalogued解释成Client已运行/GUI离线/service不存在。父的live Client catalog没有公开Meta/package.loader诊断入口；本fixture不猜接口，不用私有window hook。

已确认的实际缺陷：原Host baseline把同步`financeOperations.snapshot({})`当Promise并调用`.then`，现在改为`await`兼容真实公开返回。该错误能够阻止begin，但正常finish仍应落盘，故不能单独解释历史NoReport。原Client在全部七个硬依赖与apply首个`$mount`之前没有任何Host证据，首await失败也不进入run/finally；run外失败/finish失败只console。因此仅凭无报告不能定位历史激活失败。

已排除猜测：8个manifest inject package names与发行ASAR/同版reference匹配；它们是informational package edges，不代替service DI。发行Conversation的apply原生`ctx.plugin(ConversationController)`创建root singleton，公开`input.for(binding.ctx)`可按scope寻址，不应因未catalogued而删除composer检查。产品实际[Host产物](<../lib/host.js#L7-L9>)同样external import Cordis Service/TypertRemoteService；发行Service.init为`Symbol.for('cordis.init')`，Cordis明确执行该symbol方法并消费async generator。Host严格descriptor注册不依赖catalog reflection的非空services列表；空model本身不是严格调用失败证据。

最小改动是保留原安全run，外层仅硬inject native `remote`，先mount单独diagnostic contribution，发送`CLIENT_APPLY`，再mount其余business descriptors，发送`REMOTE_MOUNTED`。随后原生`ctx.inject`等待原6个业务service，记录`DEPENDENCIES_WAITING/READY`，15秒未就绪则发送`DEPENDENCIES_TIMEOUT`并finish出`PARTIAL/NOT_RUN`报告，不导航、不分配Workspace。所有presence均用公开`ctx.get`只记service key/boolean，不包含用户draft或session私密文本。`CLIENT_APPLY`证明已进入apply且最小diagnostic mount已完成；若该最小mount自己失败/卡住，不能声称已区分factory与apply，Host会明确保留NoReport而非推断。

Host在`[Service.init]`第一步写自有`acceptance/P2-client-diagnostic.json`的`HOST_INIT_ENTERED`，注册strict descriptors后写`HOST_REMOTE_REGISTERED`，注册失败写`HOST_REMOTE_REGISTRATION_FAILED`并继续抛错。45秒没有begin/finish且无active owned run时写`NO_CLIENT_REPORT_WITHIN_45_SECONDS`及`P2-live-client.json`的`NOT_RUN`，仅写fixture证据，不调用binding/registry操作。begin/finish到达另记Host checkpoint。Client异常追加固定失败stage，不把异常携带的用户文本导出。Host若连constructor/init都没有执行，任何同包代码无法自证；诊断文件缺失仍须父用Loader原生证据判断，不能伪造PASS。

## 已确认的公开API

Inspect先列Provider；Host精确查询已确认`sessionController.inspect`、`workspaceRegistry.create/get/delete/resolveByPath`、`typert.register`。子会话Client Inspect超时不能解释为GUI离线，父已确认当前Client在线，父的live Inspect为权威。下面同版rc.5源码作为未catalogued公开方法的补充依据；不读取任何private成员。

| 需求 | 公开入口与同版声明 |
| --- | --- |
| 读真实注册callback | `ctx.slots.entries(key)`、`entriesOfSlot(key)`、`subscribe(key, listener)`；[SlotRegistry:399–463](<../audit/dsh-reference/packages/client/ui-renderer/src/client/registry.ts#L399-L463>)。无需获取`_core`，不读取它。 |
| callback注入face | StoredEntry.inject返回plain callbacks；[StoredEntry:845–859](<../audit/dsh-reference/packages/client/ui-slots/src/index.ts#L845-L859>)。调用真实main条目的inject，不调用产品工厂，不渲染组件。 |
| resources实际retain | `ctx.resources.source(address)`的`subscribe()`即holder acquisition，其disposer释放；不是不存在的get/retain API。[Resources:87–114](<../audit/dsh-reference/packages/client/resources/src/client/contract.ts#L87-L114>)。 |
| finite catalog完成 | 成功generator结束后保留`live`，没有`done`状态；[resources:199–210](<../audit/dsh-reference/packages/client/resources/src/client/resources.ts#L199-L210>)。 |
| 原当前target | `ctx.sessions.list.getSnapshot().byId[*].retainedBy.mainView`；[ISessions:49–74](<../audit/dsh-reference/packages/api/session-controller/src/client/contract/sessions.ts#L49-L74>)。不假设父Session id，不读localStorage。 |
| scope pin与release | `sessions.retain(id,{source:'workspaceOperation'})`、reference.ready/release；[SessionReference:24–33](<../audit/dsh-reference/packages/api/session-controller/src/client/contract/sessions.ts#L24-L33>)。仅pin当前已选择的Session。 |
| 原panel | `layout.panelInfo.getSnapshot().activePanelId`；[ILayout:18–41](<../audit/dsh-reference/packages/client/ui-layout/src/client/service.ts#L18-L41>)。非null不运行导航。 |
| 真实composer未提交文本 | `ctx.conversation.input.for(binding.ctx).state.getSnapshot().draft`；[IConversation:35–42](<../audit/dsh-reference/packages/client/ui-conversation/src/client/service.ts#L35-L42>)、[SessionInput:183–229](<../audit/dsh-reference/packages/client/ui-conversation/src/client/contract/input.ts#L183-L229>)、[InputState:289–304](<../audit/dsh-reference/packages/client/ui-conversation/src/client/contract/input.ts#L289-L304>)。仅read，绝不调用setDraft/submit/send。 |
| 恢复target | `ctx.uiWorkspace.openSession(originalId):void`；[UiWorkspace:38–89](<../audit/dsh-reference/packages/client/ui-workspace/src/client/navigation.ts#L38-L89>)。startSession也是void，不能将其返回当作Session创建成功。 |

## 运行顺序与成功证据

1. 以native Resources source订阅并保留`finance-catalog/current`与`finance-workspace/current`。catalog真实live counts必须为`10/30/63/41/29`；workspace初值与TestOnly Host读取的真实产品snapshot一致。未知/失败不伪造数据。
2. `main`、`sidebar.panellist`中的`financial-services`，以及config/activation中的`@local/dsh-financial-services`各必须只有一条ledger registration，且未被shadow/abdicate。取得main的真实inject，重复取face确认startDraft为同一callback identity。
3. 只有Conversation panel且唯一ordinary mainView target才继续。无target、多target、subagent或全局panel时导航`NOT_RUN`；不自动选择猜测的target。旧默认binding若非null但当前不为READY，也不执行可能无法还原的绑定变更；Host在begin时再次检查。pin原scope，读取原draft及attachments/reference/claim并仅在内存比较；原文本和标识不写入Host JSON、日志或console。原composer只有phase严格为plain才允许导航；claimed、adjudicating、submitting均NOT_RUN。
4. Host分配UUID命名的`TEST_ONLY-*`独立目录和Workspace，保存原binding/revision；尚不创建Session。Client通过真实production bindWorkspace callback，以原revision CAS绑定该独立Workspace，并等待native workspace resource更新。
5. 同一个production startDraft callback先以自有非金融prompt为main A创建blank native Session。订阅sessions.list观察真正mainView切换，再从公开composer读取actual draft，与Host已准备intent比较。intent的传入prompt不是composer证据。
6. 选择catalog中`selectionRequired`的多目标command，显式指定另一可用main B。观察另一Session的mainView与真实composer。两个Session必须不同。Host仅inspect自有Workspace新Session的preset/cwd/event types，无模型turn、无user message、无工具/请求事件。
7. 从B导航回A，再次调用同一production startDraft，传不同自有prompt并保持`keep`。必须回到A的原blank，真实composer仍为第一次文本而非新intent。如此以实际selection变化见证异步void完成，不用同target的立即snapshot冒充完成。
8. production Worker callback必须返回`MAIN_AGENT_REQUIRED`，不导航、不改变actual composer、不新增Session。最后重新Host inspect两个native Sessions，仍无提交或模型事件。
9. finally恢复原target，原draft只读比较为unchanged，释放原scope pin及所有fixture resource subscriptions。若用户中途导航到其他target/全局panel，不覆盖其新选择，报告`NOT_RUN/PARTIAL`。
10. Host finally只在原revision或唯一fixture bind的预期revision下CAS还原旧binding；有并发外部绑定时拒绝覆盖。即使bind响应超时但请求尚未到Host，也会CAS重写原binding以推进revision，阻止携旧revision的延迟bind。还原的是原path/Workspace identity，revision单调增加、boundAt可变化，不声称完整元数据逐字还原。仅移除ownership marker匹配且未仍被绑定的独立registry；目录和Session历史保留，可能显示在Ungrouped。不archive、不删除任何Session或文件。

## 取消、期限与失败

每个observable等待最多15秒，通过subscribe事件/Promise完成，无poll/sleep。run由Cordis effect拥有，卸载会abort等待并等待finally。所有timer/listener/subscriptions/reference均显式清理。Host在begin完成后设180秒一次性清理watchdog，避免Client失联长期保留默认绑定；watchdog不是轮询。

production callback公开参数没有AbortSignal。fixture不能取消已经发出的production prepareDraft，只能对自己的等待设期限，失败时恢复导航并在该Promise迟到settle时撤销仅指向owned Workspace的late navigation；这个continuation不保留timer、subscription或Session reference，不追随用户跳转。Host CAS fence阻止迟到bind，移除owned registry阻止后续正常创建。出现这种超时即FAIL，不声称完整取消production RPC或成功验收；父应检查输出再卸载fixture。若核心回调永久不settle，native RPC本身的挂起属于production公开callback缺乏取消参数的限制，fixture不会无限await它。

Host清理失败、并发binding或navigation冲突都在结果中区分，不以finally经过当作清理成功。其他产品组件可能仍持有同一resource；fixture只声称已释放自己取得的holder，不声称全局resource一定重置idle。

## 报告解释

正式结果由Host仅写自有`acceptance/P2-live-client.json`及独立run目录副本；fixture源码构建不预写验收结果。

- `PROGRAMMATIC_PRODUCTION_CALLBACK_AND_NATIVE_UI_DOMAIN`：production Slot callback、真实native transport/domain与公开actual composer状态。
- `actualMouseClick: NOT_VERIFIED`、`visualRendering: NOT_VERIFIED`：没有鼠标点击/浏览器视觉证据，不能升级成已验证。
- `financialExecution: NOT_RUN`：不submit、不调用模型、不执行金融工作。
- 缺public API或安全target：依赖步骤NOT_RUN，composer维持NOT_VERIFIED。不要使用私有Store、替身工厂、fake React/DOM或新server补验。

父收取结果后卸载唯一TEST_ONLY package；只读取其owned目录和报告，不清理用户Session、draft、界面配置、Profile或DSH代码。
