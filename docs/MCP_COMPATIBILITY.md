# 当前发行版MCP兼容边界（P3未验收）

核对对象：正在运行的DSH `0.2.1-rc.5`，不是远端HEAD或只读参照源码的未来接口。[实际只读调用记录](../acceptance/P3-mcp-release-check.json)明确区分人工转录与自动测试。

## 实际可用与未发现的内容

- 安装包确实包含原生`@deepseek-ai/dsh-mcp-client`。发行版[README](<C:/Users/Administrator/AppData/Local/Programs/DeepSeek Harness/resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-mcp-client/README.md#L26-L69>)声明每entry一个server，支持stdio和streamable-http、连接重试及超时；工具登记到原生ctx.tools。不能据此说“DSH没有MCP”。
- 本轮原生Config查询中，该client与`@deepseek-ai/dsh-mcp-manager`均无已挂entry（total=0）。前者仅表示没有启用的服务器，不表示包不存在。
- 对安装包中`dsh-mcp-manager/package.json`的实际读取返回not found；当前未取得可用的公开动态register/connection/restart/probe/watch Manager服务合同。不能猜名字、调用私有connection supervisor或改Core来补出Manager。
- 原生client的声明式配置不是一个可从金融UI声称已具备的管理API；现有env/header示例也不是已验证的原生credential引用/OAuth流程。

## 本项目不做的事

不另建第二个通用MCP Manager、不伪造OAuth、不把配置存在或工具列表存在当连接/授权成功，也不借全局MCP工具绕过金融角色的单调权限层。

两个测试Adapter只是不同原始接口风格：一个进程内`tools.call`形状，另一个包内HTTP形状JSON文件；均没有启动外部MCP进程、HTTP服务或商业连接。它们不能验收原生MCP真实连接。

若接入已授权Provider，必须先取得该发行版实际公开的连接/状态/凭据接口或经支持的原生配置路径，再绑定窄capability、来源和exact Session授权。原生client会将server instructions记录进system prompt；不能因此给受限金融角色新增工具或执行权。

## P3判定

P3-MCP-NATIVE目前保留为`DECLARED_RELEASE_INTERFACE_GAP / NOT_VERIFIED`。其余契约、Adapter扩展、规范化与权限可以独立实现和验证，但不得用TEST_ONLY结果把这个缺口改为PASS，也不据此宣称P3已完成。
