# ACCEPTANCE_REPORT — 阶段中间报告

**整体状态：PARTIAL；P0、P1关键验收通过，P2–P6未验收。本报告不是完整移植完成声明。**

## 源码与安装

- 独立代码位置：当前workspace的 `financial-services-bundle`；分支 `feat/financial-services`。未修改其他业务项目、DSH Core、Session、Subagent或Client内核。
- 上游：本地 `C:/Users/Administrator/Downloads/financial-services-main`，363文件，SHA256 `1345d96cb71838806b855380bc55666c8ab642430260e8a5e9511c32cd11e18b`。无.git，Git commit未知；不以远端HEAD冒充。
- DSH：`0.2.1-rc.5`，Profile `desktop`，现有GUI `http://127.0.0.1:58156`。审计参照为同版本tag，commit `b830ec950faba0a46dda564be3e2d854afed94f1`；实际运行时exports与Inspect优先。
- 当前骨架：`@local/dsh-financial-services@0.1.2`，已原生安装且启用；唯一导航ID `financial-services`。
- 安装spec：`file:C:/Users/Administrator/Documents/deepseek-harness/default-workspace/financial-services-bundle/dist/local-dsh-financial-services-0.1.2.tgz`。
- tarball：26565 bytes、17文件，SHA256 `39bbc90e78bb5faac6f5a69f5485d69cf64707cba9922f8b73de2346c72e4fcd`。只包含源码/原生Host与Client artifact/patch/原创图标/中英元信息/LICENSE/NOTICE，不含测试夹具、参照DSH树、凭据或商业数据。

## 功能与状态

| 功能 | 状态 | 真实证据 / 缺口 |
|---|---|---|
| P0完整资产与治理审计 | IMPLEMENTED | 10主Agent/30Worker/63金融名称，逐文件SHA、完整资源树变体、许可及接口差异 |
| 原生安装/禁用/启用/卸载/重装 | IMPLEMENTED | 当前Profile各步application=applied；新工具与live Slot出现/撤销 |
| 一个工作台入口/插件配置与启用引导装配 | IMPLEMENTED | 四live Slot精确注册；实际页面点击/渲染尚未观察 |
| 原生Workspace规范path/id绑定及Host持久化 | IMPLEMENTED | 真实Gateway/工具共享方法，原生registry/domain、错误路径、CAS与事件流通过 |
| 卸载/重装恢复绑定、不删用户文件 | IMPLEMENTED | 绑定revision4恢复，canary不变；结束后默认绑定已清空，测试注册撤销 |
| 10主Agent/30Worker/63Skill运行时迁移 | PARTIAL | 源码映射已审计；P2尚未实施验收 |
| 金融数据契约/第三方Adapter | PARTIAL | 设计与来源已审计；P3未实施 |
| 业务执行/真实Excel与PPT文档交付 | PARTIAL | P4未实施，无伪造业务输出 |
| 四Review策略/确定性Gate/Queue/恢复 | PARTIAL | 源13主Prompt节点、44条件Skill节点已保留；P5未实现 |
| 完整工作台页面/检索/移动端/主题 | PARTIAL | P6未实施；当前仅P1绑定页面，无静态假运行卡片 |
| 指定dsh-mcp-manager动态管理接口 | BLOCKED | 此DSH版本没有该原生服务；不造通用第二Manager或修改Core |
| 商业MCP数据/OAuth/供应商entitlement | NOT_CONFIGURED | 无真实授权验证与数据查询，连接配置不等于可用 |
| 上游标准LBO/comps/Nike示例模板 | BLOCKED / PARTIAL | 本地未附原二进制；用户自带模板路线须另验，不能伪造原模板 |
| M365/Managed Agents平台等价性 | UNAVAILABLE_EXTERNAL_DEPENDENCY / PARTIAL | 只迁移可复用方法，不声称部署厂商云/租户/Office内嵌能力 |

完整映射：[迁移矩阵](MIGRATION_MATRIX.md)、[逐Agent源映射](audit/agents/AGENT_MAPPING.md)、[Skill变体](audit/upstream/SKILL_VARIANTS.md)、[兼容矩阵](COMPATIBILITY_MATRIX.md)、[权限矩阵](SECURITY_MATRIX.md)。

## 验证结果

- P0：12静态单测、17上游验证项、618源SHA/行号检查通过。原始commit未知如实保留。
- P1：38单元测试、20真实当前Host检查通过；原生生命周期及四Client Slot核验完成。实际命令与失败/复测见 [TEST_REPORT](TEST_REPORT.md)、[P1阶段记录](acceptance/P1.md)、[结构化证据](acceptance/P1-results.json)。
- 所有阶段记录在 [验收总账](acceptance/README.md)。0.1.0与0.1.1失败保留；不把package步骤exit0当application成功。
- **没有真实金融数据E2E，没有商业查询，没有金融模型/报告成品验收。** 原生Host集成不等于业务闭环。
- 无浏览器控制工具：页面实际点击、目录选择器操作、渲染图标、明暗主题与窄屏为NOT_VERIFIED。源码、Slot注册与资源hash不能替代视觉验收。
- 当前恢复证据为原生插件卸载/重装后的域冷开；不是Desktop进程重启。完整重启/恢复留待P5/P6。

## 许可、升级和卸载

根 [LICENSE](LICENSE) 为上游Apache-2.0文本；本项目新增归属说明见 [NOTICE](NOTICE)。P2迁移时必须保留所有适用Kensho/LSEG/Skill自带许可及修改标记；开源代码许可不授予商业数据访问权。第三方库按各自MIT许可使用，Cordis保持共享external。

安装、升级、禁用、卸载只使用原生Plugin Manager；不手改Profile patch。当前包只管理金融默认绑定与插件效果，卸载不删除Workspace目录、原始文件或DSH历史。重装从Host域恢复；目录已移动/无权限/注册消失时显示真实受限状态，需重新绑定。升级结果以application/warnings/nextStep为准；不承诺无重建或无重启更新。

P1验收中的三个临时TEST_ONLY测试插件已移除；其无图标/locale属于一次性测试夹具例外，未作为用户安装单元发布。未发布npm或上传任何样例。

## 后续与客观人工步骤

继续P2→P6，逐阶段先列标准、后实施与验证。供应商订阅、OAuth/租户管理员同意、数据授权及专业合规签字必须由具备资格的人完成，不能由本Bundle伪造或代办。金融Review不能改变工具审批、沙箱、来源授权，永久禁项保持不发布、不客户通讯、不正式记账、不交易或代替合规签字。
