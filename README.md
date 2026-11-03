# 账号保险库 / Account Vault

[English](#english)

DeepSeek Harness Web UI 的本地账号密码备忘插件。账号在浏览器中加密，保存在当前页面 origin 的 localStorage；支持多套保险库和加密备份。

## 安装

需要支持 bundle 的 DeepSeek Harness Web 环境，以及可用的 localStorage 和 Web Crypto（通常需要 HTTPS 或 localhost）。下载或克隆本目录后，在 Harness 中调用 **`plugin_manager` 工具**：

```json
{"action":"install_bundle","target":"<account-vault 目录的绝对路径>"}
```

这不是终端命令。Windows 路径在 JSON 中需将反斜杠写成 `\\`；也可以请 Harness agent 用该工具安装本地目录。安装影响当前 profile 的所有会话。查看返回的 `application` 和 `warnings`，按提示操作，必要时刷新页面。加载成功后从侧边栏打开「账号保险库」。插件保持私有，无需发布到 npm；源码修改是否生效取决于构建和安装环境，刷新不一定会重新构建。

## 使用

1. 首次打开时创建主保险库，确认密码无法找回的提示。主密码至少 8 个字符，请使用更强且独立的密码。
2. 解锁后选择「添加账号」；名称和密码必填，账号、网址和备注可选。列表支持搜索、编辑、删除以及生成、显示和复制密码。
3. 在「设置」中修改当前库的主密码、调整自动锁定时间或创建附加库。默认空闲 5 分钟锁定，可选 1、5、15、30 或 60 分钟；离开面板也会锁定。只有主库可以创建附加库，各库用不同密码解锁。

## 备份与恢复

- 在已解锁库的「设置」中导出备份：主库导出全部库，附加库只导出自身。导出不删除本地数据。
- 已有主库时，在主库「设置」中导入；没有主库时，可在创建界面选择「从备份文件恢复」并合并恢复。附加库不能导入。
- 导入预览显示新增、跳过和冲突数量。「合并导入」只添加不存在的库，保留已有本地库，不合并账号或更新已有库。「覆盖全部」需再次确认，以文件内容替换所有本地库；仅含附加库的文件也会移除主库。覆盖前先备份。
- 备份仍需各库对应的密码；修改密码后，旧备份仍需旧密码。安全保存备份和密码，并在独立环境中用虚构数据验证恢复。

## 安全边界

- 新建库使用 PBKDF2-SHA-256（600,000 次迭代、随机 16 字节盐）派生 AES-256-GCM 密钥，每次加密使用随机 12 字节 IV。插件不将主密码写入 localStorage，但密文可被离线猜密；8 字符只是最低要求。
- localStorage 和备份并非全部密文：库数量、类型、ID、时间、KDF 参数、盐、IV 和密文长度等元数据可见。附加库不是安全沙箱，也不能隐藏库的存在。同源脚本、浏览器扩展、具有浏览器或系统访问权限的 agent、主机进程或恶意软件可能读取、修改或删除数据，或在输入和解锁时获取明文。不要让不受信任的 agent 或测试者访问含真实凭据的浏览器、会话或设备；使用不含真实秘密的独立环境。
- 解锁时明文和密钥存在页面内存及界面中。锁定不能保证擦除内存或剪贴板历史；复制密码后会尝试清空剪贴板，可能失败或覆盖后来复制的内容。
- 数据随浏览器和 origin 隔离；清除浏览器数据、更换浏览器或 origin 可能丢失数据。忘记密码无法恢复。备份需妥善保管，清除浏览器数据不会删除已导出的备份。本插件未声明经过独立安全审计，不应作为唯一凭据存储方案。
- 导入会拒绝未知版本或格式无效的记录；本地数据不可读时阻止覆盖。格式检查不能在没有密码时证明密文未被篡改或可解锁。localStorage 的跨键删除不是事务，失败时可能只删除一部分；删除前先备份。

## 验证与贡献

在本目录用已安装的 Node.js 和 npm 运行：

```sh
npm run check
npm test
npm pack --dry-run --offline --ignore-scripts
```

这些检查无需安装项目依赖或联网；CI 使用 Node 20、22、24。运行时测试使用合成数据，不覆盖完整 UI、加密安全性、真实浏览器备份恢复或 Harness 集成。通过检查不等于安全审计；Harness 和浏览器的版本兼容矩阵尚未建立或验证。

欢迎通过 [Issues](https://github.com/Veagau/dsh-account-vault/issues) 或 Pull Request 贡献，请勿提交真实凭据或备份。安全问题优先使用 [GitHub 私密漏洞报告](https://github.com/Veagau/dsh-account-vault/security)（如已启用）；否则先提交不含敏感细节的 Issue，请求私下联系方式。

## English

A local account and password memo for the DeepSeek Harness Web UI. Entries are encrypted in the browser and stored in localStorage for the page's origin. It supports multiple vaults and encrypted backups.

### Install

You need a Harness Web environment that supports bundles, plus localStorage and Web Crypto (usually HTTPS or localhost). Download or clone this directory, then invoke the Harness **`plugin_manager` tool**:

```json
{"action":"install_bundle","target":"<absolute path to the account-vault directory>"}
```

This is not a shell command. Escape Windows path backslashes as `\\` in JSON, or ask a Harness agent to install the local directory with the tool. Installation affects all sessions in the current profile. Check `application` and `warnings` in the result, follow the instructions, and refresh the page if needed. Once loaded, open **Account Vault** from the sidebar. The package remains private and does not need publishing to npm; whether source changes take effect depends on the build and installation environment, and refreshing does not necessarily rebuild the plugin.

### Use

1. On first use, create a main vault and acknowledge that a forgotten password cannot be recovered. The minimum is 8 characters; choose a stronger, unique master password.
2. Unlock it and select **Add account**. Name and password are required; username, website and notes are optional. You can search, edit and delete entries, and generate, reveal or copy passwords.
3. In **Settings**, change the current vault's master password, set the idle lock time or create an extra vault. The default is 5 minutes; choices are 1, 5, 15, 30 and 60 minutes. Leaving the panel also locks it. Only the main vault can create extra vaults; each vault has a different password.

### Backup and restore

- Export from an unlocked vault's **Settings**: a main-vault export contains all vaults, while an extra-vault export contains only that vault. Export does not remove local data.
- If a main vault exists, import from its **Settings**. If none exists, select **Restore from a backup file** on the creation screen to merge a backup. Imports are unavailable in extra vaults.
- The preview shows added, skipped and conflicting vaults. **Merge** adds only vaults not already present, keeping local copies; it does not merge entries or update existing vaults. **Replace all** requires confirmation and replaces every local vault with the file's contents; a file containing only an extra vault also removes the main vault. Back up first.
- Backups still require each vault's password. After a password change, older backups still require the old password. Protect backups and passwords, and verify restoration with fictional data in a separate environment.

### Security boundaries

- New vaults use PBKDF2-SHA-256 (600,000 iterations and a random 16-byte salt) to derive an AES-256-GCM key, with a random 12-byte IV for each encryption. The plugin does not write the master password to localStorage, but ciphertext can be attacked with offline password guessing; 8 characters is only a minimum.
- Local storage and backups are not entirely encrypted: metadata such as vault count, type, ID, timestamps, KDF parameters, salt, IV and ciphertext length is visible. Extra vaults are neither security sandboxes nor hidden vaults. Same-origin scripts, browser extensions, agents with browser or system access, host processes and malware may read, modify or delete data, or capture plaintext during entry and unlock. Do not give untrusted agents or testers access to a browser, session or device containing real credentials; use a separate environment without real secrets.
- Plaintext and keys are present in page memory and the UI while unlocked. Locking cannot guarantee erasure of memory or clipboard history. Clipboard clearing after copying a password is best effort and may fail or overwrite later clipboard contents.
- Data is isolated by browser and origin. Clearing browser data or changing browser or origin can lose it; forgotten passwords cannot be recovered. Protect backups: clearing browser data does not delete exported files. The plugin has not claimed an independent security audit and should not be your only credential store.
- Imports reject unknown versions and malformed records, and replacement is blocked if local data cannot be read. Format checks cannot establish that ciphertext is untampered or unlockable without its password. Deletion across localStorage keys is not transactional and may partially complete on failure; back up before deleting.

### Validation and contributing

From this directory, using installed Node.js and npm:

```sh
npm run check
npm test
npm pack --dry-run --offline --ignore-scripts
```

These checks need no project dependency installation or network access; CI uses Node 20, 22 and 24. Runtime tests use synthetic data and do not cover the complete UI, cryptographic security, real-browser backup and restore, or Harness integration. Passing checks is not a security audit; a Harness and browser version compatibility matrix has not been established or verified.

Contributions are welcome through [Issues](https://github.com/Veagau/dsh-account-vault/issues) or pull requests. Never submit real credentials or backups. For security issues, prefer [GitHub private vulnerability reporting](https://github.com/Veagau/dsh-account-vault/security) if enabled; otherwise open an Issue without sensitive details to request a private contact.

## 许可证 / License

[MIT](LICENSE) © 2026 contributors.
