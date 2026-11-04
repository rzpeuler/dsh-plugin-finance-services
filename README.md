# Financial Services for DSH

独立、仓库外 Financial Services Bundle。当前源码版本 **0.2.1 / P2 集成候选版**，不是完整金融移植产品。P0、P1关键验收已完成；P2角色、技能与受限运行时的原生验收以完整源码仓库的阶段记录为准。角色注册/技能加载不代表金融业务或商业数据已验证。

## 当前范围

- 原生 Plugin Manager 单一安装单元，无 DSH Core 修改。
- 一个 Financial Services 导航入口，以及原生插件配置/启用引导位置。
- Host 负责真实 Workspace 目录验证、规范路径/ID绑定、版本化持久状态；Client 只显示真实 Host 状态。
- 默认仅绑定真实已存在的本地目录。使用原生目录选择器，或输入绝对目录；不会调用全局 initializeDefault，也不会自动执行金融任务。
- 禁用/卸载不删除用户目录、原始附件或 DSH Session 历史。重新安装从Host持久域读取既有绑定；目录已移动则需重新绑定。
- Workspace切换仅改变未来任务默认目录，不移动历史 Session 或成果。
- 10主角色、30独立Worker persona、63完整金融技能及41命令/29样例的只读目录；入口只创建未提交草稿。
- 每角色独立的原生Preset与Skill registry/provider/loader作用域；Writer无MCP，主/Reader无写入，两个源Bash例外不开放通用Shell。
- 文件操作通过宿主FS/provider与沙箱策略；写入只限该Session分配的成果目录，创建不覆盖、编辑需SHA与原生版本CAS。已有链接/junction拒绝；不宣称提供超越宿主的恶意本地OS进程TOCTOU隔离。
- 独立权限底线随原生retained revision保留；角色/root被撤销或源/Prompt版本不符时，拒绝包括原生Agent-own委派工具在内的操作。

## 安装

要求 DSH `0.2.1-rc.5` 与 Node `^22.19 || >=24`。当前P2原生验收使用 DSH Plugin Manager 链接此源码目录；本地tarball可分发payload，但复制安装的fresh进程验收尚未通过，不能当作已验证的P2安装路线。开发构建使用Python 3（非PATH环境可设置 `FINANCE_BUILD_PYTHON` 为其可执行文件）与锁文件及以下脚本；构建的完整源ZIP补保pnpm默认忽略的两个.gitignore元数据：

```text
pnpm install --ignore-scripts
pnpm run build
pnpm test
pnpm run check:package
pnpm pack
```

不在用户 Profile 目录手写配置或运行包管理器。安装返回 application=applied 才表示已应用；restart-required 必须按提示重启。源码修改不保证现有页面自动刷新，必须先重建Client artifact，并按宿主返回的生命周期操作。上下文预算与未测口径见[模型体验](docs/MODEL_EXPERIENCE.md)。

## 首次使用

进入 Financial Services。若尚未绑定，选择或输入一个真实已存在的本地工作目录，确认保存。页面显示原生Workspace ID、规范路径及状态。不存在/无权限/路径移动明确报错；不会把配置存在视为可用。取消目录选择不写配置。目录中的按钮只打开原生未提交草稿并保留已有草稿，不自动调用模型；多目标命令须明确选择主角色。商业Adapter、Office执行与确定性Review Gate仍待后续阶段。

## 权限和业务限制

绑定工作目录不改变 Shell、工具审批、文件沙箱或商业数据授权。金融内部Review与 ask/never 独立。后续金融功能永久禁止自动发布、客户通信、正式总账记账、交易/资金操作及代替专业合规签字。

商业MCP均未配置/未验证；本版DSH没有任务书指定的动态MCP Manager，不能声称支持其restart/probe/watch/OAuth管理接口。源仓库缺失的LBO/comps/Nike二进制模板不会被虚构补齐。阶段记录明确区分静态测试、真实Host集成、UI操作和金融数据E2E。

## 来源和审计

完整源码仓库的 SOURCE_INVENTORY、COMPATIBILITY_MATRIX、MIGRATION_MATRIX、SECURITY_MATRIX、TEST_REPORT 及 acceptance 目录保留每阶段标准和实际结果。根 LICENSE / NOTICE 与所有迁移资产的原始许可同时分发；完整来源文件保存在只读源归档，适配文件带修改标记。商业数据不因开源代码许可而自动获得使用权。

## English summary

An independent out-of-tree DSH bundle. Version 0.2.1 is a P2 integration candidate with ten main presets, thirty separately scoped Workers, sixty-three complete Skill directories and unsent draft templates. Source permissions are enforced by narrow provider-backed tools and a retained-revision permission floor; no general Shell is exposed. Commercial adapters, Office execution and deterministic Review Gate are not yet implemented. Native registration, static tests and business E2E are reported separately. Install through the native Plugin Manager; disable/uninstall preserves user files and native history. Review policy never grants tool, sandbox or commercial data permissions.
