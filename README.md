# 账号保险库 / Account Vault

DeepSeek Harness Web UI 的本地账号密码备忘插件。账号内容在浏览器中使用主密码派生的密钥加密，保存在当前页面 origin 的 localStorage；支持多套密码不同的保险库及加密备份。

A local account/password memo for the DeepSeek Harness Web UI. Entries are encrypted in the browser and stored in the current page origin's localStorage. Multiple independently encrypted vaults and encrypted backups are supported.

## 安装 / Install

需要支持插件 bundle 的 DeepSeek Harness Web 环境，以及可用的浏览器 localStorage 和 Web Crypto（通常要求 HTTPS 或 localhost）。先将本目录下载或克隆到自己的机器，保留其中的文件，然后在 Harness 中调用 **`plugin_manager` 工具**，使用以下参数：

```json
{"action":"install_bundle","target":"<account-vault 目录的绝对路径>"}
```

例如 Windows 路径 `C:\Users\你\Documents\account-vault`：将路径填入 `target`（JSON 中每个反斜杠写成 `\\`）。也可以在 Harness 对话中告诉 agent：「请用 plugin_manager 安装这个本地插件目录：<绝对路径>」。

这不是终端命令。选择当前 profile 并按界面提示批准安装；安装会影响该 profile 的所有会话。安装完成后查看返回的 `application` 和 `warnings`，按结果指引操作，必要时刷新当前 Harness 页面。成功加载后可从侧边栏打开「账号保险库」。包名保持 `@local/dsh-account-vault`，`private: true` 是有意保留的；无需发布到 npm。安装方式及源码变更是否即时生效取决于当前 Harness 的构建与安装环境，不应假设刷新一定会重新构建插件。

Download or clone this directory, then invoke the Harness **`plugin_manager` tool** with `action: install_bundle` and the directory's absolute path as `target` (not a shell command). Installation affects the current profile. Check `application` and `warnings`, follow any restart instructions, and refresh the existing Web page if needed. The package intentionally remains private and uses the `@local` name.

## 安全与信任边界 / Security and trust boundaries

- 新建保险库使用 PBKDF2-SHA-256（600,000 次迭代、每库随机 16 字节盐）派生不可导出的 AES-256-GCM 密钥；每次加密使用随机 12 字节 IV 和固定附加认证数据。账号数组加密保存；主密码不会由插件写入 localStorage。请使用强且独立的主密码：持有密文的人可以离线猜测密码，8 字符的最低要求不等于安全强度。
- localStorage 和备份**并非全部密文**：库数量、主/附加标签、稳定 ID、创建及更新时间、KDF 参数、盐、IV 和密文长度等元数据可见。备份文件和密文也需要安全保管；删除浏览器数据不会删除已经导出的备份。
- 附加库仅提供**不同密码下的加密数据隔离和界面操作限制**，不是独立安全沙箱，也不是隐藏保险库存在的可否认加密。普通 UI 操作使用附加密码只能打开相应账本，但同源脚本、浏览器扩展、具有浏览器/系统访问权限的 agent、主机进程或恶意软件可能读取、修改或删除全部 localStorage，复制密文并离线猜测密码，或在输入、解锁及显示时获取明文。界面隐藏按钮不能阻止具有这些权限的操作者。**不要向不受信任的 agent 或测试者开放含真实保险库的浏览器、会话或设备**；使用单独的浏览器配置/环境，且其中绝不放入真实库或主密码。
- 解锁时密钥和明文存在页面内存及 UI 中；锁定、离开面板或卸载会尝试丢弃引用，但 JavaScript、浏览器、系统和扩展无法保证安全擦除内存、截图、日志、剪贴板历史或交换文件。复制密码后约 30 秒会尝试清空剪贴板，可能因权限、页面关闭等失败，也可能覆盖此后复制的其他内容；不保证清除剪贴板历史。显示密码约 20 秒后尝试隐藏。
- 数据按浏览器和 origin 隔离；清除浏览器数据、换浏览器或更换 origin 可能丢失数据。请离线安全保存加密备份并验证恢复。忘记主密码无法恢复内容。此插件未声明经过独立安全审计，不应将其作为唯一凭据存储方案。

**English summary:** Separate vault passwords do not sandbox an agent or conceal other vaults. Anyone with same-origin script, browser, extension, host, or device access may read or modify ciphertext and capture secrets while unlocked; offline password guessing is possible. Metadata remains visible. Use a separate environment without real secrets for untrusted testers, strong unique passwords, and protected backups. Locking and clipboard cleanup are best effort, not secure erasure.

