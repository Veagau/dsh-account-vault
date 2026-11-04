# 账号保险库 / Account Vault

![Account Vault](docs/account-vault-cover.png)

[English](#english) · [截图](docs/screenshots.md) · [详细说明](docs/guide.md)

把常用账号和密码收在 DSH 里，需要时打开，不用时锁上。支持搜索、密码生成、多套保险库和加密备份，不提供云同步。

## 安装与使用

下载仓库后，让 DSH agent 用 `plugin_manager` 安装本地目录，或直接调用工具（不是终端命令）：

```json
{"action":"install_bundle","target":"<account-vault 目录的绝对路径>"}
```

需要支持 bundle 的 Harness，以及可用的 Web Crypto 和 localStorage（通常为 HTTPS 或 localhost）。安装影响当前 profile，按返回提示刷新后，从侧边栏打开「账号保险库」。Windows JSON 路径用 `\\` 表示反斜杠。

首次使用先创建主保险库，再添加账号。设置里可以调整自动锁定时间、修改密码、创建附加库；默认空闲 5 分钟或离开面板时锁定。

## 记得备份

- 主库导出全部库，附加库只导出自身；导入在主库或首次恢复界面操作。
- 合并只添加不存在的库，不合并账号；「覆盖全部」会替换所有本地库，先备份。
- 忘记主密码无法找回。旧备份仍需要导出时的密码。

## 安全提醒

账号内容用 PBKDF2-SHA-256 和 AES-256-GCM 加密，存于当前浏览器和来源的 localStorage，库数量等元数据仍可见。清除站点数据或换浏览器、地址可能丢失数据。

附加库不是安全沙箱。同源脚本、扩展或能访问设备的 agent 可能拿到解锁后的明文；锁定也不能保证擦除内存或剪贴板历史。请用强密码，不要让不可信程序接触真实凭据，也别把它当作唯一的密码保管方案。项目未经过独立安全审计。

## English

Keep everyday accounts and passwords inside DSH. Search entries, generate passwords, use separate vaults and export encrypted backups. No cloud sync.

### Install and use

Download the repository and ask a DSH agent to install its local directory with the `plugin_manager` tool (not a shell command):

```json
{"action":"install_bundle","target":"<absolute path to account-vault>"}
```

Requires a bundle-capable Harness, Web Crypto and localStorage, usually on HTTPS or localhost. Installation affects the current profile; follow the returned instructions and open **Account Vault** from the sidebar. Escape Windows path backslashes as `\\` in JSON.

Create a main vault, then add entries. Settings includes password changes, extra vaults and idle locking. The default is 5 minutes; leaving the panel also locks it.

### Backups and safety

- Main-vault exports contain all vaults; extra-vault exports contain only that vault. Import from the main vault or the initial restore screen.
- Merge adds missing vaults, not individual entries. **Replace all** replaces all local vaults; back up first.
- Forgotten passwords cannot be recovered. Older backups still need their original passwords.
- Entries use PBKDF2-SHA-256 and AES-256-GCM in browser-local storage; metadata remains visible. Clearing site data or changing browser or origin can lose data.
- Extra vaults are not security sandboxes. Same-origin scripts, extensions or agents with device access may capture unlocked data. Locking does not guarantee memory or clipboard erasure. Use strong passwords and keep another trusted backup. This project has not had an independent security audit.

[Full guide](docs/guide.md) · [Screenshots](docs/screenshots.md) · [Report an issue](https://github.com/Veagau/dsh-account-vault/issues)

## 开发 / Development

```sh
npm run check
npm test
```

回归测试不等于完整 UI 测试或安全审计。请勿在 Issue 中上传真实密码或备份。
Regression tests are not complete UI coverage or a security audit. Never attach real credentials or backups to issues.

[MIT](LICENSE)
