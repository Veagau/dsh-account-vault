# 账号保险库 / Account Vault

DeepSeek Harness Web UI 的本地账号密码备忘插件。账号内容在浏览器中使用主密码派生的密钥加密，保存在当前页面 origin 的 localStorage；支持多套密码不同的保险库及加密备份。

A local account/password memo for the DeepSeek Harness Web UI. Entries are encrypted in the browser and stored in the current page origin's localStorage. Multiple independently encrypted vaults and encrypted backups are supported.

## 安装 / Install

需要支持插件 bundle 的 DeepSeek Harness Web 环境，以及可用的浏览器 localStorage 和 Web Crypto（通常要求 HTTPS 或 localhost）。先将本目录下载或克隆到自己的机器，保留其中的文件，然后在 Harness 中调用 **`plugin_manager` 工具**，使用以下参数：

```json
{"action":"install_bundle","target":"<account-vault 目录的绝对路径>"}
```

这不是终端命令。选择当前 profile 并按界面提示批准安装；安装会影响该 profile 的所有会话。安装完成后查看返回的 `application` 和 `warnings`，按结果指引操作，必要时刷新当前 Harness 页面。成功加载后可从侧边栏打开「账号保险库」。包名保持 `@local/dsh-account-vault`，`private: true` 是有意保留的；无需发布到 npm。安装方式及源码变更是否即时生效取决于当前 Harness 的构建与安装环境，不应假设刷新一定会重新构建插件。

Download or clone this directory, then invoke the Harness **`plugin_manager` tool** with `action: install_bundle` and the directory's absolute path as `target` (not a shell command). Installation affects the current profile. Check `application` and `warnings`, follow any restart instructions, and refresh the existing Web page if needed. The package intentionally remains private and uses the `@local` name.

## 安全与信任边界 / Security and trust boundaries

- 新建保险库使用 PBKDF2-SHA-256（600,000 次迭代、每库随机 16 字节盐）派生不可导出的 AES-256-GCM 密钥；每次加密使用随机 12 字节 IV 和固定附加认证数据。账号数组加密保存；主密码不会由插件写入 localStorage。请使用强且独立的主密码：持有密文的人可以离线猜测密码，8 字符的最低要求不等于安全强度。
- localStorage 和备份**并非全部密文**：库数量、主/附加标签、稳定 ID、创建及更新时间、KDF 参数、盐、IV 和密文长度等元数据可见。备份文件和密文也需要安全保管；删除浏览器数据不会删除已经导出的备份。
- 附加库仅提供**不同密码下的加密数据隔离和界面操作限制**，不是独立安全沙箱，也不是隐藏保险库存在的可否认加密。普通 UI 操作使用附加密码只能打开相应账本，但同源脚本、浏览器扩展、具有浏览器/系统访问权限的 agent、主机进程或恶意软件可能读取、修改或删除全部 localStorage，复制密文并离线猜测密码，或在输入、解锁及显示时获取明文。界面隐藏按钮不能阻止具有这些权限的操作者。**不要向不受信任的 agent 或测试者开放含真实保险库的浏览器、会话或设备**；使用单独的浏览器配置/环境，且其中绝不放入真实库或主密码。
- 解锁时密钥和明文存在页面内存及 UI 中；锁定、离开面板或卸载会尝试丢弃引用，但 JavaScript、浏览器、系统和扩展无法保证安全擦除内存、截图、日志、剪贴板历史或交换文件。复制密码后约 30 秒会尝试清空剪贴板，可能因权限、页面关闭等失败，也可能覆盖此后复制的其他内容；不保证清除剪贴板历史。显示密码约 20 秒后尝试隐藏。
- 数据按浏览器和 origin 隔离；清除浏览器数据、换浏览器或更换 origin 可能丢失数据。请离线安全保存加密备份并验证恢复。忘记主密码无法恢复内容。此插件未声明经过独立安全审计，不应将其作为唯一凭据存储方案。

**English summary:** Separate vault passwords do not sandbox an agent or conceal other vaults. Anyone with same-origin script, browser, extension, host, or device access may read or modify ciphertext and capture secrets while unlocked; offline password guessing is possible. Metadata remains visible. Use a separate environment without real secrets for untrusted testers, strong unique passwords, and protected backups. Locking and clipboard cleanup are best effort, not secure erasure.

## 功能与备份 / Features and backups

- 创建、解锁和锁定保险库；空闲自动锁定默认 5 分钟，可选 1、5、15、30 或 60 分钟。
- 账号条目的新增、编辑、删除、搜索；密码生成、临时显示及复制。
- 主保险库可创建附加库；每库使用独立主密码。设置页显示库的存在与类型。
- 主库导出包含所有库；附加库导出只包含当前库。备份仍需各自密码解锁。
- 导入默认合并并保留本机版本；「覆盖全部」会替换本机所有库并需再次确认。没有主库时可从备份合并恢复。测试恢复时应使用独立环境和测试数据。

## 贡献与验证 / Contributing and validation

欢迎通过 [GitHub Issues](https://github.com/Veagau/dsh-account-vault/issues) 讨论非敏感问题，或提交 Pull Request。请使用虚构数据和独立的测试环境，勿提交真实账号、密码、主密码、备份或其他凭据。修改后使用已安装的 Node.js 和 npm，在仓库根目录运行：

```sh
npm run check
npm pack --dry-run --offline --ignore-scripts
```

无需安装项目依赖或联网。第一条命令检查仓库中 JavaScript 的语法、JSON 能否解析以及关键文件存在且非空；第二条预览 npm 打包内容，不发布包。GitHub Actions 在 Node 20、22、24 上运行这些检查（Actions 本身需下载运行环境）。检查不执行插件、不验证 YAML 或包内容的语义，也不测试 UI、加密安全性、备份恢复、Harness 集成或浏览器兼容性。通过 CI 不代表安全审计或功能正确。Node 检查版本不等于 Harness 的支持版本：**尚未建立或验证 Harness / 浏览器版本兼容矩阵**。

## 已知风险与报告 / Known risks and reporting

- `clearFileRaw` 捕获并忽略 localStorage 删除异常；删除失败可能未被告知，不能据此确认数据已删除。
- 备份解析会跳过不符合记录格式的条目，只要仍有有效条目就可能继续导入；尤其覆盖导入可能导致部分数据遗漏。先安全保留原始备份，在隔离环境用测试数据验证恢复。

以上为已发现风险，**尚未修复**。发现其他问题时，不要在公开 Issue、PR 或日志中发布真实凭据、主密码、备份或可识别的敏感数据。优先通过 [GitHub 私密漏洞报告](https://github.com/Veagau/dsh-account-vault/security)（如仓库启用）联系维护者；若不可用，可先提交不含敏感细节的公开 Issue，请求私下联系方式。不要在得到安全渠道之前发送敏感材料。

**English:** Checks cover JS syntax, JSON parsing, required nonempty files and an offline npm pack preview, not runtime, security, integration or restore correctness. Harness/browser compatibility has not been established. Storage deletion errors can be swallowed and malformed backup records silently skipped; these are not fixed. Report sensitive findings privately if enabled, never post real credentials or backups publicly.

## 文件 / Files

- `package.json`、`cordis.patch.yml`：bundle 声明和配置。
- `index.js`、`client.js`：Host 入口、Web UI 和加密逻辑。
- `locale/`、`icon.svg`：显示资源。
- `LICENSE`：MIT 许可证。

## 许可证 / License

MIT，版权 © 2026 contributors。详见 [LICENSE](LICENSE)。