## 开始使用

1. 在侧边栏打开「账号保险库」。首次使用时创建主保险库，输入并确认主密码，勾选无法找回密码的提示。至少需要 8 个字符，但请使用更强且独立的密码。
2. 解锁后选择「添加账号」，填写名称和密码，按需填写账号、网址和备注并保存。列表支持搜索、编辑、删除，以及生成、显示和复制密码。
3. 在「设置」中可修改当前库的主密码、调整空闲自动锁定时间，或创建附加保险库。默认空闲 5 分钟锁定，可选 1、5、15、30 或 60 分钟；离开面板也会锁定。
4. 主库可以创建附加库；附加库不能继续创建库。每套库使用不同密码，在锁定界面输入对应密码打开。设置页显示库的存在和类型；这些限制不是安全隔离，见上文。

## 备份与恢复

- 在已解锁库的「设置」中选择「导出备份」。从**主库**导出包含本机全部库；从**附加库**导出只包含该附加库，不包含主库。每套库恢复后仍需各自的密码，导出不会移除本机数据。
- 已有主库时，在主库「设置」中选择「导入备份」并选择文件；附加库中不能导入。预览会显示新增、跳过及冲突数量。「合并导入」只添加尚不存在的库，遇到已有库即保留本机版本，**不会合并库内账号或用备份更新已有库**。
- 「覆盖全部」需再次确认，会用文件中的库替换本机所有库；如果文件只有附加库，主库也会被移除。覆盖前先安全备份现有数据。没有主库时，可在创建界面选择「从备份文件恢复」进行合并恢复。
- 备份是加密数据及可见元数据，不是无需密码的恢复密钥。安全保管备份和对应密码；修改主密码后，旧备份仍需旧密码。使用独立环境和虚构数据验证导出与恢复，不要把真实库交给不受信任的测试者。

## 贡献与验证 / Contributing and validation

欢迎通过 [GitHub Issues](https://github.com/Veagau/dsh-account-vault/issues) 讨论非敏感问题，或提交 Pull Request。请使用虚构数据和独立的测试环境，勿提交真实账号、密码、主密码、备份或其他凭据。修改后使用已安装的 Node.js 和 npm，在仓库根目录运行：

```sh
npm run check
npm test
npm pack --dry-run --offline --ignore-scripts
```

无需安装项目依赖或联网。依次运行语法和发布文件检查、合成数据运行时回归测试、npm 包内容预览（不会发布）。GitHub Actions 在 Node 20、22、24 上执行这些检查（Actions 本身需下载运行环境）。测试不覆盖完整 UI、加密安全性、真实浏览器备份恢复或 Harness 集成；通过 CI 不代表安全审计或功能正确。Node 检查版本不等于 Harness 的支持版本：**尚未建立或验证 Harness / 浏览器版本兼容矩阵**。

## 已知风险与报告 / Known risks and reporting

- 导入遇到未知版本或不符合格式的记录时整体拒绝；本地数据无法读取时阻止覆盖。格式检查不能在未提供密码时证明密文未被篡改或能够解锁，覆盖前仍应安全保存已有备份，并在隔离环境中验证恢复。
- localStorage 不支持跨键事务；涉及多个键的删除若中途失败，可能只完成一部分。删除前请先安全备份，错误提示出现时不要假定所有数据均已删除。

发现其他问题时，不要在公开 Issue、PR 或日志中发布真实凭据、主密码、备份或可识别的敏感数据。优先通过 [GitHub 私密漏洞报告](https://github.com/Veagau/dsh-account-vault/security)（如仓库启用）联系维护者；若不可用，可先提交不含敏感细节的公开 Issue，请求私下联系方式。不要在得到安全渠道之前发送敏感材料。

**English:** Automated checks include synthetic-data runtime tests, not a security audit or full browser, integration, or restore testing. Harness/browser compatibility has not been established. Multi-key storage deletion is not transactional. Report sensitive findings privately if enabled; never post real credentials or backups publicly.

## 文件 / Files

- `package.json`、`cordis.patch.yml`：bundle 声明和配置。
- `index.js`、`client.js`：Host 入口、Web UI 和加密逻辑。
- `locale/`、`icon.svg`：显示资源。
- `LICENSE`：MIT 许可证。

## 许可证 / License

MIT，版权 © 2026 contributors。详见 [LICENSE](LICENSE)。
