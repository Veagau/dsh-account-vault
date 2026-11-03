/**
 * Host half of the account-vault bundle.
 *
 * The vault runs entirely in the Web page: the Client module derives the key
 * with Web Crypto and keeps the only copy of the plaintext in component memory.
 * Nothing is registered on the Host side.
 */
export function apply() {}
