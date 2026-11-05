# 当前发行版MCP兼容边界（P3未验收）

核对对象：正在运行的DSH `0.2.1-rc.5`，不是远端HEAD或只读参照源码的未来接口。[实际只读调用记录](../acceptance/P3-mcp-release-check.json)明确区分人工转录与自动测试。

## 实际可用与未发现的内容

- 安装包确实包含原生`@deepseek-ai/dsh-mcp-client`。发行版[README](<C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-mcp-client/README.md#L26-L69>)声明每entry一个server，支持stdio和streamable-http、连接重试及超时；工具登记到原生ctx.tools。不能据此说“DSH没有MCP”。
- 最初预检的原生Config查询中，该client与`@deepseek-ai/dsh-mcp-manager`均无已挂entry（total=0）；后续TEST_ONLY连接期间client实际新增1条，收尾移除。前者仅表示没有启用的服务器，不表示包不存在。
- 对安装包中`dsh-mcp-manager/package.json`的实际读取返回not found；当前未取得可用的公开动态register/connection/restart/probe/watch Manager服务合同。不能猜名字、调用私有connection supervisor或改Core来补出Manager。
- 原生client的声明式配置不是一个可从金融UI声称已具备的管理API；现有env/header示例也不是已验证的原生credential引用/OAuth流程。

## 本项目不做的事

不另建第二个通用MCP Manager、不伪造OAuth、不把配置存在或工具列表存在当连接/授权成功，也不借全局MCP工具绕过金融角色的单调权限层。

两个测试Adapter只是不同原始接口风格：一个进程内`tools.call`形状，另一个包内HTTP形状JSON文件；均没有启动外部MCP进程、HTTP服务或商业连接。它们不能验收原生MCP真实连接。

若接入已授权Provider，必须先取得该发行版实际公开的连接/状态/凭据接口或经支持的原生配置路径，再绑定窄capability、来源和exact Session授权。原生client会将server instructions记录进system prompt；不能因此给受限金融角色新增工具或执行权。

## P3判定

P3-MCP-NATIVE现为`SUPPORTED_NATIVE_TRANSPORT_VERIFIED / MANAGER_AND_SAFE_BRIDGE_GAP`，不是整体PASS。新增[7项真实stdio检查](../acceptance/P3-native-mcp-pass-003.json)及[2项卸载审计](../acceptance/P3-native-mcp-unload-pass-003.json)：使用发行版原生Client实际握手、ping/读取同进程TOY财报、公开dispatcher守卫拒绝、错误后观察恢复、金融角色看不到也不能调用raw MCP、卸载后工具定义和schemas撤销。未注册假Harness工具，未触碰来源策略、凭据或模型。

最初两个探针分别误把源允许的限定`read`列为禁止、误认拒绝结果必含`error.info.code=UNKNOWN_TOOL`；[失败001](../acceptance/P3-native-mcp-failure-001.json)与[失败002](../acceptance/P3-native-mcp-failure-002.json)保留。重试只修测试：仍同时断言raw MCP schema/definition缺席、实际分派失败，未放宽产品权限。

**尚不能完成金融Adapter的原生MCP桥接。** 真实金融角色的单调权限层会拒绝raw MCP；当前未取得能保留原Agent工具审批/沙箱边界的公开MCP Manager连接调用或委派契约。不能在Adapter中通过删去Agent、替换身份、直接调用definition.execute或私有连接来绕过。独立Host授权的连接测试不等于金融角色数据访问，更不是商业许可或OAuth。

其余契约、Adapter扩展、模型工具和真实Client链已独立验证；此宿主接口缺口仍保留，不能据此宣称P3已完成。
