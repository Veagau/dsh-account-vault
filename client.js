/**
 * Account Vault — encrypted account/password memo for the DeepSeek Harness Web UI.
 *
 * Security model:
 *  - one master password per browser profile;
 *  - PBKDF2-SHA-256, 600 000 iterations, random 16-byte salt -> AES-256-GCM key;
 *  - the whole record list is encrypted as one AES-GCM payload with a fresh
 *    12-byte IV and an AAD tag on every save;
 *  - only the ciphertext record is persisted (localStorage), the derived
 *    CryptoKey never leaves component memory and is dropped on lock.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-account-vault',
  factory(require) {
    'use strict';

    const React = require('react');
    const h = React.createElement;
    const useState = React.useState;
    const useEffect = React.useEffect;
    const useRef = React.useRef;
    const useCallback = React.useCallback;

    const NS = 'dsh-account-vault';
    const PANEL_ID = 'account-vault';
    /* Storage holds a *file* of independent vaults: each one has its own salt and its
       own password, so one password opens the real set and another opens a decoy set. */
    const STORAGE_KEY = 'dsh.account-vault.v2';
    const LEGACY_KEY = 'dsh.account-vault.v1';
    const SETTINGS_KEY = 'dsh.account-vault.settings.v1';
    const SCHEMA = 'dsh.account-vault';
    const FILE_SCHEMA = 'dsh.account-vault-file';
    const VAULT_VERSION = 1;
    const FILE_VERSION = 2;
    const KDF_ITERATIONS = 600000;
    const KDF_MIN_ITERATIONS = 100000;
    const KDF_MAX_ITERATIONS = 2000000;
    const AAD = 'dsh-account-vault:v1';
    const CHECK = 'dsh-account-vault-check';
    const CLIPBOARD_CLEAR_MS = 30000;
    const REVEAL_MS = 20000;
    const AUTOLOCK_CHOICES = [1, 5, 15, 30, 60];
    const REVEAL_GLYPH = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';

    const EN = {
      'panel.title': 'Account Vault',
      'panel.subtitle': 'High-strength local encryption \u00b7 master password required',
      'panel.locked': 'Locked',
      'panel.unlocked': 'Unlocked',
      'action.lock': 'Lock',
      'action.unlock': 'Unlock',
      'action.add': 'Add account',
      'action.close': 'Close',
      'action.cancel': 'Cancel',
      'action.save': 'Save',
      'action.edit': 'Edit',
      'action.delete': 'Delete',
      'action.settings': 'Settings',
      'action.changePassword': 'Change master password',
      'action.export': 'Export backup',
      'action.import': 'Import backup',
      'action.reset': 'Delete vault',
      'action.resetAll': 'Delete every vault',
      'action.reveal': 'Show password',
      'action.hide': 'Hide password',
      'action.copyUsername': 'Copy username',
      'action.copyPassword': 'Copy password',
      'action.generate': 'Generate & fill',
      'action.retry': 'Try again',
      'vault.main': 'Main vault',
      'vault.aux': 'Extra vault',
      'vault.count': '{count} vaults on this device',
      'vault.section': 'Vaults & decoy password',
      'vault.current': 'Current vault',
      'vault.desc':
        'Each vault has its own password and encrypted data. This is not a security sandbox: anyone with browser, host or device access may access other vaults or capture secrets. Use a separate environment without real secrets for untrusted testers.',
      'vault.add': 'Add extra vault',
      'vault.addTitle': 'Create an extra vault',
      'vault.addDesc':
        'Give this vault its own master password. It starts empty and is encrypted separately; browser or device access is not isolated.',
      'vault.addSubmit': 'Create extra vault',
      'vault.delete': 'Delete this vault',
      'vault.deleteConfirm': 'Click again to confirm',
      'vault.lastOne': 'This is the only vault on this device.',
      'vault.added': 'Extra vault created \u2014 its own password opens it',
      'vault.deletedOk': 'Vault deleted',
      'vault.auxBackup':
        'This is an extra vault: imports are only allowed from the main vault, and an export here contains this vault alone.',
      'vault.auxReset':
        'Every-vault deletion is only allowed from the main vault. Use "Delete this vault" above to remove this extra vault.',
      'vault.auxAddHint':
        'An extra vault cannot create further vaults. Enter the main vault with the main password to add one.',
      'create.title': 'Create encrypted vault',
      'create.desc':
        'Choose a master password. Everything you store is encrypted locally with it, and the password itself is never saved.',
      'create.password': 'Master password',
      'create.confirm': 'Confirm master password',
      'create.ack': 'I understand that a forgotten master password cannot be recovered.',
      'create.submit': 'Create vault',
      'create.mismatch': 'The two passwords do not match.',
      'create.tooShort': 'Use at least 8 characters.',
      'create.ackRequired': 'Please confirm the recovery warning.',
      'unlock.title': 'Unlock your vault',
      'unlock.desc':
        'Enter a master password. Every vault on this device has its own password and opens its own set of accounts.',
      'unlock.multiHint': '{count} vaults on this device \u2014 each password opens only its own set.',
      'unlock.placeholder': 'Master password',
      'unlock.submit': 'Unlock',
      'unlock.busy': 'Decrypting\u2026',
      'unlock.hint': 'The key is derived in this tab only and is wiped when you lock or leave the panel.',
      'list.count': '{count} saved accounts',
      'list.countFiltered': '{shown} of {total} accounts match',
      'list.empty': 'No accounts yet',
      'list.emptyDesc': 'Add your first account — it is encrypted before it touches browser storage.',
      'list.search': 'Search name, username, site or note',
      'list.searchEmpty': 'No matching accounts',
      'list.searchEmptyDesc': 'Try another name, username, site or note.',
      'list.footnote': 'Auto-locks after {n} minutes of inactivity and whenever you leave this panel.',
      'entry.untitled': 'Untitled',
      'entry.noUsername': 'No username',
      'entry.addTitle': 'New account',
      'entry.editTitle': 'Edit account',
      'entry.name': 'Name / service',
      'entry.namePlaceholder': 'e.g. GitHub',
      'entry.username': 'Username / email',
      'entry.usernamePlaceholder': 'you@example.com',
      'entry.password': 'Password',
      'entry.passwordPlaceholder': 'Enter or generate a password',
      'entry.url': 'Website',
      'entry.urlPlaceholder': 'https://\u2026',
      'entry.notes': 'Notes',
      'entry.notesPlaceholder': 'Recovery codes, security questions, \u2026',
      'entry.nameRequired': 'A name is required.',
      'entry.passwordRequired': 'A password is required.',
      'entry.generator': 'Password generator',
      'entry.length': 'Length',
      'entry.lower': 'a-z',
      'entry.upper': 'A-Z',
      'entry.digits': '0-9',
      'entry.symbols': '!@#$',
      'entry.deleteTitle': 'Delete this account?',
      'entry.deleteDesc': '"{name}" will be removed from the encrypted vault. This cannot be undone.',
      'password.title': 'Change master password',
      'password.desc': 'The vault is re-encrypted with the new password, and the old one stops working immediately.',
      'password.current': 'Current master password',
      'password.next': 'New master password',
      'password.confirm': 'Confirm new master password',
      'password.err': 'The current master password is incorrect.',
      'password.mismatch': 'The new passwords do not match.',
      'password.tooShort': 'Use at least 8 characters.',
      'password.success': 'Master password updated.',
      'settings.title': 'Vault settings',
      'settings.autolock': 'Auto-lock after inactivity',
      'settings.minutes': '{n} min',
      'settings.data': 'Data',
      'settings.entries': 'Saved accounts',
      'settings.created': 'Created',
      'settings.crypto': 'Encryption',
      'settings.cryptoDetail': 'PBKDF2-SHA-256 \u00b7 600,000 iterations \u2192 AES-256-GCM',
      'settings.storage': 'Storage',
      'settings.storageDetail': 'Browser localStorage, ciphertext only',
      'settings.backup': 'Backup',
      'settings.backupDesc':
        'Backups stay encrypted and still need the matching master password. A main-vault export contains every vault on this device; an extra-vault export contains only that vault.',
      'settings.resetDesc': 'Removes every encrypted vault from this browser. Exported backups are unaffected.',
      'settings.resetConfirm': 'Click again to confirm deletion',
      'toast.copied': 'Copied',
      'toast.copiedUsername': 'Username copied',
      'toast.passwordCopied': 'Password copied \u00b7 clipboard clears in 30 s',
      'toast.saved': 'Saved',
      'toast.deleted': 'Deleted',
      'toast.created': 'Vault created',
      'toast.exported': 'Encrypted backup exported',
      'toast.exportedAux': 'Extra vault exported on its own (main vault not included)',
      'toast.imported': 'Backup imported \u2014 unlock it with its master password',
      'toast.importedMerged':
        'Import merged: {added} vault(s) added, {skipped} already here (nothing deleted)',
      'toast.reset': 'Vault deleted',
      'toast.restored': 'Restored {added} vault(s) from the file (this device now holds {total}) \u2014 unlock each with its own password.',
      'toast.restoredNone': 'That file adds no new vault here.',
      'restore.action': 'Restore from a backup file\u2026',
      'restore.hint':
        'No main vault was found on this device. You can merge vaults back from a ciphertext backup; each still needs its own master password.',
      'err.wrongPassword': 'Wrong master password. Try again.',
      'err.saveFailed': 'Could not save the encrypted vault.',
      'err.copyFailed': 'Clipboard is unavailable in this browser.',
      'err.cryptoUnavailable': 'Web Crypto is unavailable. Open the Harness over HTTPS or localhost.',
      'err.storageUnavailable': 'Browser storage is unavailable, so the vault cannot be saved.',
      'err.importInvalid': 'That file is not a valid account vault backup.',
      'err.passwordInUse':
        'This password already opens another vault here. Pick a different password, otherwise it would unlock the wrong vault.',
      'import.title': 'Import a backup file',
      'import.summary': 'The file holds {count} vault(s); this device currently stores {current}.',
      'import.added': 'Merge would add {added} vault(s) and skip {skipped} that are already here.',
      'import.conflicts':
        '{count} vault(s) in the file match a local vault but carry different content; the local copy was kept.',
      'import.nothingNew': 'Every vault in this file is already on this device, so merging changes nothing.',
      'import.merge': 'Merge (add only)',
      'import.replace': 'Replace all',
      'import.replaceConfirm': 'Click again to replace everything',
      'import.replaceWarn':
        'Merge never deletes a local vault. Replace all wipes this device first and restores exactly what the file contains \u2014 use it only to roll back.',
      'err.generic': 'Something went wrong.',
      'strength.weak': 'Weak',
      'strength.medium': 'Medium',
      'strength.strong': 'Strong',
      'strength.excellent': 'Excellent',
      'strength.hint': 'Mix upper and lower case, digits and symbols.',
    };

    const ZH = {
      'panel.title': '\u8d26\u53f7\u4fdd\u9669\u5e93',
      'panel.subtitle': '\u672c\u5730\u9ad8\u5f3a\u5ea6\u52a0\u5bc6 \u00b7 \u9700\u8981\u4e3b\u5bc6\u7801\u89e3\u9501',
      'panel.locked': '\u5df2\u9501\u5b9a',
      'panel.unlocked': '\u5df2\u89e3\u9501',
      'action.lock': '\u9501\u5b9a',
      'action.unlock': '\u89e3\u9501',
      'action.add': '\u6dfb\u52a0\u8d26\u53f7',
      'action.close': '\u5173\u95ed',
      'action.cancel': '\u53d6\u6d88',
      'action.save': '\u4fdd\u5b58',
      'action.edit': '\u7f16\u8f91',
      'action.delete': '\u5220\u9664',
      'action.settings': '\u8bbe\u7f6e',
      'action.changePassword': '\u4fee\u6539\u4e3b\u5bc6\u7801',
      'action.export': '\u5bfc\u51fa\u5907\u4efd',
      'action.import': '\u5bfc\u5165\u5907\u4efd',
      'action.reset': '\u5220\u9664\u4fdd\u9669\u5e93',
      'action.resetAll': '\u5220\u9664\u5168\u90e8\u4fdd\u9669\u5e93',
      'action.reveal': '\u663e\u793a\u5bc6\u7801',
      'action.hide': '\u9690\u85cf\u5bc6\u7801',
      'action.copyUsername': '\u590d\u5236\u8d26\u53f7',
      'action.copyPassword': '\u590d\u5236\u5bc6\u7801',
      'action.generate': '\u751f\u6210\u5e76\u586b\u5165',
      'action.retry': '\u91cd\u8bd5',
      'vault.main': '\u4e3b\u4fdd\u9669\u5e93',
      'vault.aux': '\u9644\u52a0\u4fdd\u9669\u5e93',
      'vault.count': '\u672c\u673a\u5171 {count} \u5957\u4fdd\u9669\u5e93',
      'vault.section': '\u4fdd\u9669\u5e93\u4e0e\u6697\u95e8\u5bc6\u7801',
      'vault.current': '\u5f53\u524d\u4fdd\u9669\u5e93',
      'vault.desc':
        '每套保险库使用独立密码和密文，但并非安全沙箱：能访问浏览器、主机或设备者可能访问其他库或获取明文。请为不受信任的测试者使用不含真实凭据的独立环境。',
      'vault.add': '\u65b0\u5efa\u9644\u52a0\u4fdd\u9669\u5e93',
      'vault.addTitle': '\u65b0\u5efa\u9644\u52a0\u4fdd\u9669\u5e93',
      'vault.addDesc':
        '为这套保险库设置独立密码。它初始为空并独立加密；浏览器或设备访问权限并未隔离。',
      'vault.addSubmit': '\u521b\u5efa\u9644\u52a0\u4fdd\u9669\u5e93',
      'vault.delete': '\u5220\u9664\u8fd9\u5957\u4fdd\u9669\u5e93',
      'vault.deleteConfirm': '\u518d\u6b21\u70b9\u51fb\u786e\u8ba4\u5220\u9664',
      'vault.lastOne': '\u672c\u673a\u53ea\u5269\u8fd9\u4e00\u5957\u4fdd\u9669\u5e93\u3002',
      'vault.added': '\u9644\u52a0\u4fdd\u9669\u5e93\u5df2\u521b\u5efa\uff0c\u8f93\u5165\u5b83\u81ea\u5df1\u7684\u4e3b\u5bc6\u7801\u5373\u53ef\u8fdb\u5165',
      'vault.deletedOk': '\u4fdd\u9669\u5e93\u5df2\u5220\u9664',
      'create.title': '\u521b\u5efa\u52a0\u5bc6\u4fdd\u9669\u5e93',
      'create.desc':
        '\u8bbe\u7f6e\u4e00\u4e2a\u4e3b\u5bc6\u7801\u3002\u4f60\u5b58\u5165\u7684\u6240\u6709\u5185\u5bb9\u90fd\u7528\u5b83\u5728\u672c\u5730\u52a0\u5bc6\uff0c\u4e3b\u5bc6\u7801\u672c\u8eab\u4e0d\u4f1a\u88ab\u4fdd\u5b58\u3002',
      'create.password': '\u4e3b\u5bc6\u7801',
      'create.confirm': '\u786e\u8ba4\u4e3b\u5bc6\u7801',
      'create.ack': '\u6211\u5df2\u4e86\u89e3\uff1a\u4e3b\u5bc6\u7801\u4e00\u65e6\u9057\u5fd8\uff0c\u6570\u636e\u5c06\u65e0\u6cd5\u6062\u590d\u3002',
      'create.submit': '\u521b\u5efa\u4fdd\u9669\u5e93',
      'create.mismatch': '\u4e24\u6b21\u8f93\u5165\u7684\u4e3b\u5bc6\u7801\u4e0d\u4e00\u81f4\u3002',
      'create.tooShort': '\u4e3b\u5bc6\u7801\u81f3\u5c11\u9700\u8981 8 \u4e2a\u5b57\u7b26\u3002',
      'create.ackRequired': '\u8bf7\u5148\u786e\u8ba4\u65e0\u6cd5\u6062\u590d\u7684\u98ce\u9669\u63d0\u793a\u3002',
      'unlock.title': '\u8f93\u5165\u4e3b\u5bc6\u7801\u89e3\u9501',
      'unlock.desc':
        '\u8f93\u5165\u4efb\u610f\u4e00\u5957\u4fdd\u9669\u5e93\u7684\u4e3b\u5bc6\u7801\uff1b\u672c\u673a\u6bcf\u5957\u4fdd\u9669\u5e93\u90fd\u6709\u81ea\u5df1\u7684\u5bc6\u7801\u548c\u72ec\u7acb\u8d26\u672c\u3002',
      'unlock.multiHint':
        '\u672c\u673a\u6709 {count} \u5957\u4fdd\u9669\u5e93\uff0c\u6bcf\u4e2a\u5bc6\u7801\u53ea\u6253\u5f00\u5b83\u81ea\u5df1\u90a3\u4e00\u5957\u3002',
      'unlock.placeholder': '\u4e3b\u5bc6\u7801',
      'unlock.submit': '\u89e3\u9501',
      'unlock.busy': '\u6b63\u5728\u89e3\u5bc6\u2026',
      'unlock.hint': '\u5bc6\u94a5\u4ec5\u5728\u672c\u9875\u9762\u4e2d\u6d3e\u751f\uff0c\u9501\u5b9a\u6216\u79bb\u5f00\u9762\u677f\u65f6\u7acb\u5373\u6e05\u9664\u3002',
      'list.count': '{count} \u6761\u8d26\u53f7\u8bb0\u5f55',
      'list.countFiltered': '\u7b5b\u9009\u51fa {shown} \u6761 / \u5171 {total} \u6761',
      'list.empty': '\u8fd8\u6ca1\u6709\u8bb0\u5f55',
      'list.emptyDesc': '\u6dfb\u52a0\u7b2c\u4e00\u6761\u8d26\u53f7\uff0c\u5b83\u4f1a\u5148\u52a0\u5bc6\u518d\u5199\u5165\u6d4f\u89c8\u5668\u5b58\u50a8\u3002',
      'list.search': '\u641c\u7d22\u540d\u79f0\u3001\u8d26\u53f7\u3001\u7f51\u5740\u6216\u5907\u6ce8',
      'list.searchEmpty': '\u6ca1\u6709\u5339\u914d\u7684\u8bb0\u5f55',
      'list.searchEmptyDesc': '\u8bd5\u8bd5\u5176\u4ed6\u540d\u79f0\u3001\u8d26\u53f7\u3001\u7f51\u5740\u6216\u5907\u6ce8\u3002',
      'list.footnote': '\u7a7a\u95f2 {n} \u5206\u949f\u540e\u81ea\u52a8\u9501\u5b9a\uff0c\u79bb\u5f00\u672c\u9762\u677f\u65f6\u4e5f\u4f1a\u9501\u5b9a\u3002',
      'entry.untitled': '\u672a\u547d\u540d',
      'entry.noUsername': '\u672a\u586b\u5199\u8d26\u53f7',
      'entry.addTitle': '\u65b0\u5efa\u8d26\u53f7',
      'entry.editTitle': '\u7f16\u8f91\u8d26\u53f7',
      'entry.name': '\u540d\u79f0 / \u670d\u52a1',
      'entry.namePlaceholder': '\u4f8b\u5982 GitHub',
      'entry.username': '\u8d26\u53f7 / \u90ae\u7bb1',
      'entry.usernamePlaceholder': 'you@example.com',
      'entry.password': '\u5bc6\u7801',
      'entry.passwordPlaceholder': '\u8f93\u5165\u6216\u751f\u6210\u5bc6\u7801',
      'entry.url': '\u7f51\u5740',
      'entry.urlPlaceholder': 'https://\u2026',
      'entry.notes': '\u5907\u6ce8',
      'entry.notesPlaceholder': '\u6062\u590d\u7801\u3001\u5bc6\u4fdd\u95ee\u9898\u7b49\u2026',
      'entry.nameRequired': '\u8bf7\u586b\u5199\u540d\u79f0\u3002',
      'entry.passwordRequired': '\u8bf7\u586b\u5199\u5bc6\u7801\u3002',
      'entry.generator': '\u5bc6\u7801\u751f\u6210\u5668',
      'entry.length': '\u957f\u5ea6',
      'entry.lower': 'a-z',
      'entry.upper': 'A-Z',
      'entry.digits': '0-9',
      'entry.symbols': '!@#$',
      'entry.deleteTitle': '\u5220\u9664\u8fd9\u6761\u8d26\u53f7\uff1f',
      'entry.deleteDesc': '"{name}" \u5c06\u4ece\u52a0\u5bc6\u4fdd\u9669\u5e93\u4e2d\u5220\u9664\uff0c\u4e14\u65e0\u6cd5\u6062\u590d\u3002',
      'password.title': '\u4fee\u6539\u4e3b\u5bc6\u7801',
      'password.desc': '\u4fdd\u9669\u5e93\u4f1a\u7528\u65b0\u4e3b\u5bc6\u7801\u91cd\u65b0\u52a0\u5bc6\uff0c\u65e7\u4e3b\u5bc6\u7801\u7acb\u5373\u5931\u6548\u3002',
      'password.current': '\u5f53\u524d\u4e3b\u5bc6\u7801',
      'password.next': '\u65b0\u4e3b\u5bc6\u7801',
      'password.confirm': '\u786e\u8ba4\u65b0\u4e3b\u5bc6\u7801',
      'password.err': '\u5f53\u524d\u4e3b\u5bc6\u7801\u4e0d\u6b63\u786e\u3002',
      'password.mismatch': '\u4e24\u6b21\u8f93\u5165\u7684\u65b0\u5bc6\u7801\u4e0d\u4e00\u81f4\u3002',
      'password.tooShort': '\u4e3b\u5bc6\u7801\u81f3\u5c11\u9700\u8981 8 \u4e2a\u5b57\u7b26\u3002',
      'password.success': '\u4e3b\u5bc6\u7801\u5df2\u66f4\u65b0\u3002',
      'settings.title': '\u4fdd\u9669\u5e93\u8bbe\u7f6e',
      'settings.autolock': '\u7a7a\u95f2\u81ea\u52a8\u9501\u5b9a',
      'settings.minutes': '{n} \u5206\u949f',
      'settings.data': '\u6570\u636e',
      'settings.entries': '\u5df2\u4fdd\u5b58\u8d26\u53f7',
      'settings.created': '\u521b\u5efa\u65f6\u95f4',
      'settings.crypto': '\u52a0\u5bc6\u65b9\u5f0f',
      'settings.cryptoDetail': 'PBKDF2-SHA-256 \u00b7 600,000 \u6b21\u8fed\u4ee3 \u2192 AES-256-GCM',
      'settings.storage': '\u5b58\u50a8\u4f4d\u7f6e',
      'settings.storageDetail': '\u6d4f\u89c8\u5668 localStorage\uff0c\u4ec5\u4fdd\u5b58\u5bc6\u6587',
      'settings.backup': '\u5907\u4efd',
      'settings.backupDesc': '\u5bfc\u51fa\u7684\u662f\u5bc6\u6587\uff1b\u4e3b\u4fdd\u9669\u5e93\u5bfc\u51fa\u5305\u542b\u5168\u90e8\u4fdd\u9669\u5e93\uff0c\u9644\u52a0\u4fdd\u9669\u5e93\u5bfc\u51fa\u53ea\u5305\u542b\u5b83\u81ea\u5df1\uff1b\u6062\u590d\u65f6\u4ecd\u9700\u5bf9\u5e94\u4e3b\u5bc6\u7801\u3002',
      'settings.resetDesc': '\u4ece\u5f53\u524d\u6d4f\u89c8\u5668\u4e2d\u5220\u9664\u5168\u90e8\u4fdd\u9669\u5e93\uff0c\u4e0d\u5f71\u54cd\u5df2\u5bfc\u51fa\u7684\u5907\u4efd\u3002',
      'settings.resetConfirm': '\u518d\u6b21\u70b9\u51fb\u786e\u8ba4\u5220\u9664',
      'toast.copied': '\u5df2\u590d\u5236',
      'toast.copiedUsername': '\u8d26\u53f7\u5df2\u590d\u5236',
      'toast.passwordCopied': '\u5bc6\u7801\u5df2\u590d\u5236 \u00b7 30 \u79d2\u540e\u81ea\u52a8\u6e05\u7a7a\u526a\u8d34\u677f',
      'toast.saved': '\u5df2\u4fdd\u5b58',
      'toast.deleted': '\u5df2\u5220\u9664',
      'toast.created': '\u4fdd\u9669\u5e93\u5df2\u521b\u5efa',
      'toast.exported': '\u5bc6\u6587\u5907\u4efd\u5df2\u5bfc\u51fa',
      'toast.exportedAux': '\u9644\u52a0\u4fdd\u9669\u5e93\u5df2\u5355\u72ec\u5bfc\u51fa\uff08\u4e0d\u5305\u542b\u4e3b\u4fdd\u9669\u5e93\uff09',
      'toast.imported': '\u5907\u4efd\u5df2\u5bfc\u5165 \u2014 \u8bf7\u7528\u5176\u4e3b\u5bc6\u7801\u89e3\u9501',
      'toast.importedMerged': '\u5df2\u5408\u5e76\u5bfc\u5165\uff1a\u65b0\u589e {added} \u5957\uff0c{skipped} \u5957\u5df2\u5b58\u5728\uff08\u672a\u5220\u9664\u4efb\u4f55\u4fdd\u9669\u5e93\uff09',
      'toast.reset': '\u4fdd\u9669\u5e93\u5df2\u5220\u9664',
      'toast.restored': '\u5df2\u4ece\u6587\u4ef6\u6062\u590d {added} \u5957\u4fdd\u9669\u5e93\uff08\u672c\u673a\u5171 {total} \u5957\uff09\uff0c\u8bf7\u7528\u5404\u81ea\u4e3b\u5bc6\u7801\u89e3\u9501\u3002',
      'toast.restoredNone': '\u8be5\u6587\u4ef6\u91cc\u6ca1\u6709\u65b0\u7684\u4fdd\u9669\u5e93\u53ef\u6062\u590d\u3002',
      'restore.action': '\u4ece\u5907\u4efd\u6587\u4ef6\u6062\u590d\u2026',
      'restore.hint':
        '\u672c\u673a\u6ca1\u6709\u4e3b\u4fdd\u9669\u5e93\u3002\u53ef\u4ee5\u4ece\u5bc6\u6587\u5907\u4efd\u6062\u590d\u4fdd\u9669\u5e93\uff0c\u6062\u590d\u540e\u4ecd\u9700\u7528\u5404\u81ea\u4e3b\u5bc6\u7801\u89e3\u9501\u3002',
      'err.wrongPassword': '\u4e3b\u5bc6\u7801\u9519\u8bef\uff0c\u8bf7\u91cd\u8bd5\u3002',
      'err.saveFailed': '\u65e0\u6cd5\u4fdd\u5b58\u52a0\u5bc6\u4fdd\u9669\u5e93\u3002',
      'err.copyFailed': '\u5f53\u524d\u6d4f\u89c8\u5668\u65e0\u6cd5\u4f7f\u7528\u526a\u8d34\u677f\u3002',
      'err.cryptoUnavailable': '\u5f53\u524d\u73af\u5883\u65e0\u6cd5\u4f7f\u7528 Web Crypto\uff0c\u8bf7\u901a\u8fc7 HTTPS \u6216 localhost \u6253\u5f00\u3002',
      'err.storageUnavailable': '\u6d4f\u89c8\u5668\u5b58\u50a8\u4e0d\u53ef\u7528\uff0c\u65e0\u6cd5\u4fdd\u5b58\u4fdd\u9669\u5e93\u3002',
      'err.importInvalid': '\u8be5\u6587\u4ef6\u4e0d\u662f\u6709\u6548\u7684\u4fdd\u9669\u5e93\u5907\u4efd\u3002',
      'err.generic': '\u64cd\u4f5c\u5931\u8d25\uff0c\u8bf7\u91cd\u8bd5\u3002',
      'strength.weak': '\u5f31',
      'strength.medium': '\u4e2d\u7b49',
      'strength.strong': '\u5f3a',
      'strength.excellent': '\u5f88\u5f3a',
      'strength.hint': '\u5efa\u8bae\u6df7\u5408\u5927\u5c0f\u5199\u5b57\u6bcd\u3001\u6570\u5b57\u548c\u7b26\u53f7\u3002',
      'vault.auxBackup':
        '\u8fd9\u662f\u9644\u52a0\u4fdd\u9669\u5e93\uff1a\u5bfc\u5165\u5907\u4efd\u53ea\u80fd\u5728\u4e3b\u4fdd\u9669\u5e93\u4e2d\u64cd\u4f5c\uff1b\u8fd9\u91cc\u5bfc\u51fa\u7684\u6587\u4ef6\u4e5f\u53ea\u5305\u542b\u5f53\u524d\u8fd9\u5957\u9644\u52a0\u4fdd\u9669\u5e93\u3002',
      'vault.auxReset':
        '\u5220\u9664\u5168\u90e8\u4fdd\u9669\u5e93\u53ea\u5141\u8bb8\u5728\u4e3b\u4fdd\u9669\u5e93\u4e2d\u64cd\u4f5c\uff1b\u8981\u5220\u9664\u5f53\u524d\u8fd9\u5957\u9644\u52a0\u4fdd\u9669\u5e93\uff0c\u8bf7\u4f7f\u7528\u4e0a\u9762\u7684\u201c\u5220\u9664\u8fd9\u5957\u4fdd\u9669\u5e93\u201d\u3002',
      'vault.auxAddHint': '\u9644\u52a0\u4fdd\u9669\u5e93\u4e0d\u80fd\u65b0\u5efa\u4fdd\u9669\u5e93\uff1b\u9700\u8981\u65b0\u5efa\u8bf7\u7528\u4e3b\u5bc6\u7801\u8fdb\u5165\u4e3b\u4fdd\u9669\u5e93\u540e\u64cd\u4f5c\u3002',
      'err.passwordInUse':
        '\u8fd9\u4e2a\u5bc6\u7801\u5df2\u7ecf\u80fd\u6253\u5f00\u672c\u673a\u7684\u53e6\u4e00\u5957\u4fdd\u9669\u5e93\u3002\u8bf7\u6362\u4e00\u4e2a\u4e0d\u540c\u7684\u5bc6\u7801\uff0c\u5426\u5219\u5b83\u4f1a\u89e3\u9501\u5230\u9519\u8bef\u7684\u90a3\u4e00\u5957\u3002',
      'import.title': '\u5bfc\u5165\u5907\u4efd\u6587\u4ef6',
      'import.summary': '\u8be5\u6587\u4ef6\u5305\u542b {count} \u5957\u4fdd\u9669\u5e93\uff0c\u672c\u673a\u73b0\u6709 {current} \u5957\u3002',
      'import.added': '\u5408\u5e76\u4f1a\u65b0\u589e {added} \u5957\uff0c\u8df3\u8fc7 {skipped} \u5957\u672c\u673a\u5df2\u6709\u7684\u3002',
      'import.conflicts': '{count} \u5957\u4fdd\u9669\u5e93\u5728\u672c\u673a\u5df2\u5b58\u5728\u4f46\u5185\u5bb9\u4e0d\u540c\uff0c\u5df2\u4fdd\u7559\u672c\u673a\u7248\u672c\u3002',
      'import.nothingNew': '\u6587\u4ef6\u91cc\u7684\u4fdd\u9669\u5e93\u672c\u673a\u90fd\u5df2\u5b58\u5728\uff0c\u5408\u5e76\u4e0d\u4f1a\u6539\u53d8\u4efb\u4f55\u6570\u636e\u3002',
      'import.merge': '\u5408\u5e76\u5bfc\u5165\uff08\u53ea\u65b0\u589e\uff09',
      'import.replace': '\u8986\u76d6\u5168\u90e8',
      'import.replaceConfirm': '\u518d\u6b21\u70b9\u51fb\u786e\u8ba4\u8986\u76d6\u5168\u90e8',
      'import.replaceWarn': '\u5408\u5e76\u4e0d\u4f1a\u5220\u9664\u4efb\u4f55\u672c\u673a\u4fdd\u9669\u5e93\uff1b\u300c\u8986\u76d6\u5168\u90e8\u300d\u4f1a\u5148\u6e05\u7a7a\u672c\u673a\u518d\u6309\u6587\u4ef6\u6062\u590d\uff0c\u53ea\u5efa\u8bae\u7528\u4e8e\u56de\u6eda\u3002',
    };

    const CSS = [
      /* The harness alias token --dsw-alias-brand-primary is a *contrast* colour
         (near-black in the light theme, near-white in the dark theme), so it must
         never be used as a filled-button background. Define our own accent. */
      ':root{--dsh-av-accent:#3574f0;--dsh-av-accent-strong:#2a63d8;--dsh-av-accent-soft:rgba(53,116,240,.14);--dsh-av-accent-ring:rgba(53,116,240,.26);--dsh-av-accent-ink:#ffffff}',
      /* The harness themes here are translucent (a wallpaper plugin paints behind every
         panel), and --dsw-alias-bg-base can resolve fully transparent, which left the
         panel chrome as black text on blurred dark wallpaper. Composite the layer-1
         surface twice so the panel always paints a theme-correct surface of its own. */
      '.dsh-av-root{display:flex;flex-direction:column;height:100%;min-height:0;background-color:var(--dsw-alias-bg-layer-1);background-image:linear-gradient(var(--dsw-alias-bg-layer-1),var(--dsw-alias-bg-layer-1));backdrop-filter:blur(20px) saturate(120%);-webkit-backdrop-filter:blur(20px) saturate(120%);color:var(--dsw-alias-label-primary);font-size:14px;line-height:1.45}',
      '.dsh-av-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:18px 28px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-wrap:wrap}',
      '.dsh-av-head-main{display:flex;flex-direction:column;gap:5px;min-width:0}',
      '.dsh-av-title-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dsh-av-logo{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;color:var(--dsh-av-accent);background:var(--dsh-av-accent-soft)}',
      '.dsh-av-title{margin:0;font-size:17px;font-weight:600;letter-spacing:.01em}',
      '.dsh-av-sub{margin:0;font-size:12.5px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-badge{font-size:11.5px;line-height:1;padding:4px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}',
      '.dsh-av-badge--on{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-success-primary) 35%,transparent)}',
      '.dsh-av-head-actions{display:flex;align-items:center;gap:8px}',
      '.dsh-av-body{flex:1;min-height:0;overflow-y:auto}',
      '.dsh-av-column{max-width:900px;margin:0 auto;padding:22px 28px 56px;display:flex;flex-direction:column;gap:16px}',
      '.dsh-av-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .12s ease,border-color .12s ease,opacity .12s ease}',
      '.dsh-av-btn:hover:not(:disabled){background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l2)}',
      '.dsh-av-btn:disabled{opacity:.5;cursor:not-allowed}',
      '.dsh-av-btn--primary{background:var(--dsh-av-accent);border-color:transparent;color:var(--dsh-av-accent-ink)}',
      '.dsh-av-btn--primary:hover:not(:disabled){background:var(--dsh-av-accent-strong);border-color:transparent}',
      '.dsh-av-btn--ghost{background:transparent;border-color:transparent;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-btn--ghost:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-color:transparent}',
      '.dsh-av-btn--danger{background:transparent;border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 40%,transparent);color:var(--dsw-alias-state-error-primary)}',
      '.dsh-av-btn--danger:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,transparent);border-color:var(--dsw-alias-state-error-primary)}',
      '.dsh-av-btn--block{width:100%;height:38px;font-size:13.5px}',
      '.dsh-av-iconbtn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;padding:0;border-radius:7px;border:1px solid transparent;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;transition:background .12s ease,color .12s ease}',
      '.dsh-av-iconbtn:hover{background:var(--dsw-alias-bg-layer-2);border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}',
      '.dsh-av-iconbtn--danger:hover{color:var(--dsw-alias-state-error-primary)}',
      '.dsh-av-iconbtn svg{display:block}',
      '.dsh-av-field{display:flex;flex-direction:column;gap:6px;min-width:0}',
      '.dsh-av-label{font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-hint{font-size:12px;color:var(--dsw-alias-label-secondary);margin:0}',
      '.dsh-av-input{width:100%;height:36px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13.5px;outline:none;box-sizing:border-box;transition:border-color .12s ease,box-shadow .12s ease}',
      '.dsh-av-input::placeholder{color:var(--dsw-alias-state-idle-primary)}',
      '.dsh-av-input:focus{border-color:var(--dsh-av-accent);box-shadow:0 0 0 3px var(--dsh-av-accent-ring)}',
      'textarea.dsh-av-input{height:auto;min-height:74px;padding:9px 12px;resize:vertical;font-family:inherit}',
      '.dsh-av-input-wrap{position:relative;display:flex;align-items:center}',
      '.dsh-av-input-wrap .dsh-av-input{padding-right:40px}',
      '.dsh-av-input-btn{position:absolute;right:4px;display:inline-flex;align-items:center;justify-content:center;width:30px;height:28px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsh-av-input-btn:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}',
      '.dsh-av-center{display:flex;justify-content:center;padding:24px 0 40px}',
      '.dsh-av-card{width:100%;max-width:430px;display:flex;flex-direction:column;gap:14px;padding:24px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);box-sizing:border-box}',
      '.dsh-av-card-icon{display:inline-flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:13px;color:var(--dsh-av-accent);background:var(--dsh-av-accent-soft)}',
      '.dsh-av-card-title{margin:0;font-size:16.5px;font-weight:600}',
      '.dsh-av-card-desc{margin:0;font-size:13px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-restore{display:flex;flex-direction:column;align-items:flex-start;gap:6px;margin-top:4px;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.dsh-av-check{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;color:var(--dsw-alias-label-secondary);cursor:pointer;line-height:1.5}',
      '.dsh-av-check input{margin:2px 0 0;accent-color:var(--dsh-av-accent);flex:none}',
      '.dsh-av-banner{display:flex;align-items:flex-start;gap:8px;padding:9px 12px;border-radius:9px;font-size:12.5px;border:1px solid transparent}',
      '.dsh-av-banner--error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 9%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-error-primary) 28%,transparent)}',
      '.dsh-av-banner--warn{color:var(--dsw-alias-state-warn-primary);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 9%,transparent);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 28%,transparent)}',
      '.dsh-av-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dsh-av-search{position:relative;display:flex;align-items:center;flex:1;min-width:180px;max-width:340px}',
      '.dsh-av-search svg{position:absolute;left:10px;color:var(--dsw-alias-label-secondary);pointer-events:none}',
      '.dsh-av-search .dsh-av-input{padding-left:32px}',
      '.dsh-av-spacer{flex:1}',
      '.dsh-av-count{font-size:12.5px;color:var(--dsw-alias-label-secondary);margin:0}',
      '.dsh-av-list{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}',
      '.dsh-av-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-top:1px solid var(--dsw-alias-border-l1);min-width:0}',
      '.dsh-av-row:first-child{border-top:0}',
      '.dsh-av-row:hover{background:var(--dsw-alias-bg-layer-2)}',
      '.dsh-av-avatar{display:flex;align-items:center;justify-content:center;width:34px;height:34px;flex:none;border-radius:10px;font-size:14px;font-weight:600;color:var(--dsh-av-accent);background:var(--dsh-av-accent-soft)}',
      '.dsh-av-row-main{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}',
      '.dsh-av-row-title{font-size:13.5px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh-av-row-sub{font-size:12px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh-av-secret{flex:0 1 200px;min-width:0;display:flex;justify-content:flex-end;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px;color:var(--dsw-alias-label-secondary);overflow:hidden}',
      '.dsh-av-code{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}',
      '.dsh-av-dots{letter-spacing:1px}',
      '.dsh-av-row-actions{display:flex;align-items:center;gap:1px;flex:none}',
      '.dsh-av-empty{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;padding:52px 24px;border:1px dashed var(--dsw-alias-border-l2);border-radius:14px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-empty-icon{color:var(--dsw-alias-state-idle-primary)}',
      '.dsh-av-empty-title{margin:0;font-size:14.5px;font-weight:600;color:var(--dsw-alias-label-primary)}',
      '.dsh-av-empty-desc{margin:0;font-size:12.5px;max-width:340px}',
      '.dsh-av-footnote{margin:0;font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-backdrop{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.46);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
      '.dsh-av-modal{display:flex;flex-direction:column;width:100%;max-width:520px;max-height:86vh;border:1px solid var(--dsw-alias-border-l1);border-radius:15px;background:var(--dsw-alias-bg-overlay);backdrop-filter:blur(26px) saturate(120%);-webkit-backdrop-filter:blur(26px) saturate(120%);box-shadow:0 24px 64px rgba(0,0,0,.4);overflow:hidden}',
      '.dsh-av-modal--narrow{max-width:430px}',
      '.dsh-av-modal-head{display:flex;align-items:flex-start;gap:12px;padding:18px 20px 14px;border-bottom:1px solid var(--dsw-alias-border-l1)}',
      '.dsh-av-modal-titles{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}',
      '.dsh-av-modal-title{margin:0;font-size:15.5px;font-weight:600}',
      '.dsh-av-modal-sub{margin:0;font-size:12.5px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-modal-body{display:flex;flex-direction:column;gap:14px;padding:18px 20px;overflow-y:auto;min-height:0}',
      '.dsh-av-modal-foot{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:14px 20px;border-top:1px solid var(--dsw-alias-border-l1)}',
      '.dsh-av-divider{height:1px;background:var(--dsw-alias-border-l1);margin:2px 0}',
      '.dsh-av-section-title{margin:0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-kv{display:flex;align-items:baseline;justify-content:space-between;gap:16px;font-size:12.5px}',
      '.dsh-av-kv span:first-child{color:var(--dsw-alias-label-secondary);flex:none}',
      '.dsh-av-kv span:last-child{text-align:right;min-width:0}',
      '.dsh-av-inline{display:flex;gap:8px}',
      '.dsh-av-inline>.dsh-av-btn{flex:none}',
      '.dsh-av-strength{display:flex;flex-direction:column;gap:5px}',
      '.dsh-av-strength-bar{display:flex;gap:4px;height:4px}',
      '.dsh-av-strength-seg{flex:1;border-radius:999px;background:var(--dsw-alias-bg-layer-2)}',
      '.dsh-av-strength-meta{display:flex;justify-content:space-between;font-size:11.5px;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-gen{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-layer-2)}',
      '.dsh-av-gen-head{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:500;color:var(--dsw-alias-label-secondary)}',
      '.dsh-av-gen-row{display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:12.5px}',
      '.dsh-av-gen-row .dsh-av-input{width:74px;height:30px;text-align:center}',
      '.dsh-av-gen-opt{display:inline-flex;align-items:center;gap:5px;color:var(--dsw-alias-label-secondary);cursor:pointer}',
      '.dsh-av-gen-opt input{accent-color:var(--dsh-av-accent);margin:0}',
      '.dsh-av-select{height:32px;padding:0 28px 0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;outline:none;cursor:pointer}',
      '.dsh-av-select:focus{border-color:var(--dsh-av-accent)}',
      '.dsh-av-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:90;max-width:min(92vw,520px);padding:9px 14px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-overlay);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);color:var(--dsw-alias-label-primary);font-size:12.5px;box-shadow:0 12px 32px rgba(0,0,0,.28)}',
      '.dsh-av-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dsh-av-badge--warn{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 40%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-warn-primary) 10%,transparent)}',
      '.dsh-av-vault-list{display:flex;flex-direction:column;gap:6px}',
      '.dsh-av-vault-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);font-size:12.5px}',
      '.dsh-av-vault-row--active{border-color:color-mix(in srgb,var(--dsh-av-accent) 42%,transparent);background:var(--dsh-av-accent-soft)}',
      '.dsh-av-vault-name{font-weight:500;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dsh-av-form{display:flex;flex-direction:column;gap:13px}',
      '.dsh-av-form .dsh-av-card-title{font-size:14.5px;margin:0}',
      '.dsh-av-form .dsh-av-card-desc{margin:0}',
      '@media (max-width:720px){.dsh-av-head{padding:14px 16px}.dsh-av-column{padding:16px 16px 40px}.dsh-av-secret{display:none}.dsh-av-modal{max-height:92vh}}',
    ].join('\n');

    /* ------------------------------------------------------------------ */
    /* Crypto                                                             */
    /* ------------------------------------------------------------------ */

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    function webCrypto() {
      try {
        return typeof window !== 'undefined' && window.crypto && window.crypto.subtle ? window.crypto : null;
      } catch (err) {
        return null;
      }
    }

    function toBase64(bytes) {
      const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let binary = '';
      const step = 0x8000;
      for (let i = 0; i < view.length; i += step) {
        binary += String.fromCharCode.apply(null, view.subarray(i, i + step));
      }
      return window.btoa(binary);
    }

    function fromBase64(value) {
      const binary = window.atob(String(value));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }

    function randomBytes(length) {
      const bytes = new Uint8Array(length);
      window.crypto.getRandomValues(bytes);
      return bytes;
    }

    /** Unbiased random integer in [0, max). */
    function randomInt(max) {
      const limit = Math.floor(0x100000000 / max) * max;
      const buffer = new Uint32Array(1);
      for (;;) {
        window.crypto.getRandomValues(buffer);
        if (buffer[0] < limit) return buffer[0] % max;
      }
    }

    async function deriveKey(password, salt, iterations) {
      const subtle = webCrypto().subtle;
      const material = await subtle.importKey(
        'raw',
        textEncoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey'],
      );
      return subtle.deriveKey(
        { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
        material,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
      );
    }

    async function encryptPayload(key, payload) {
      const subtle = webCrypto().subtle;
      const iv = randomBytes(12);
      const cipher = await subtle.encrypt(
        { name: 'AES-GCM', iv: iv, additionalData: textEncoder.encode(AAD) },
        key,
        textEncoder.encode(JSON.stringify(payload)),
      );
      return { iv: toBase64(iv), ct: toBase64(cipher) };
    }

    async function decryptPayload(key, cipher) {
      const subtle = webCrypto().subtle;
      const plain = await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: fromBase64(cipher.iv),
          additionalData: textEncoder.encode(AAD),
        },
        key,
        fromBase64(cipher.ct),
      );
      return JSON.parse(textDecoder.decode(plain));
    }

    function isCipher(value) {
      return !!value && typeof value.iv === 'string' && typeof value.ct === 'string';
    }

    function validateRecord(record) {
      if (!record || record.schema !== SCHEMA) return null;
      if (!record.kdf || typeof record.kdf.salt !== 'string' || !isCipher(record.cipher)) return null;
      const iterations = Number(record.kdf.iterations);
      if (!Number.isFinite(iterations) || iterations < KDF_MIN_ITERATIONS) return null;
      if (iterations > KDF_MAX_ITERATIONS) return null;
      return record;
    }

    function parseRecord(raw) {
      if (!raw) return null;
      let record;
      try {
        record = JSON.parse(raw);
      } catch (err) {
        return null;
      }
      return validateRecord(record);
    }

    /* Accepts both the v2 file (many independent vaults) and a bare v1 record. */
    function parseVaultFile(raw) {
      if (!raw) return null;
      let data;
      try {
        data = JSON.parse(raw);
      } catch (err) {
        return null;
      }
      if (data && data.schema === FILE_SCHEMA && Array.isArray(data.vaults)) {
        const vaults = [];
        data.vaults.forEach(function (item) {
          const record = validateRecord(item);
          if (record) vaults.push(record);
        });
        return vaults.length
          ? { schema: FILE_SCHEMA, version: FILE_VERSION, vaults: vaults }
          : null;
      }
      const single = validateRecord(data);
      if (single) return { schema: FILE_SCHEMA, version: FILE_VERSION, vaults: [single] };
      return null;
    }

    /* ------------------------------------------------------------------ */
    /* Storage                                                            */
    /* ------------------------------------------------------------------ */

    function storageAvailable() {
      try {
        const probe = '__dsh_av_probe__';
        window.localStorage.setItem(probe, '1');
        window.localStorage.removeItem(probe);
        return true;
      } catch (err) {
        return false;
      }
    }

    function readFileRaw() {
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch (err) {
        return null;
      }
    }

    function writeFileRaw(raw) {
      window.localStorage.setItem(STORAGE_KEY, raw);
    }

    function clearFileRaw() {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (err) {
        /* storage may be unavailable; nothing to clear */
      }
    }

    function readLegacyRaw() {
      try {
        return window.localStorage.getItem(LEGACY_KEY);
      } catch (err) {
        return null;
      }
    }

    function clearLegacyRaw() {
      try {
        window.localStorage.removeItem(LEGACY_KEY);
      } catch (err) {
        /* nothing to clear */
      }
    }

    /* Load the vault file, migrating a single-vault v1 record in place (no password needed)
       and giving every record a stable id, so a later backup import can be merged safely. */
    function loadVaultFile() {
      const file = parseVaultFile(readFileRaw());
      if (file) {
        const vaults = ensureVaultIds(file.vaults);
        const changed = vaults.some(function (item, i) {
          return item !== file.vaults[i];
        });
        if (changed) {
          try {
            saveVaultFile(vaults);
          } catch (err) {
            /* read-only storage: the ids stay in memory for this session */
          }
        }
        return { schema: FILE_SCHEMA, version: FILE_VERSION, vaults: vaults };
      }
      const legacy = parseRecord(readLegacyRaw());
      if (legacy) {
        const migrated = {
          schema: FILE_SCHEMA,
          version: FILE_VERSION,
          vaults: ensureVaultIds([legacy]),
        };
        try {
          writeFileRaw(JSON.stringify(migrated));
          clearLegacyRaw();
        } catch (err) {
          /* read-only storage: fall back to the in-memory view */
        }
        return migrated;
      }
      return null;
    }

    function saveVaultFile(vaults) {
      writeFileRaw(JSON.stringify({ schema: FILE_SCHEMA, version: FILE_VERSION, vaults: vaults }));
    }

    function clearSettingsRaw() {
      try {
        window.localStorage.removeItem(SETTINGS_KEY);
      } catch (err) {
        /* storage may be unavailable; nothing to clear */
      }
    }

    function loadSettings() {
      const fallback = { autoLockMinutes: 5 };
      try {
        const parsed = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) || 'null');
        if (!parsed || typeof parsed !== 'object') return fallback;
        const minutes = Number(parsed.autoLockMinutes);
        return {
          autoLockMinutes:
            AUTOLOCK_CHOICES.indexOf(minutes) >= 0 ? minutes : fallback.autoLockMinutes,
        };
      } catch (err) {
        return fallback;
      }
    }

    function saveSettings(settings) {
      try {
        window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch (err) {
        /* preference is cosmetic; keep the in-memory value */
      }
    }

    /* ------------------------------------------------------------------ */
    /* Small helpers                                                      */
    /* ------------------------------------------------------------------ */

    function localeOf(ctx) {
      try {
        return ctx && ctx.get ? ctx.get('locale') : null;
      } catch (err) {
        return null;
      }
    }

    function activeLanguage(ctx) {
      try {
        const locale = localeOf(ctx);
        const snapshot = locale && locale.getLocale ? locale.getLocale() : null;
        const id = snapshot && snapshot.active ? String(snapshot.active) : '';
        if (id) return id.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
      } catch (err) {
        /* fall through to the browser language */
      }
      try {
        return String(navigator.language || '').toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en';
      } catch (err) {
        return 'en';
      }
    }

    function translate(ctx, key, vars) {
      let text;
      const locale = localeOf(ctx);
      if (locale && typeof locale.bind === 'function') {
        try {
          const bound = locale.bind(NS);
          const value = bound(key);
          if (typeof value === 'string' && value && value !== key) text = value;
        } catch (err) {
          text = undefined;
        }
      }
      if (text === undefined) {
        const table = activeLanguage(ctx) === 'zh' ? ZH : EN;
        text = Object.prototype.hasOwnProperty.call(table, key) ? table[key] : EN[key];
      }
      if (text === undefined) return key;
      if (vars) {
        text = text.replace(/\{(\w+)\}/g, function (match, name) {
          return vars[name] === undefined ? match : String(vars[name]);
        });
      }
      return text;
    }

    function uid() {
      const bytes = randomBytes(9);
      let out = '';
      for (let i = 0; i < bytes.length; i += 1) out += bytes[i].toString(16).padStart(2, '0');
      return out;
    }

    function isBlank(value) {
      return !value || !String(value).trim();
    }

    function strengthOf(password) {
      const value = String(password || '');
      let pool = 0;
      if (/[a-z]/.test(value)) pool += 26;
      if (/[A-Z]/.test(value)) pool += 26;
      if (/[0-9]/.test(value)) pool += 10;
      if (/[^A-Za-z0-9]/.test(value)) pool += 33;
      const bits = value ? value.length * Math.log2(pool || 1) : 0;
      const level = bits >= 110 ? 4 : bits >= 76 ? 3 : bits >= 52 ? 2 : bits >= 30 ? 1 : 0;
      return { bits: Math.round(bits), level: level };
    }

    const LOWER = 'abcdefghijkmnopqrstuvwxyz';
    const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const DIGITS = '23456789';
    const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?';

    function generatePassword(options) {
      const opts = options || {};
      const length = Math.max(8, Math.min(64, Number(opts.length) || 20));
      let pools = [];
      if (opts.lower !== false) pools.push(LOWER);
      if (opts.upper !== false) pools.push(UPPER);
      if (opts.digits !== false) pools.push(DIGITS);
      if (opts.symbols !== false) pools.push(SYMBOLS);
      if (!pools.length) pools = [LOWER, UPPER, DIGITS];
      const chars = [];
      pools.forEach(function (pool) {
        chars.push(pool.charAt(randomInt(pool.length)));
      });
      const all = pools.join('');
      while (chars.length < length) chars.push(all.charAt(randomInt(all.length)));
      for (let i = chars.length - 1; i > 0; i -= 1) {
        const j = randomInt(i + 1);
        const swap = chars[i];
        chars[i] = chars[j];
        chars[j] = swap;
      }
      return chars.join('');
    }

    function formatDate(value) {
      if (!value) return '\u2014';
      try {
        return new Date(value).toLocaleString();
      } catch (err) {
        return String(value);
      }
    }

    function matchesSearch(entry, query) {
      if (!query) return true;
      const needle = query.toLowerCase();
      return ['name', 'username', 'url', 'notes'].some(function (field) {
        return String(entry[field] || '').toLowerCase().indexOf(needle) >= 0;
      });
    }

    /* Every vault carries a plaintext label; records saved before labels existed fall back to
       "the first one is the main vault". */
    function vaultLabelOf(item, index) {
      if (item && item.label === 'aux') return translate(Bridge.ctx, 'vault.aux');
      if (item && item.label === 'main') return translate(Bridge.ctx, 'vault.main');
      return index === 0 ? translate(Bridge.ctx, 'vault.main') : translate(Bridge.ctx, 'vault.aux');
    }

    function vaultKindOf(item, index) {
      if (item && item.label === 'aux') return 'aux';
      if (item && item.label === 'main') return 'main';
      return index === 0 ? 'main' : 'aux';
    }

    /* A vault keeps a stable plaintext id so backups can be merged without guessing which
       ciphertext is "the same vault". Records written before ids existed are identified by
       their ciphertext fingerprint instead, which is also what a duplicated copy looks like. */
    function vaultFingerprint(record) {
      if (record && isCipher(record.cipher)) return 'sig:' + record.cipher.iv + record.cipher.ct;
      return '';
    }

    /* Both identities count: the id for vaults that went through 2.1 writers, and the
       ciphertext fingerprint for records written before ids existed (v1/v2.0 backups) or
       whose ciphertext is identical on another device. Testing only one of them would make
       a re-imported old backup look like a brand new vault every time. */
    function vaultKeys(record) {
      const keys = [];
      if (record && typeof record.id === 'string' && record.id) keys.push('id:' + record.id);
      const fingerprint = vaultFingerprint(record);
      if (fingerprint) keys.push(fingerprint);
      if (!keys.length) keys.push('sig:missing');
      return keys;
    }

    function vaultIdentity(record) {
      return vaultKeys(record)[0];
    }

    function withVaultId(record) {
      if (!record) return record;
      if (typeof record.id === 'string' && record.id) return record;
      return Object.assign({}, record, { id: uid() });
    }

    /* Every record ends up with a unique non-empty id; a repeated id inside one file gets a
       fresh one instead of silently persisting two records under the same identity. */
    function ensureVaultIds(vaults) {
      const used = Object.create(null);
      return (vaults || []).map(function (record) {
        const existing =
          record && typeof record.id === 'string' && record.id ? record.id : '';
        const id = existing && !used[existing] ? existing : uid();
        used[id] = true;
        if (existing === id) return record;
        return Object.assign({}, record, { id: id });
      });
    }

    /* Additive import: keep every local vault, append only records this device has never seen.
       Returns the records that would be added and the count that is already present. */
    function mergeVaults(current, incoming) {
      const seen = Object.create(null);
      const localFingerprints = Object.create(null);
      (current || []).forEach(function (item) {
        vaultKeys(item).forEach(function (key) {
          seen[key] = true;
        });
        const fingerprint = vaultFingerprint(item);
        if (item && typeof item.id === 'string' && item.id && fingerprint) {
          localFingerprints['id:' + item.id] = fingerprint;
        }
      });
      const added = [];
      let skipped = 0;
      let conflicts = 0;
      (incoming || []).forEach(function (item) {
        const keys = vaultKeys(item);
        const duplicate = keys.some(function (key) {
          return seen[key] === true;
        });
        if (duplicate) {
          skipped += 1;
          const idKey =
            item && typeof item.id === 'string' && item.id ? 'id:' + item.id : '';
          const fingerprint = vaultFingerprint(item);
          if (idKey && fingerprint && localFingerprints[idKey] && localFingerprints[idKey] !== fingerprint) {
            conflicts += 1;
          }
          return;
        }
        keys.forEach(function (key) {
          seen[key] = true;
        });
        const fingerprint = vaultFingerprint(item);
        if (item && typeof item.id === 'string' && item.id && fingerprint) {
          localFingerprints['id:' + item.id] = fingerprint;
        }
        added.push(withVaultId(item));
      });
      return { added: added, skipped: skipped, conflicts: conflicts };
    }

    /* Does this password open any existing vault record? A fresh salt per vault means the
       derived key is different even for the same password, so the check has to re-derive
       against each record's own salt. Used to keep one password from opening two vaults,
       because unlock picks the first record that authenticates. */
    async function passwordOpensVault(password, record) {
      if (!record || !record.kdf || !isCipher(record.cipher)) return false;
      try {
        const key = await deriveKey(
          password,
          fromBase64(record.kdf.salt),
          Number(record.kdf.iterations) || KDF_ITERATIONS,
        );
        const payload = await decryptPayload(key, record.cipher);
        return !!(payload && Array.isArray(payload.entries));
      } catch (err) {
        return false;
      }
    }

    async function passwordOpensOtherVault(password, records, skipIndex) {
      for (let i = 0; i < records.length; i += 1) {
        if (i === skipIndex) continue;
        if (await passwordOpensVault(password, records[i])) return true;
      }
      return false;
    }

    /* ------------------------------------------------------------------ */
    /* Icons                                                              */
    /* ------------------------------------------------------------------ */

    function svg(paths, size, extra) {
      const props = {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.7,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
        focusable: 'false',
        style: { display: 'block' },
      };
      if (extra) Object.keys(extra).forEach(function (key) { props[key] = extra[key]; });
      return h('svg', props, paths.map(function (path, index) { return h(path[0], Object.assign({ key: 'p' + index }, path[1])); }));
    }

    function shieldIcon(size) {
      return svg([
        ['path', { d: 'M12 3.2l7 2.7v5.2c0 4.9-2.9 8.7-7 10.4-4.1-1.7-7-5.5-7-10.4V5.9l7-2.7z' }],
        ['circle', { cx: 12, cy: 11.4, r: 1.7 }],
        ['path', { d: 'M12 13.1v3.1' }],
      ], size || 18);
    }

    function lockIcon(size) {
      return svg([
        ['rect', { x: 4.8, y: 10.4, width: 14.4, height: 9.8, rx: 2.3 }],
        ['path', { d: 'M8.4 10.4V7.8a3.6 3.6 0 0 1 7.2 0v2.6' }],
      ], size || 18);
    }

    function unlockIcon(size) {
      return svg([
        ['rect', { x: 4.8, y: 10.4, width: 14.4, height: 9.8, rx: 2.3 }],
        ['path', { d: 'M8.4 10.4V7.8a3.6 3.6 0 0 1 6.9-1.4' }],
      ], size || 18);
    }

    function plusIcon(size) {
      return svg([['path', { d: 'M12 5.5v13M5.5 12h13' }]], size || 16);
    }

    function searchIcon(size) {
      return svg([
        ['circle', { cx: 11, cy: 11, r: 6.2 }],
        ['path', { d: 'M15.6 15.6L20 20' }],
      ], size || 16);
    }

    function copyIcon(size) {
      return svg([
        ['rect', { x: 9, y: 9, width: 10.5, height: 10.5, rx: 2 }],
        ['path', { d: 'M15 6.6A1.9 1.9 0 0 0 13.1 4.7H6.8A2.1 2.1 0 0 0 4.7 6.8v6.3c0 1 .8 1.9 1.9 1.9' }],
      ], size || 15);
    }

    function eyeIcon(size) {
      return svg([
        ['path', { d: 'M2.8 12S6.3 6 12 6s9.2 6 9.2 6-3.5 6-9.2 6-9.2-6-9.2-6z' }],
        ['circle', { cx: 12, cy: 12, r: 2.6 }],
      ], size || 15);
    }

    function eyeOffIcon(size) {
      return svg([
        ['path', { d: 'M4.4 4.4l15.2 15.2' }],
        ['path', { d: 'M9.6 6.5A9.8 9.8 0 0 1 12 6.3c5.7 0 9.2 5.7 9.2 5.7a16 16 0 0 1-3.2 3.5' }],
        ['path', { d: 'M6.4 8.1A15.6 15.6 0 0 0 2.8 12s3.5 5.7 9.2 5.7c1.2 0 2.3-.2 3.3-.7' }],
      ], size || 15);
    }

    function editIcon(size) {
      return svg([
        ['path', { d: 'M15.3 5.2l3.5 3.5' }],
        ['path', { d: 'M4.8 19.2l.9-4.2L16.4 4.3a1.9 1.9 0 0 1 2.7 0l.6.6a1.9 1.9 0 0 1 0 2.7L9 18.3l-4.2.9z' }],
      ], size || 15);
    }

    function trashIcon(size) {
      return svg([
        ['path', { d: 'M4.8 7h14.4' }],
        ['path', { d: 'M9.4 7V5.2A1.2 1.2 0 0 1 10.6 4h2.8a1.2 1.2 0 0 1 1.2 1.2V7' }],
        ['path', { d: 'M6.6 7l.8 11.1A1.9 1.9 0 0 0 9.3 20h5.4a1.9 1.9 0 0 0 1.9-1.9L17.4 7' }],
        ['path', { d: 'M10.4 11v5M13.6 11v5' }],
      ], size || 15);
    }

    function settingsIcon(size) {
      return svg([
        ['circle', { cx: 12, cy: 12, r: 3 }],
        ['path', { d: 'M12 3.4v2.2M12 18.4v2.2M4.9 7.9l1.9 1.1M17.2 15l1.9 1.1M4.9 16.1l1.9-1.1M17.2 9l1.9-1.1' }],
      ], size || 16);
    }

    function keyIcon(size) {
      return svg([
        ['circle', { cx: 8.2, cy: 15.8, r: 3.4 }],
        ['path', { d: 'M10.8 13.2L19 5M15.4 8.6l2.4 2.4M17.9 6.1l2.4 2.4' }],
      ], size || 16);
    }

    function downloadIcon(size) {
      return svg([
        ['path', { d: 'M12 4.5v10' }],
        ['path', { d: 'M8.2 10.9L12 14.7l3.8-3.8' }],
        ['path', { d: 'M5 17.5v1.3h14v-1.3' }],
      ], size || 16);
    }

    function uploadIcon(size) {
      return svg([
        ['path', { d: 'M12 14.8v-10' }],
        ['path', { d: 'M8.2 8.5L12 4.7l3.8 3.8' }],
        ['path', { d: 'M5 17.5v1.3h14v-1.3' }],
      ], size || 16);
    }

    function closeIcon(size) {
      return svg([['path', { d: 'M6 6l12 12M18 6L6 18' }]], size || 15);
    }

    function alertIcon(size) {
      return svg([
        ['path', { d: 'M12 4.5l8.4 14.3H3.6L12 4.5z' }],
        ['path', { d: 'M12 10v3.6M12 16.4v.1' }],
      ], size || 16);
    }

    /* ------------------------------------------------------------------ */
    /* Shared UI pieces                                                   */
    /* ------------------------------------------------------------------ */

    function T(key, vars) {
      return translate(Bridge.ctx, key, vars);
    }

    function Modal(props) {
      const title = props.title;
      const onClose = props.onClose;
      useEffect(
        function () {
          function onKey(event) {
            if (event.key === 'Escape') {
              event.stopPropagation();
              onClose();
            }
          }
          window.addEventListener('keydown', onKey, true);
          return function () {
            window.removeEventListener('keydown', onKey, true);
          };
        },
        [onClose],
      );
      return h(
        'div',
        {
          className: 'dsh-av-backdrop',
          onMouseDown: function (event) {
            if (event.target === event.currentTarget) onClose();
          },
        },
        h(
          'div',
          {
            className: 'dsh-av-modal' + (props.narrow ? ' dsh-av-modal--narrow' : ''),
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': typeof title === 'string' ? title : undefined,
          },
          h(
            'div',
            { className: 'dsh-av-modal-head' },
            h(
              'div',
              { className: 'dsh-av-modal-titles' },
              h('h3', { className: 'dsh-av-modal-title' }, title),
              props.subtitle ? h('p', { className: 'dsh-av-modal-sub' }, props.subtitle) : null,
            ),
            h(
              'button',
              {
                type: 'button',
                className: 'dsh-av-iconbtn',
                onClick: onClose,
                'aria-label': T('action.close'),
                title: T('action.close'),
              },
              closeIcon(15),
            ),
          ),
          h('div', { className: 'dsh-av-modal-body' }, props.children),
          props.footer ? h('div', { className: 'dsh-av-modal-foot' }, props.footer) : null,
        ),
      );
    }

    function Banner(props) {
      return h(
        'div',
        { className: 'dsh-av-banner dsh-av-banner--' + (props.tone || 'error'), role: 'alert' },
        alertIcon(16),
        h('span', null, props.children),
      );
    }

    function Field(props) {
      return h(
        'div',
        { className: 'dsh-av-field' },
        props.label ? h('label', { className: 'dsh-av-label', htmlFor: props.id }, props.label) : null,
        props.children,
      );
    }

    function SecretInput(props) {
      const [visible, setVisible] = useState(false);
      const inputRef = useRef(null);
      useEffect(
        function () {
          if (props.autoFocus && inputRef.current) inputRef.current.focus();
        },
        [props.autoFocus],
      );
      return h(
        'div',
        { className: 'dsh-av-input-wrap' },
        h('input', {
          ref: inputRef,
          id: props.id,
          className: 'dsh-av-input',
          type: visible ? 'text' : 'password',
          value: props.value,
          placeholder: props.placeholder,
          autoComplete: props.autoComplete || 'off',
          spellCheck: false,
          'aria-label': props.ariaLabel || props.placeholder,
          onChange: function (event) {
            props.onChange(event.target.value);
          },
          onKeyDown: function (event) {
            if (event.key === 'Enter' && props.onEnter) {
              event.preventDefault();
              props.onEnter();
            }
          },
        }),
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-av-input-btn',
            onClick: function () {
              setVisible(!visible);
            },
            'aria-label': visible ? T('action.hide') : T('action.reveal'),
            title: visible ? T('action.hide') : T('action.reveal'),
          },
          visible ? eyeOffIcon(15) : eyeIcon(15),
        ),
      );
    }

    function StrengthMeter(props) {
      const info = strengthOf(props.password);
      const color =
        info.level >= 3
          ? 'var(--dsw-alias-state-success-primary)'
          : info.level === 2
            ? 'var(--dsw-alias-state-warn-primary)'
            : 'var(--dsw-alias-state-error-primary)';
      const labels = ['strength.weak', 'strength.weak', 'strength.medium', 'strength.strong', 'strength.excellent'];
      return h(
        'div',
        { className: 'dsh-av-strength' },
        h(
          'div',
          { className: 'dsh-av-strength-bar' },
          [0, 1, 2, 3].map(function (index) {
            return h('span', {
              key: index,
              className: 'dsh-av-strength-seg',
              style: index < info.level ? { background: color } : undefined,
            });
          }),
        ),
        h(
          'div',
          { className: 'dsh-av-strength-meta' },
          h('span', null, T(labels[info.level])),
          h('span', null, info.bits ? '~' + info.bits + ' bit' : T('strength.hint')),
        ),
      );
    }

    function GeneratorBox(props) {
      const [length, setLength] = useState(20);
      const [lower, setLower] = useState(true);
      const [upper, setUpper] = useState(true);
      const [digits, setDigits] = useState(true);
      const [symbols, setSymbols] = useState(true);
      function generate() {
        props.onGenerate(
          generatePassword({ length: length, lower: lower, upper: upper, digits: digits, symbols: symbols }),
        );
      }
      return h(
        'div',
        { className: 'dsh-av-gen' },
        h(
          'div',
          { className: 'dsh-av-gen-head' },
          h('span', null, T('entry.generator')),
          h(
            'button',
            { type: 'button', className: 'dsh-av-btn', onClick: generate },
            keyIcon(14),
            T('action.generate'),
          ),
        ),
        h(
          'div',
          { className: 'dsh-av-gen-row' },
          h('label', { className: 'dsh-av-gen-opt', htmlFor: 'dsh-av-gen-length' }, T('entry.length')),
          h('input', {
            id: 'dsh-av-gen-length',
            className: 'dsh-av-input',
            type: 'number',
            min: 8,
            max: 64,
            value: length,
            onChange: function (event) {
              const next = Number(event.target.value);
              setLength(Number.isFinite(next) ? Math.max(8, Math.min(64, next)) : 20);
            },
          }),
          h(
            'label',
            { className: 'dsh-av-gen-opt' },
            h('input', { type: 'checkbox', checked: lower, onChange: function (e) { setLower(e.target.checked); } }),
            T('entry.lower'),
          ),
          h(
            'label',
            { className: 'dsh-av-gen-opt' },
            h('input', { type: 'checkbox', checked: upper, onChange: function (e) { setUpper(e.target.checked); } }),
            T('entry.upper'),
          ),
          h(
            'label',
            { className: 'dsh-av-gen-opt' },
            h('input', { type: 'checkbox', checked: digits, onChange: function (e) { setDigits(e.target.checked); } }),
            T('entry.digits'),
          ),
          h(
            'label',
            { className: 'dsh-av-gen-opt' },
            h('input', { type: 'checkbox', checked: symbols, onChange: function (e) { setSymbols(e.target.checked); } }),
            T('entry.symbols'),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Create / unlock                                                    */
    /* ------------------------------------------------------------------ */

    function CreateVault(props) {
      const [password, setPassword] = useState('');
      const [confirm, setConfirm] = useState('');
      const [ack, setAck] = useState(false);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const plain = !!props.plain;

      function submit() {
        if (busy) return;
        if (password.length < 8) return setError(T('create.tooShort'));
        if (password !== confirm) return setError(T('create.mismatch'));
        if (!ack) return setError(T('create.ackRequired'));
        setError('');
        setBusy(true);
        Promise.resolve(props.onSubmit(password))
          .catch(function (err) {
            setError(err && err.message ? err.message : T('err.generic'));
          })
          .then(function () {
            setBusy(false);
          });
      }

      const body = h(
        'div',
        { className: plain ? 'dsh-av-form' : 'dsh-av-card' },
        plain ? null : h('span', { className: 'dsh-av-card-icon' }, shieldIcon(24)),
        h('h2', { className: 'dsh-av-card-title' }, props.title || T('create.title')),
        h('p', { className: 'dsh-av-card-desc' }, props.desc || T('create.desc')),
        h(
          Field,
          { label: T('create.password'), id: 'dsh-av-create-password' },
          h(SecretInput, {
            id: 'dsh-av-create-password',
            value: password,
            onChange: setPassword,
            placeholder: T('create.password'),
            autoFocus: true,
            onEnter: submit,
          }),
        ),
        password ? h(StrengthMeter, { password: password }) : null,
        h(
          Field,
          { label: T('create.confirm'), id: 'dsh-av-create-confirm' },
          h(SecretInput, {
            id: 'dsh-av-create-confirm',
            value: confirm,
            onChange: setConfirm,
            placeholder: T('create.confirm'),
            onEnter: submit,
          }),
        ),
        h(
          'label',
          { className: 'dsh-av-check' },
          h('input', {
            type: 'checkbox',
            checked: ack,
            onChange: function (event) {
              setAck(event.target.checked);
            },
          }),
          h('span', null, T('create.ack')),
        ),
        error ? h(Banner, null, error) : null,
        h(
          'button',
          {
            type: 'button',
            className: 'dsh-av-btn dsh-av-btn--primary dsh-av-btn--block',
            disabled: busy,
            onClick: submit,
          },
          busy ? T('unlock.busy') : props.submitLabel || T('create.submit'),
        ),
      );

      return plain ? body : h('div', { className: 'dsh-av-center' }, body);
    }

    function AttachVaultModal(props) {
      return h(
        Modal,
        {
          title: T('vault.addTitle'),
          onClose: props.onClose,
          footer: [
            h(
              'button',
              { key: 'c', type: 'button', className: 'dsh-av-btn', onClick: props.onClose },
              T('action.cancel'),
            ),
          ],
        },
        h(CreateVault, {
          plain: true,
          title: T('vault.addTitle'),
          desc: T('vault.addDesc'),
          submitLabel: T('vault.addSubmit'),
          onSubmit: props.onSubmit,
        }),
      );
    }

    function ImportConfirm(props) {
      const added = props.added || 0;
      const skipped = props.skipped || 0;
      const [confirmReplace, setConfirmReplace] = useState(false);
      return h(
        Modal,
        {
          title: T('import.title'),
          onClose: props.onClose,
          footer: [
            h(
              'button',
              { key: 'c', type: 'button', className: 'dsh-av-btn', onClick: props.onClose },
              T('action.cancel'),
            ),
            h(
              'button',
              {
                key: 'r',
                type: 'button',
                className: 'dsh-av-btn dsh-av-btn--danger',
                onClick: function () {
                  if (!confirmReplace) return setConfirmReplace(true);
                  props.onReplace();
                },
              },
              confirmReplace ? T('import.replaceConfirm') : T('import.replace'),
            ),
            h(
              'button',
              {
                key: 'm',
                type: 'button',
                className: 'dsh-av-btn dsh-av-btn--primary',
                disabled: added === 0,
                onClick: props.onMerge,
              },
              T('import.merge'),
            ),
          ],
        },
        h('p', { className: 'dsh-av-hint' }, T('import.summary', { count: props.count, current: props.current })),
        h('p', { className: 'dsh-av-hint' }, T('import.added', { added: added, skipped: skipped })),
        (props.conflicts || 0) > 0
          ? h('p', { className: 'dsh-av-hint' }, T('import.conflicts', { count: props.conflicts }))
          : null,
        added === 0 ? h('p', { className: 'dsh-av-hint' }, T('import.nothingNew')) : null,
        h('p', { className: 'dsh-av-hint' }, T('import.replaceWarn')),
      );
    }

    function UnlockVault(props) {
      const [password, setPassword] = useState('');
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [confirmReset, setConfirmReset] = useState(false);
      const restoreInput = useRef(null);

      function submit() {
        if (busy) return;
        if (!password) return;
        setError('');
        setBusy(true);
        Promise.resolve(props.onUnlock(password))
          .then(function (ok) {
            if (!ok) {
              setError(T('err.wrongPassword'));
              setPassword('');
            }
          })
          .catch(function (err) {
            setError(err && err.message ? err.message : T('err.generic'));
          })
          .then(function () {
            setBusy(false);
          });
      }

      return h(
        'div',
        { className: 'dsh-av-center' },
        h(
          'div',
          { className: 'dsh-av-card' },
          h('span', { className: 'dsh-av-card-icon' }, lockIcon(24)),
          h('h2', { className: 'dsh-av-card-title' }, T('unlock.title')),
          h('p', { className: 'dsh-av-card-desc' }, T('unlock.desc')),
          props.vaultCount > 1
            ? h('p', { className: 'dsh-av-hint' }, T('unlock.multiHint', { count: props.vaultCount }))
            : null,
          h(
            Field,
            { label: T('create.password'), id: 'dsh-av-unlock-password' },
            h(SecretInput, {
              id: 'dsh-av-unlock-password',
              value: password,
              onChange: setPassword,
              placeholder: T('unlock.placeholder'),
              autoFocus: true,
              onEnter: submit,
            }),
          ),
          error ? h(Banner, null, error) : null,
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-btn dsh-av-btn--primary dsh-av-btn--block',
              disabled: busy || !password,
              onClick: submit,
            },
            busy ? T('unlock.busy') : T('unlock.submit'),
          ),
          h('p', { className: 'dsh-av-hint' }, T('unlock.hint')),
          props.onReset
            ? h(
                'div',
                { style: { display: 'flex', justifyContent: 'flex-end' } },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-av-btn dsh-av-btn--ghost',
                    onClick: function () {
                      if (!confirmReset) return setConfirmReset(true);
                      setConfirmReset(false);
                      props.onReset();
                    },
                  },
                  T(props.resetLabel || 'action.reset'),
                  confirmReset ? ' \u00b7 ' + T('settings.resetConfirm') : '',
                ),
              )
            : null,
          props.onRestore
            ? h(
                'div',
                { className: 'dsh-av-restore' },
                h('p', { className: 'dsh-av-hint' }, T('restore.hint')),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-av-btn dsh-av-btn--ghost',
                    onClick: function () {
                      if (restoreInput.current) restoreInput.current.click();
                    },
                  },
                  T('restore.action'),
                ),
                h('input', {
                  ref: restoreInput,
                  type: 'file',
                  accept: '.json,application/json',
                  style: { display: 'none' },
                  'aria-hidden': 'true',
                  onChange: function (event) {
                    const file = event.target.files && event.target.files[0];
                    event.target.value = '';
                    if (file) props.onRestore(file);
                  },
                }),
              )
            : null,
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* List                                                               */
    /* ------------------------------------------------------------------ */

    function EntryRow(props) {
      const entry = props.entry;
      const initial = String(entry.name || '').trim().charAt(0).toUpperCase() || '?';
      return h(
        'div',
        { className: 'dsh-av-row' },
        h('span', { className: 'dsh-av-avatar', 'aria-hidden': 'true' }, initial),
        h(
          'div',
          { className: 'dsh-av-row-main' },
          h('span', { className: 'dsh-av-row-title' }, entry.name || T('entry.untitled')),
          h('span', { className: 'dsh-av-row-sub' }, entry.username || T('entry.noUsername')),
        ),
        h(
          'div',
          { className: 'dsh-av-secret' },
          props.revealed
            ? h('span', { className: 'dsh-av-code', title: entry.password }, entry.password)
            : h('span', { className: 'dsh-av-dots' }, REVEAL_GLYPH),
        ),
        h(
          'div',
          { className: 'dsh-av-row-actions' },
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-iconbtn',
              title: T('action.copyUsername'),
              'aria-label': T('action.copyUsername'),
              onClick: function () {
                props.onCopy(entry.username || '', 'toast.copiedUsername');
              },
            },
            copyIcon(),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-iconbtn',
              title: props.revealed ? T('action.hide') : T('action.reveal'),
              'aria-label': props.revealed ? T('action.hide') : T('action.reveal'),
              onClick: function () {
                props.onReveal();
              },
            },
            props.revealed ? eyeOffIcon() : eyeIcon(),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-iconbtn',
              title: T('action.copyPassword'),
              'aria-label': T('action.copyPassword'),
              onClick: function () {
                props.onCopy(entry.password || '', 'toast.passwordCopied');
              },
            },
            keyIcon(),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-iconbtn',
              title: T('action.edit'),
              'aria-label': T('action.edit'),
              onClick: function () {
                props.onEdit();
              },
            },
            editIcon(),
          ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-iconbtn dsh-av-iconbtn--danger',
              title: T('action.delete'),
              'aria-label': T('action.delete'),
              onClick: function () {
                props.onDelete();
              },
            },
            trashIcon(),
          ),
        ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Modals                                                             */
    /* ------------------------------------------------------------------ */

    function EditorModal(props) {
      const source = props.entry || {};
      const [name, setName] = useState(source.name || '');
      const [username, setUsername] = useState(source.username || '');
      const [password, setPassword] = useState(source.password || '');
      const [url, setUrl] = useState(source.url || '');
      const [notes, setNotes] = useState(source.notes || '');
      const [error, setError] = useState('');
      const [showGenerator, setShowGenerator] = useState(!source.password);

      function submit() {
        if (isBlank(name)) return setError(T('entry.nameRequired'));
        if (!password) return setError(T('entry.passwordRequired'));
        setError('');
        props.onSubmit({
          name: name.trim(),
          username: username.trim(),
          password: password,
          url: url.trim(),
          notes: notes,
        });
      }

      return h(
        Modal,
        {
          title: props.entry ? T('entry.editTitle') : T('entry.addTitle'),
          onClose: props.onClose,
          footer: [
            h('button', { key: 'c', type: 'button', className: 'dsh-av-btn', onClick: props.onClose }, T('action.cancel')),
            h('button', { key: 's', type: 'button', className: 'dsh-av-btn dsh-av-btn--primary', onClick: submit }, T('action.save')),
          ],
        },
        h(
          Field,
          { label: T('entry.name'), id: 'dsh-av-entry-name' },
          h('input', {
            id: 'dsh-av-entry-name',
            className: 'dsh-av-input',
            value: name,
            placeholder: T('entry.namePlaceholder'),
            autoFocus: true,
            onChange: function (event) {
              setName(event.target.value);
            },
            onKeyDown: function (event) {
              if (event.key === 'Enter') submit();
            },
          }),
        ),
        h(
          Field,
          { label: T('entry.username'), id: 'dsh-av-entry-username' },
          h('input', {
            id: 'dsh-av-entry-username',
            className: 'dsh-av-input',
            value: username,
            placeholder: T('entry.usernamePlaceholder'),
            spellCheck: false,
            onChange: function (event) {
              setUsername(event.target.value);
            },
          }),
        ),
        h(
          Field,
          { label: T('entry.password'), id: 'dsh-av-entry-password' },
          h(SecretInput, {
            id: 'dsh-av-entry-password',
            value: password,
            onChange: setPassword,
            placeholder: T('entry.passwordPlaceholder'),
          }),
        ),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' } },
          password ? h(StrengthMeter, { password: password }) : h('span', { className: 'dsh-av-hint' }, T('strength.hint')),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-btn dsh-av-btn--ghost',
              onClick: function () {
                setShowGenerator(!showGenerator);
              },
            },
            keyIcon(14),
            T('entry.generator'),
          ),
        ),
        showGenerator ? h(GeneratorBox, { onGenerate: setPassword }) : null,
        h(
          Field,
          { label: T('entry.url'), id: 'dsh-av-entry-url' },
          h('input', {
            id: 'dsh-av-entry-url',
            className: 'dsh-av-input',
            value: url,
            placeholder: T('entry.urlPlaceholder'),
            spellCheck: false,
            onChange: function (event) {
              setUrl(event.target.value);
            },
          }),
        ),
        h(
          Field,
          { label: T('entry.notes'), id: 'dsh-av-entry-notes' },
          h('textarea', {
            id: 'dsh-av-entry-notes',
            className: 'dsh-av-input',
            value: notes,
            placeholder: T('entry.notesPlaceholder'),
            onChange: function (event) {
              setNotes(event.target.value);
            },
          }),
        ),
        error ? h(Banner, null, error) : null,
      );
    }

    function DeleteModal(props) {
      return h(
        Modal,
        {
          title: T('entry.deleteTitle'),
          narrow: true,
          onClose: props.onClose,
          footer: [
            h('button', { key: 'c', type: 'button', className: 'dsh-av-btn', onClick: props.onClose }, T('action.cancel')),
            h(
              'button',
              { key: 'd', type: 'button', className: 'dsh-av-btn dsh-av-btn--danger', onClick: props.onConfirm },
              T('action.delete'),
            ),
          ],
        },
        h('p', { className: 'dsh-av-hint' }, T('entry.deleteDesc', { name: props.entry.name || T('entry.untitled') })),
      );
    }

    function PasswordModal(props) {
      const [current, setCurrent] = useState('');
      const [next, setNext] = useState('');
      const [confirm, setConfirm] = useState('');
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);

      function submit() {
        if (busy) return;
        if (next.length < 8) return setError(T('password.tooShort'));
        if (next !== confirm) return setError(T('password.mismatch'));
        setError('');
        setBusy(true);
        Promise.resolve(props.onSubmit(current, next))
          .then(function (ok) {
            if (ok) return props.onDone();
            setError(T('password.err'));
            setBusy(false);
          })
          .catch(function (err) {
            setError(err && err.message ? err.message : T('err.generic'));
            setBusy(false);
          });
      }

      return h(
        Modal,
        {
          title: T('password.title'),
          subtitle: T('password.desc'),
          onClose: props.onClose,
          footer: [
            h('button', { key: 'c', type: 'button', className: 'dsh-av-btn', onClick: props.onClose }, T('action.cancel')),
            h('button', { key: 's', type: 'button', className: 'dsh-av-btn dsh-av-btn--primary', disabled: busy, onClick: submit }, T('action.save')),
          ],
        },
        h(
          Field,
          { label: T('password.current'), id: 'dsh-av-pw-current' },
          h(SecretInput, { id: 'dsh-av-pw-current', value: current, onChange: setCurrent, placeholder: T('password.current'), autoFocus: true, onEnter: submit }),
        ),
        h(
          Field,
          { label: T('password.next'), id: 'dsh-av-pw-next' },
          h(SecretInput, { id: 'dsh-av-pw-next', value: next, onChange: setNext, placeholder: T('password.next'), onEnter: submit }),
        ),
        next ? h(StrengthMeter, { password: next }) : null,
        h(
          Field,
          { label: T('password.confirm'), id: 'dsh-av-pw-confirm' },
          h(SecretInput, { id: 'dsh-av-pw-confirm', value: confirm, onChange: setConfirm, placeholder: T('password.confirm'), onEnter: submit }),
        ),
        error ? h(Banner, null, error) : null,
      );
    }

    function SettingsModal(props) {
      const fileRef = useRef(null);
      const [confirmReset, setConfirmReset] = useState(false);
      const [confirmVaultDelete, setConfirmVaultDelete] = useState(false);
      const settings = props.settings || {};
      const isAux = !!props.activeIsAux;
      return h(
        Modal,
        {
          title: T('settings.title'),
          onClose: props.onClose,
          footer: [
            h('button', { key: 'c', type: 'button', className: 'dsh-av-btn dsh-av-btn--primary', onClick: props.onClose }, T('action.close')),
          ],
        },
        h('h4', { className: 'dsh-av-section-title' }, T('settings.data')),
        h(
          'div',
          { className: 'dsh-av-kv' },
          h('span', null, T('settings.entries')),
          h('span', null, String(props.entries.length)),
        ),
        h(
          'div',
          { className: 'dsh-av-kv' },
          h('span', null, T('settings.created')),
          h('span', null, formatDate(props.record && props.record.meta ? props.record.meta.createdAt : null)),
        ),
        h(
          'div',
          { className: 'dsh-av-kv' },
          h('span', null, T('settings.crypto')),
          h('span', null, T('settings.cryptoDetail')),
        ),
        h(
          'div',
          { className: 'dsh-av-kv' },
          h('span', null, T('settings.storage')),
          h('span', null, T('settings.storageDetail')),
        ),
        h('div', { className: 'dsh-av-divider' }),
        h('h4', { className: 'dsh-av-section-title' }, T('vault.section')),
        h('p', { className: 'dsh-av-hint' }, T('vault.desc')),
        h(
          'div',
          { className: 'dsh-av-vault-list' },
          (props.vaults || []).map(function (item, index) {
            return h(
              'div',
              {
                key: 'vault-' + index,
                className:
                  'dsh-av-vault-row' +
                  (index === props.activeIndex ? ' dsh-av-vault-row--active' : ''),
              },
              h('span', { className: 'dsh-av-vault-name' }, vaultLabelOf(item, index)),
              index === props.activeIndex
                ? h('span', { className: 'dsh-av-badge dsh-av-badge--on' }, T('vault.current'))
                : null,
            );
          }),
        ),
        h('p', { className: 'dsh-av-hint' }, T('vault.count', { count: (props.vaults || []).length })),
        h(
          'div',
          { className: 'dsh-av-actions' },
          isAux
            ? null
            : h(
                'button',
                { type: 'button', className: 'dsh-av-btn dsh-av-btn--primary', onClick: props.onAddVault },
                plusIcon(15),
                T('vault.add'),
              ),
          h(
            'button',
            {
              type: 'button',
              className: 'dsh-av-btn dsh-av-btn--danger',
              onClick: function () {
                if (!confirmVaultDelete) return setConfirmVaultDelete(true);
                setConfirmVaultDelete(false);
                props.onDeleteVault();
              },
            },
            trashIcon(15),
            T('vault.delete') + (confirmVaultDelete ? ' \u00b7 ' + T('vault.deleteConfirm') : ''),
          ),
        ),
        isAux ? h('p', { className: 'dsh-av-hint' }, T('vault.auxAddHint')) : null,
        h('div', { className: 'dsh-av-divider' }),
        h('h4', { className: 'dsh-av-section-title' }, T('settings.autolock')),
        h(
          'select',
          {
            className: 'dsh-av-select',
            value: String(settings.autoLockMinutes || 5),
            onChange: function (event) {
              props.onAutoLockChange(Number(event.target.value));
            },
            'aria-label': T('settings.autolock'),
          },
          AUTOLOCK_CHOICES.map(function (minutes) {
            return h('option', { key: minutes, value: String(minutes) }, T('settings.minutes', { n: minutes }));
          }),
        ),
        h('div', { className: 'dsh-av-divider' }),
        h('h4', { className: 'dsh-av-section-title' }, T('settings.backup')),
        h('p', { className: 'dsh-av-hint' }, T('settings.backupDesc')),
        h(
          'div',
          { className: 'dsh-av-actions' },
          h(
            'button',
            { type: 'button', className: 'dsh-av-btn', onClick: props.onExport },
            downloadIcon(15),
            T('action.export'),
          ),
          isAux
            ? null
            : h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-av-btn',
                  onClick: function () {
                    if (fileRef.current) fileRef.current.click();
                  },
                },
                uploadIcon(15),
                T('action.import'),
              ),
          isAux
            ? null
            : h('input', {
                ref: fileRef,
                type: 'file',
                accept: '.json,application/json',
                style: { display: 'none' },
                onChange: function (event) {
                  const file = event.target.files && event.target.files[0];
                  event.target.value = '';
                  if (file) props.onImport(file);
                },
              }),
        ),
        isAux ? h('p', { className: 'dsh-av-hint' }, T('vault.auxBackup')) : null,
        h(
          'button',
          { type: 'button', className: 'dsh-av-btn dsh-av-btn--danger', onClick: props.onChangePassword },
          keyIcon(15),
          T('action.changePassword'),
        ),
        h('div', { className: 'dsh-av-divider' }),
        isAux
          ? h('p', { className: 'dsh-av-hint' }, T('vault.auxReset'))
          : h(
              React.Fragment,
              null,
              h('p', { className: 'dsh-av-hint' }, T('settings.resetDesc')),
              h(
                'button',
                {
                  type: 'button',
                  className: 'dsh-av-btn dsh-av-btn--danger',
                  onClick: function () {
                    if (!confirmReset) return setConfirmReset(true);
                    setConfirmReset(false);
                    props.onReset();
                  },
                },
                trashIcon(15),
                T('action.reset') + (confirmReset ? ' \u00b7 ' + T('settings.resetConfirm') : ''),
              ),
            ),
      );
    }

    /* ------------------------------------------------------------------ */
    /* Panel                                                              */
    /* ------------------------------------------------------------------ */

    const Bridge = { ctx: null };

    function insertStyles() {
      if (typeof document === 'undefined' || !document.head) return function () {};
      const id = 'dsh-account-vault-styles';
      const existing = document.getElementById(id);
      const el = existing || document.createElement('style');
      el.id = id;
      if (el.textContent !== CSS) el.textContent = CSS;
      if (!existing) document.head.appendChild(el);
      return function () {
        if (!existing && el.parentNode) el.parentNode.removeChild(el);
      };
    }

    async function copyText(text) {
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (err) {
        /* fall back to a selection based copy */
      }
      try {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(area);
        return !!ok;
      } catch (err) {
        return false;
      }
    }

    function VaultPanelIcon(props) {
      const active = !!(props && props.active);
      const box = typeof props?.size === 'number' && props.size > 0 ? props.size : 22;
      const glyph = Math.max(12, Math.round(box * 0.7));
      return h(
        'span',
        {
          className: 'dsh-av-logo',
          title: T('panel.title'),
          'aria-hidden': 'true',
          style: {
            width: box + 'px',
            height: box + 'px',
            borderRadius: Math.round(box * 0.28) + 'px',
            background: active ? 'var(--dsh-av-accent-soft)' : 'transparent',
            color: 'var(--dsh-av-accent)',
          },
        },
        shieldIcon(glyph),
      );
    }

    function VaultPanel() {
      const [status, setStatus] = useState('loading');
      const [vaults, setVaults] = useState([]);
      const [activeIndex, setActiveIndex] = useState(0);
      const [record, setRecord] = useState(null);
      const [entries, setEntries] = useState([]);
      const [query, setQuery] = useState('');
      const [modal, setModal] = useState(null);
      const [toast, setToast] = useState(null);
      const [settings, setSettings] = useState(loadSettings);
      const [revealedId, setRevealedId] = useState(null);
      const [, setLocaleTick] = useState(0);

      const keyRef = useRef(null);
      const entriesRef = useRef([]);
      const recordRef = useRef(null);
      const vaultsRef = useRef([]);
      const indexRef = useRef(0);
      const kindRef = useRef('main');
      const toastTimer = useRef(null);
      const revealTimer = useRef(null);
      const lockTimer = useRef(null);

      const activeIsAux = vaultKindOf(record, activeIndex) === 'aux';

      const showToast = useCallback(function (key, vars) {
        setToast({ text: translate(Bridge.ctx, key, vars) });
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(function () {
          setToast(null);
        }, 2600);
      }, []);

      /* initial read; wiping the key on unmount also handles "leave the panel" */
      useEffect(function () {
        const file = loadVaultFile();
        const loaded = file ? file.vaults : [];
        vaultsRef.current = loaded;
        setVaults(loaded);
        if (loaded.length) {
          indexRef.current = 0;
          setActiveIndex(0);
          recordRef.current = loaded[0];
          setRecord(loaded[0]);
          setStatus('locked');
        } else {
          setStatus('create');
        }
        return function () {
          keyRef.current = null;
          clearTimeout(toastTimer.current);
          clearTimeout(revealTimer.current);
          clearTimeout(lockTimer.current);
        };
      }, []);

      /* re-render on language change */
      useEffect(function () {
        const locale = localeOf(Bridge.ctx);
        if (!locale || typeof locale.subscribe !== 'function') return undefined;
        return locale.subscribe(function () {
          setLocaleTick(function (value) {
            return value + 1;
          });
        });
      }, []);

      const lock = useCallback(function () {
        keyRef.current = null;
        entriesRef.current = [];
        setEntries([]);
        setRevealedId(null);
        setModal(null);
        setQuery('');
        setStatus(vaultsRef.current.length ? 'locked' : 'create');
      }, []);

      /* auto lock while unlocked */
      useEffect(
        function () {
          if (status !== 'unlocked') return undefined;
          const minutes = Math.max(1, Number(settings.autoLockMinutes) || 5);
          function arm() {
            clearTimeout(lockTimer.current);
            lockTimer.current = setTimeout(lock, minutes * 60 * 1000);
          }
          const events = ['pointerdown', 'keydown', 'wheel', 'focus'];
          events.forEach(function (name) {
            window.addEventListener(name, arm, true);
          });
          arm();
          return function () {
            clearTimeout(lockTimer.current);
            events.forEach(function (name) {
              window.removeEventListener(name, arm, true);
            });
          };
        },
        [status, settings.autoLockMinutes, lock],
      );

      const commitVaults = useCallback(function (nextVaults) {
        try {
          if (nextVaults.length) saveVaultFile(nextVaults);
          else clearFileRaw();
        } catch (err) {
          throw new Error(translate(Bridge.ctx, 'err.saveFailed'));
        }
        vaultsRef.current = nextVaults;
        setVaults(nextVaults);
      }, []);

      const persist = useCallback(
        async function (nextEntries) {
          const key = keyRef.current;
          const index = indexRef.current;
          const current = vaultsRef.current[index];
          if (!key || !current) throw new Error(translate(Bridge.ctx, 'err.generic'));
          const cipher = await encryptPayload(key, { kind: kindRef.current, entries: nextEntries });
          const now = new Date().toISOString();
          const nextRecord = {
            schema: SCHEMA,
            version: VAULT_VERSION,
            id: current.id || uid(),
            label: kindRef.current === 'aux' ? 'aux' : 'main',
            kdf: current.kdf,
            cipher: cipher,
            meta: {
              createdAt: current.meta && current.meta.createdAt ? current.meta.createdAt : now,
              updatedAt: now,
            },
          };
          const nextVaults = vaultsRef.current.map(function (item, i) {
            return i === index ? nextRecord : item;
          });
          commitVaults(nextVaults);
          recordRef.current = nextRecord;
          entriesRef.current = nextEntries;
          setRecord(nextRecord);
          setEntries(nextEntries);
        },
        [commitVaults],
      );

      const createVault = useCallback(
        async function (password, kind) {
          if (!webCrypto()) throw new Error(translate(Bridge.ctx, 'err.cryptoUnavailable'));
          if (!storageAvailable()) throw new Error(translate(Bridge.ctx, 'err.storageUnavailable'));
          const vaultKind = kind === 'aux' ? 'aux' : 'main';
          const existing = vaultsRef.current;
          if (existing.length && (await passwordOpensOtherVault(password, existing, -1))) {
            throw new Error(translate(Bridge.ctx, 'err.passwordInUse'));
          }
          const salt = randomBytes(16);
          const key = await deriveKey(password, salt, KDF_ITERATIONS);
          const cipher = await encryptPayload(key, { kind: vaultKind, entries: [] });
          const now = new Date().toISOString();
          const nextRecord = {
            schema: SCHEMA,
            version: VAULT_VERSION,
            id: uid(),
            label: vaultKind,
            kdf: { algo: 'PBKDF2-SHA-256', iterations: KDF_ITERATIONS, salt: toBase64(salt) },
            cipher: cipher,
            meta: { createdAt: now, updatedAt: now },
          };
          const nextVaults = existing.concat([nextRecord]);
          commitVaults(nextVaults);
          const index = nextVaults.length - 1;
          if (!existing.length) {
            indexRef.current = index;
            setActiveIndex(index);
            keyRef.current = key;
            kindRef.current = vaultKind;
            recordRef.current = nextRecord;
            entriesRef.current = [];
            setRecord(nextRecord);
            setEntries([]);
            setStatus('unlocked');
            showToast('toast.created');
            return;
          }
          /* an extra vault stays closed until its own password opens it */
          indexRef.current = 0;
          setActiveIndex(0);
          recordRef.current = nextVaults[0];
          setRecord(nextVaults[0]);
          keyRef.current = null;
          entriesRef.current = [];
          setEntries([]);
          setRevealedId(null);
          setQuery('');
          setModal(null);
          setStatus('locked');
          showToast('vault.added');
        },
        [commitVaults, showToast],
      );

      const unlockVault = useCallback(
        async function (password) {
          let list = vaultsRef.current;
          if (!list.length) {
            const file = loadVaultFile();
            list = file ? file.vaults : [];
            vaultsRef.current = list;
            setVaults(list);
          }
          if (!list.length) return false;
          if (!webCrypto()) {
            showToast('err.cryptoUnavailable');
            return false;
          }
          for (let i = 0; i < list.length; i += 1) {
            const candidate = list[i];
            try {
              const key = await deriveKey(
                password,
                fromBase64(candidate.kdf.salt),
                Number(candidate.kdf.iterations) || KDF_ITERATIONS,
              );
              const payload = await decryptPayload(key, candidate.cipher);
              if (!payload || !Array.isArray(payload.entries)) continue;
              keyRef.current = key;
              kindRef.current = payload.kind === 'aux' ? 'aux' : 'main';
              indexRef.current = i;
              recordRef.current = candidate;
              entriesRef.current = payload.entries;
              setActiveIndex(i);
              setRecord(candidate);
              setEntries(payload.entries);
              setRevealedId(null);
              setQuery('');
              setStatus('unlocked');
              return true;
            } catch (err) {
              /* wrong password for this vault; try the next one */
            }
          }
          return false;
        },
        [showToast],
      );

      const resetVault = useCallback(function () {
        const index = indexRef.current;
        const remainder = vaultsRef.current.filter(function (item, i) {
          return i !== index;
        });
        try {
          if (remainder.length) saveVaultFile(remainder);
          else clearFileRaw();
          clearLegacyRaw();
        } catch (err) {
          showToast('err.saveFailed');
          return;
        }
        vaultsRef.current = remainder;
        setVaults(remainder);
        keyRef.current = null;
        entriesRef.current = [];
        setEntries([]);
        setRevealedId(null);
        setQuery('');
        setModal(null);
        indexRef.current = 0;
        setActiveIndex(0);
        if (remainder.length) {
          recordRef.current = remainder[0];
          setRecord(remainder[0]);
          setStatus('locked');
          showToast('vault.deletedOk');
          return;
        }
        clearSettingsRaw();
        recordRef.current = null;
        setRecord(null);
        setSettings({ autoLockMinutes: 5 });
        setStatus('create');
        showToast('toast.reset');
      }, [showToast]);

      const resetAllVaults = useCallback(function () {
        try {
          clearFileRaw();
          clearLegacyRaw();
          clearSettingsRaw();
        } catch (err) {
          showToast('err.saveFailed');
          return;
        }
        vaultsRef.current = [];
        setVaults([]);
        keyRef.current = null;
        entriesRef.current = [];
        indexRef.current = 0;
        kindRef.current = 'main';
        setActiveIndex(0);
        recordRef.current = null;
        setRecord(null);
        setEntries([]);
        setRevealedId(null);
        setQuery('');
        setSettings({ autoLockMinutes: 5 });
        setModal(null);
        setStatus('create');
        showToast('toast.reset');
      }, [showToast]);

      const saveEntry = useCallback(
        async function (draft) {
          const list = entriesRef.current;
          const now = new Date().toISOString();
          let next;
          if (modal && modal.type === 'editor' && modal.entry) {
            const id = modal.entry.id;
            next = list.map(function (item) {
              if (item.id !== id) return item;
              return Object.assign({}, item, draft, { updatedAt: now });
            });
          } else {
            next = list.concat([
              Object.assign({ id: uid(), createdAt: now, updatedAt: now }, draft),
            ]);
          }
          try {
            await persist(next);
            setModal(null);
            showToast('toast.saved');
          } catch (err) {
            showToast('err.saveFailed');
          }
        },
        [modal, persist, showToast],
      );

      const removeEntry = useCallback(
        async function (target) {
          const next = entriesRef.current.filter(function (item) {
            return item.id !== target.id;
          });
          try {
            await persist(next);
            setModal(null);
            setRevealedId(null);
            showToast('toast.deleted');
          } catch (err) {
            showToast('err.saveFailed');
          }
        },
        [persist, showToast],
      );

      const changePassword = useCallback(
        async function (current, nextPassword) {
          const index = indexRef.current;
          const old = vaultsRef.current[index];
          if (!old) return false;
          if (!webCrypto()) {
            showToast('err.cryptoUnavailable');
            return false;
          }
          let payload;
          try {
            const oldKey = await deriveKey(
              current,
              fromBase64(old.kdf.salt),
              Number(old.kdf.iterations) || KDF_ITERATIONS,
            );
            payload = await decryptPayload(oldKey, old.cipher);
          } catch (err) {
            return false;
          }
          {
            const entriesNext = (payload && payload.entries) || [];
            const kind =
              payload && payload.kind === 'aux' ? 'aux' : old.label === 'aux' ? 'aux' : 'main';
            const salt = randomBytes(16);
            const key = await deriveKey(nextPassword, salt, KDF_ITERATIONS);
            if (await passwordOpensOtherVault(nextPassword, vaultsRef.current, index)) {
              throw new Error(translate(Bridge.ctx, 'err.passwordInUse'));
            }
            const cipher = await encryptPayload(key, { kind: kind, entries: entriesNext });
            const now = new Date().toISOString();
            const nextRecord = {
              schema: SCHEMA,
              version: VAULT_VERSION,
              id: (typeof old.id === 'string' && old.id) || uid(),
              label: kind,
              kdf: { algo: 'PBKDF2-SHA-256', iterations: KDF_ITERATIONS, salt: toBase64(salt) },
              cipher: cipher,
              meta: {
                createdAt: old.meta && old.meta.createdAt ? old.meta.createdAt : now,
                updatedAt: now,
              },
            };
            const nextVaults = vaultsRef.current.map(function (item, i) {
              return i === index ? nextRecord : item;
            });
            commitVaults(nextVaults);
            keyRef.current = key;
            kindRef.current = kind;
            recordRef.current = nextRecord;
            entriesRef.current = entriesNext;
            setRecord(nextRecord);
            setEntries(entriesNext);
            return true;
          }
        },
        [commitVaults, showToast],
      );

      const copyValue = useCallback(
        async function (value, toastKey) {
          if (!value) return;
          const ok = await copyText(value);
          if (!ok) {
            showToast('err.copyFailed');
            return;
          }
          showToast(toastKey);
          if (toastKey === 'toast.passwordCopied') {
            setTimeout(function () {
              copyText('');
            }, CLIPBOARD_CLEAR_MS);
          }
        },
        [showToast],
      );

      const revealEntry = useCallback(
        function (id) {
          clearTimeout(revealTimer.current);
          if (revealedId === id) {
            setRevealedId(null);
            return;
          }
          setRevealedId(id);
          revealTimer.current = setTimeout(function () {
            setRevealedId(null);
          }, REVEAL_MS);
        },
        [revealedId],
      );

      /* A main-vault export carries every vault; an aux export carries only that vault, so a
         file handed around for the decoy can never ship the main ciphertext as well. */
      const exportBackup = useCallback(
        function () {
          const list = vaultsRef.current;
          if (!list.length) return;
          const aux = vaultKindOf(vaultsRef.current[indexRef.current], indexRef.current) === 'aux';
          const exported = aux
            ? [vaultsRef.current[indexRef.current]]
            : list;
          try {
            const payload = { schema: FILE_SCHEMA, version: FILE_VERSION, vaults: exported };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const stamp = new Date().toISOString().slice(0, 10);
            link.download =
              'account-vault-' + (aux ? 'decoy-' : '') + stamp + '.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(function () {
              URL.revokeObjectURL(url);
            }, 4000);
            showToast(aux ? 'toast.exportedAux' : 'toast.exported');
          } catch (err) {
            showToast('err.generic');
          }
        },
        [showToast],
      );

      const importBackup = useCallback(
        async function (file) {
          if (!file) return;
          if (kindRef.current === 'aux') {
            showToast('vault.auxBackup');
            return;
          }
          let parsed = null;
          try {
            parsed = parseVaultFile(await file.text());
          } catch (err) {
            parsed = null;
          }
          if (!parsed) {
            showToast('err.importInvalid');
            return;
          }
          const plan = mergeVaults(vaultsRef.current, parsed.vaults);
          setModal({
            type: 'importConfirm',
            incoming: parsed.vaults,
            added: plan.added,
            skipped: plan.skipped,
            conflicts: plan.conflicts,
          });
        },
        [showToast],
      );

      /* "merge" never deletes a local vault; "replace" restores the file exactly as it was. */
      const confirmImport = useCallback(
        function (mode) {
          if (!modal || modal.type !== 'importConfirm') return;
          const nextVaults =
            mode === 'replace'
              ? ensureVaultIds(modal.incoming)
              : vaultsRef.current.concat(modal.added || []);
          if (!nextVaults.length) {
            showToast('err.importInvalid');
            return;
          }
          try {
            saveVaultFile(nextVaults);
          } catch (err) {
            showToast('err.saveFailed');
            return;
          }
          vaultsRef.current = nextVaults;
          setVaults(nextVaults);
          keyRef.current = null;
          entriesRef.current = [];
          indexRef.current = 0;
          kindRef.current = 'main';
          setActiveIndex(0);
          recordRef.current = nextVaults[0];
          setRecord(nextVaults[0]);
          setEntries([]);
          setRevealedId(null);
          setQuery('');
          setModal(null);
          setStatus('locked');
          if (mode === 'replace') showToast('toast.imported');
          else
            showToast('toast.importedMerged', {
              added: (modal.added || []).length,
              skipped: modal.skipped || 0,
            });
        },
        [modal, showToast],
      );

      /* Recovery path for a device whose main vault is gone (for example after an explicit
         "覆盖全部" with an aux-only file): the lock screen can merge ciphertext back from a
         backup. It never deletes or replaces anything, and each restored vault still needs its
         own password. Only offered when no main vault is present, so a decoy session cannot use
         it to fill the device. */
      const restoreFromBackup = useCallback(
        async function (file) {
          if (!file) return;
          let parsed = null;
          try {
            parsed = parseVaultFile(await file.text());
          } catch (err) {
            parsed = null;
          }
          if (!parsed) {
            showToast('err.importInvalid');
            return;
          }
          const plan = mergeVaults(vaultsRef.current, parsed.vaults);
          if (!plan.added.length) {
            showToast('toast.restoredNone');
            return;
          }
          const nextVaults = vaultsRef.current.concat(plan.added);
          try {
            saveVaultFile(nextVaults);
          } catch (err) {
            showToast('err.saveFailed');
            return;
          }
          vaultsRef.current = nextVaults;
          setVaults(nextVaults);
          if (!recordRef.current) {
            recordRef.current = nextVaults[0];
            setRecord(nextVaults[0]);
          }
          showToast('toast.restored', {
            added: plan.added.length,
            total: nextVaults.length,
          });
        },
        [showToast],
      );

      const updateAutoLock = useCallback(function (minutes) {
        const next = { autoLockMinutes: minutes };
        saveSettings(next);
        setSettings(next);
      }, []);

      const filtered = entries.filter(function (entry) {
        return matchesSearch(entry, query);
      });

      const unlocked = status === 'unlocked';

      const hasMainVault = vaults.some(function (item, i) {
        return vaultKindOf(item, i) === 'main';
      });

      const listBody = unlocked
        ? h(
            'div',
            { className: 'dsh-av-column' },
            h(
              'div',
              { className: 'dsh-av-toolbar' },
              h(
                'div',
                { className: 'dsh-av-search' },
                searchIcon(15),
                h('input', {
                  className: 'dsh-av-input',
                  value: query,
                  placeholder: T('list.search'),
                  'aria-label': T('list.search'),
                  onChange: function (event) {
                    setQuery(event.target.value);
                  },
                }),
              ),
              h('span', { className: 'dsh-av-spacer' }),
              h(
                'p',
                { className: 'dsh-av-count' },
                query.trim()
                  ? T('list.countFiltered', { shown: filtered.length, total: entries.length })
                  : T('list.count', { count: entries.length }),
              ),
            ),
            filtered.length
              ? h(
                  'div',
                  { className: 'dsh-av-list' },
                  filtered.map(function (entry) {
                    return h(EntryRow, {
                      key: entry.id,
                      entry: entry,
                      revealed: revealedId === entry.id,
                      onReveal: function () {
                        revealEntry(entry.id);
                      },
                      onCopy: copyValue,
                      onEdit: function () {
                        setModal({ type: 'editor', entry: entry });
                      },
                      onDelete: function () {
                        setModal({ type: 'delete', entry: entry });
                      },
                    });
                  }),
                )
              : h(
                  'div',
                  { className: 'dsh-av-empty' },
                  h('span', { className: 'dsh-av-empty-icon' }, entries.length ? searchIcon(24) : shieldIcon(26)),
                  h('h3', { className: 'dsh-av-empty-title' }, entries.length ? T('list.searchEmpty') : T('list.empty')),
                  h('p', { className: 'dsh-av-empty-desc' }, entries.length ? T('list.searchEmptyDesc') : T('list.emptyDesc')),
                  entries.length
                    ? null
                    : h(
                        'button',
                        {
                          type: 'button',
                          className: 'dsh-av-btn dsh-av-btn--primary',
                          onClick: function () {
                            setModal({ type: 'editor', entry: null });
                          },
                        },
                        plusIcon(15),
                        T('action.add'),
                      ),
                ),
            h('p', { className: 'dsh-av-footnote' }, T('list.footnote', { n: settings.autoLockMinutes || 5 })),
          )
        : null;

      return h(
        'div',
        { className: 'dsh-av-root' },
        h(
          'header',
          { className: 'dsh-av-head' },
          h(
            'div',
            { className: 'dsh-av-head-main' },
            h(
              'div',
              { className: 'dsh-av-title-row' },
              h('span', { className: 'dsh-av-logo' }, shieldIcon(17)),
              h('h1', { className: 'dsh-av-title' }, T('panel.title')),
              h(
                'span',
                { className: 'dsh-av-badge' + (unlocked ? ' dsh-av-badge--on' : '') },
                T(unlocked ? 'panel.unlocked' : 'panel.locked'),
              ),
              unlocked && activeIsAux
                ? h('span', { className: 'dsh-av-badge dsh-av-badge--warn' }, T('vault.aux'))
                : null,
            ),
            h('p', { className: 'dsh-av-sub' }, T('panel.subtitle')),
          ),
          unlocked
            ? h(
                'div',
                { className: 'dsh-av-head-actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-av-btn dsh-av-btn--primary',
                    onClick: function () {
                      setModal({ type: 'editor', entry: null });
                    },
                  },
                  plusIcon(15),
                  T('action.add'),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-av-btn',
                    onClick: function () {
                      setModal({ type: 'settings' });
                    },
                  },
                  settingsIcon(15),
                  T('action.settings'),
                ),
                h('button', { type: 'button', className: 'dsh-av-btn', onClick: lock }, lockIcon(15), T('action.lock')),
              )
            : null,
        ),
        h(
          'div',
          { className: 'dsh-av-body' },
          status === 'loading' ? null : null,
          status === 'create'
            ? h(CreateVault, {
                onSubmit: function (password) {
                  return createVault(password, 'main');
                },
              })
            : status === 'locked'
              ? h(UnlockVault, {
                  onUnlock: unlockVault,
                  /* An aux session must never be able to wipe the other vaults from the lock
                     screen: the reset button only exists when the last opened vault was main. */
                  onReset:
                    vaultKindOf(vaults[indexRef.current], indexRef.current) === 'aux'
                      ? null
                      : vaults.length > 1
                        ? resetAllVaults
                        : resetVault,
                  resetLabel: vaults.length > 1 ? 'action.resetAll' : 'action.reset',
                  vaultCount: vaults.length,
                  onRestore: hasMainVault ? null : restoreFromBackup,
                })
              : listBody,
        ),
        modal && modal.type === 'editor'
          ? h(EditorModal, {
              entry: modal.entry,
              onClose: function () {
                setModal(null);
              },
              onSubmit: saveEntry,
            })
          : null,
        modal && modal.type === 'delete'
          ? h(DeleteModal, {
              entry: modal.entry,
              onClose: function () {
                setModal(null);
              },
              onConfirm: function () {
                removeEntry(modal.entry);
              },
            })
          : null,
        modal && modal.type === 'password'
          ? h(PasswordModal, {
              onClose: function () {
                setModal(null);
              },
              onSubmit: changePassword,
              onDone: function () {
                setModal(null);
                showToast('password.success');
              },
            })
          : null,
        modal && modal.type === 'settings'
          ? h(SettingsModal, {
              settings: settings,
              record: record,
              entries: entries,
              vaults: vaults,
              activeIndex: activeIndex,
              activeIsAux: activeIsAux,
              onClose: function () {
                setModal(null);
              },
              onExport: exportBackup,
              onImport: importBackup,
              onAutoLockChange: updateAutoLock,
              onAddVault: function () {
                setModal({ type: 'attach' });
              },
              onDeleteVault: resetVault,
              onChangePassword: function () {
                setModal({ type: 'password' });
              },
              onReset: resetAllVaults,
            })
          : null,
        modal && modal.type === 'attach'
          ? h(AttachVaultModal, {
              onClose: function () {
                setModal(null);
              },
              onSubmit: function (password) {
                return createVault(password, 'aux');
              },
            })
          : null,
        modal && modal.type === 'importConfirm'
          ? h(ImportConfirm, {
              count: modal.incoming.length,
              current: vaults.length,
              added: (modal.added || []).length,
              skipped: modal.skipped || 0,
              conflicts: modal.conflicts || 0,
              onClose: function () {
                setModal(null);
              },
              onMerge: function () {
                confirmImport('merge');
              },
              onReplace: function () {
                confirmImport('replace');
              },
            })
          : null,
        toast ? h('div', { className: 'dsh-av-toast', role: 'status' }, toast.text) : null,
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        Bridge.ctx = ctx;

        const locale = localeOf(ctx);
        if (locale && typeof locale.register === 'function') {
          [
            ['en', EN],
            ['zh', ZH],
            ['zh-CN', ZH],
          ].forEach(function (pair) {
            try {
              ctx.effect(function () {
                return locale.register(NS, pair[0], pair[1]);
              });
            } catch (err) {
              /* a dictionary for this locale may already be registered */
            }
          });
        }

        ctx.effect(insertStyles);

        ctx.slots.inject('sidebar.panellist', function () {
          return ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_ID,
              order: 30,
              label: function () {
                return translate(Bridge.ctx, 'panel.title');
              },
            },
            VaultPanelIcon,
          );
        });

        ctx.slots.inject('main', function () {
          return ctx.slots.register({ name: 'main', key: PANEL_ID }, VaultPanel);
        });
      },
    };
  },
});
