import { posix, win32 } from 'node:path'
import { createHash } from 'node:crypto'

/** Fixed admission limits, not a grant of filesystem access. */
export const FS_LIMITS = Object.freeze({ bytes: 1024 * 1024, output: 24000, entries: 1500, matches: 100, depth: 24 })
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const fail = (code, message) => { throw Object.assign(new Error(`${code}: ${message}`), { code }) }
const pathApi = root => /^[a-z]:[\\/]/i.test(root) ? win32 : posix
const absolute = value => win32.isAbsolute(value) || posix.isAbsolute(value)

/** Reject Windows aliases as well as POSIX traversal, independently of the provider OS. */
export function relativePath(value, allowDot = false) {
  if (typeof value !== 'string' || value.length > 2048 || !value || /[\x00-\x1f:]/.test(value) || absolute(value)) fail('PATH_DENIED', 'use a relative path without drive, UNC, ADS or traversal')
  const parts = value.replaceAll('\\', '/').split('/')
  if (allowDot && value === '.') return []
  if (parts.length > FS_LIMITS.depth || parts.some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p) || /[<>"|?*]/.test(p) || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p))) fail('PATH_DENIED', 'invalid path component')
  return parts
}

/** Narrow provider-only access. No node:fs, shell, host-path fallbacks or model-owned roots. */
export class RoleFilesystem {
  constructor({ fs, workingDirectory, sandboxPolicy, agent, role, authorize = () => {} }) {
    this.fs = fs
    this.authorize = authorize
    this.workingDirectory = workingDirectory
    this.sandboxPolicy = sandboxPolicy
    this.agent = agent
    this.role = role
    this.root = agent.session.header.cwd
    if (typeof this.root !== 'string' || !absolute(this.root)) fail('WORKSPACE_REQUIRED', 'Session header must contain an absolute workspace cwd')
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(agent.id)) fail('SESSION_REQUIRED', 'invalid native Session identity')
    this.api = pathApi(this.root)
    this.artifact = `financial-services/artifacts/${agent.id}`
    this.active = true
  }

  dispose() { this.active = false }

  check() {
    this.authorize()
    if (!this.active) fail('ROLE_DISPOSED', 'role registrations were removed')
    if (this.workingDirectory.get(this.agent.session) !== this.root) fail('WORKSPACE_CHANGED', 'finance roles cannot change the Session workspace')
  }

  async noLinks(base, parts, signal, missing = false) {
    let path = base
    for (let index = -1; index < parts.length; index++) {
      if (index >= 0) path = this.api.join(path, parts[index])
      const info = await this.fs.lstat(path, { cwd: base }, signal)
      if (!info) {
        if (missing && index >= 0) continue
        fail('FS_NOT_FOUND', 'path is absent')
      }
      if (info.type === 'symlink' || info.type === 'other') fail('PATH_LINK_DENIED', 'symbolic links, junctions and special files are not allowed')
      if (index < parts.length - 1 && info.type !== 'directory') fail('PATH_DENIED', 'a path ancestor is not a directory')
    }
  }

  async target(path, { signal, write = false, directory = false } = {}) {
    this.check()
    let base = this.root
    let parts
    if (!write && absolute(path)) {
      if (path.split(/[\\/]/).some(part => part === '.' || part === '..')) fail('PATH_DENIED', 'absolute skill resource paths cannot contain traversal')
      const api = pathApi(path)
      const matched = this.role.skillRoots.find(root => {
        const rel = api.relative(root, path)
        return rel !== '' && !absolute(rel) && rel !== '..' && !rel.startsWith(`..${api.sep}`)
      })
      if (!matched) fail('PATH_DENIED', 'absolute reads are limited to this role\'s assigned skill resources')
      base = matched
      parts = relativePath(api.relative(base, path))
    } else parts = relativePath(path, directory)
    if (write) {
      const prefix = `${this.artifact}/`
      if (!path.replaceAll('\\', '/').startsWith(prefix)) fail('ARTIFACT_SCOPE_DENIED', `write only below ${prefix}`)
    }
    await this.noLinks(base, parts, signal, write)
    const parent = await this.fs.resolve(base, { signal })
    const target = await this.fs.resolve(this.api.join(base, ...parts), { cwd: base, signal })
    if (!this.fs.contains(parent, target)) fail('PATH_DENIED', 'canonical target leaves the assigned root')
    if (write) {
      const artifact = await this.fs.resolve(this.api.join(this.root, this.artifact), { signal })
      if (!this.fs.contains(artifact, target) || this.fs.processPath(artifact) === this.fs.processPath(target)) fail('ARTIFACT_SCOPE_DENIED', 'target must be a file inside this Session artifact directory')
    }
    return target
  }

  async bytes(path, signal) {
    const target = await this.target(path, { signal })
    const bytes = await this.fs.readBytes(target, signal, FS_LIMITS.bytes)
    if (bytes.length > FS_LIMITS.bytes) fail('FS_TOO_LARGE', 'file exceeds the text limit')
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (text.includes('\0')) fail('TEXT_REQUIRED', 'binary content is not supported')
    return { target, bytes, text }
  }

  async read({ file_path, offset = 1, limit = 200 }, signal) {
    if (!this.role.builtinTools.includes('read')) fail('ROLE_TOOL_DENIED', 'role cannot read')
    const { bytes, text } = await this.bytes(file_path, signal)
    const lines = text.split('\n')
    const window = lines.slice(offset - 1, offset - 1 + limit)
    const result = []
    let length = 0
    let clipped = false
    for (const line of window) {
      const separator = result.length ? 1 : 0
      const remaining = FS_LIMITS.output - length - separator
      if (remaining < 0) { clipped = true; break }
      const bounded = line.slice(0, remaining)
      result.push(bounded)
      length += separator + bounded.length
      if (bounded.length !== line.length) { clipped = true; break }
    }
    return { path: file_path, sha256: sha256(bytes), offset, totalLines: lines.length, text: result.join('\n'), truncated: clipped || offset - 1 + result.length < lines.length, trust: 'UNTRUSTED_DATA' }
  }

  async list(path, signal) {
    relativePath(path, true)
    await this.target(path, { signal, directory: true })
    const files = []
    const pending = [{ path: path === '.' ? '' : path.replaceAll('\\', '/'), depth: 0 }]
    let scanned = 0
    let truncated = false
    while (pending.length) {
      const dir = pending.shift()
      // Re-admit each ancestor immediately before listing, rather than trusting listDir target aliases.
      const admitted = await this.target(dir.path || '.', { signal, directory: true })
      const entries = await this.fs.listDir(admitted, signal)
      for (const entry of entries) {
        if (++scanned > FS_LIMITS.entries) { truncated = true; break }
        relativePath(entry.name)
        if (entry.name.includes('/') || entry.name.includes('\\')) fail('PATH_DENIED', 'invalid provider entry')
        const child = dir.path ? `${dir.path}/${entry.name}` : entry.name
        // A linked entry is denied, never traversed, even if its resolved target is within the root.
        const info = await this.fs.lstat(this.api.join(this.root, child), { cwd: this.root }, signal)
        if (info?.type === 'symlink' || info?.type === 'other') continue
        if (entry.type === 'directory') {
          if (dir.depth < FS_LIMITS.depth) pending.push({ path: child, depth: dir.depth + 1 })
          else truncated = true
        } else if (entry.type === 'file' && info?.type === 'file') files.push(child)
      }
      if (scanned > FS_LIMITS.entries) break
    }
    return { files, truncated }
  }

  async glob({ pattern, path = '.' }, signal) {
    if (!this.role.builtinTools.includes('glob')) fail('ROLE_TOOL_DENIED', 'role cannot glob')
    const { files, truncated } = await this.list(path, signal)
    const matcher = globPattern(pattern)
    const hits = files.filter(file => matcher.test(pattern.includes('/') ? file : file.split('/').at(-1)))
    return { paths: hits.slice(0, FS_LIMITS.matches), truncated: truncated || hits.length > FS_LIMITS.matches, trust: 'UNTRUSTED_DATA' }
  }

  async grep({ pattern, path = '.' }, signal) {
    if (!this.role.builtinTools.includes('grep')) fail('ROLE_TOOL_DENIED', 'role cannot grep')
    // Literal search avoids model-controlled catastrophic regular expressions.
    const { files, truncated: scanTruncated } = await this.list(path, signal)
    const matches = []
    let truncated = scanTruncated
    let budget = FS_LIMITS.output
    let scannedBytes = 0
    for (const file of files) {
      const target = await this.target(file, { signal })
      const info = await this.fs.stat(target, signal)
      if (info?.size === undefined || info.size > FS_LIMITS.bytes) { truncated = true; continue }
      if ((scannedBytes += info.size) > 4 * FS_LIMITS.bytes) { truncated = true; break }
      const { text } = await this.bytes(file, signal)
      for (const [index, line] of text.split('\n').entries()) {
        if (!line.includes(pattern)) continue
        const bounded = line.slice(0, Math.min(2000, budget))
        budget -= bounded.length
        matches.push({ path: file, line: index + 1, text: bounded })
        if (matches.length >= FS_LIMITS.matches || budget <= 0) { truncated = true; break }
      }
      if (matches.length >= FS_LIMITS.matches || budget <= 0) break
    }
    return { matches, truncated, trust: 'UNTRUSTED_DATA' }
  }

  policy() {
    const policy = this.sandboxPolicy.resolve({ session: this.agent.session })
    if (policy.mode === 'read-only') fail('FS_SANDBOX_DENIED', 'the native Session is read-only')
    // A broad user mode never increases a role's authority; the provider gets a narrower per-call root.
    return { ...policy, mode: 'workspace-write', workspaceRoot: this.root, sessionId: this.agent.id }
  }

  async write({ file_path, content }, signal) {
    if (!this.role.writer || !this.role.builtinTools.includes('write')) fail('ROLE_TOOL_DENIED', 'role cannot write')
    const policy = this.policy()
    const target = await this.target(file_path, { signal, write: true })
    await this.fs.writeText(target, content, { kind: 'createIfAbsent' }, signal, policy)
    const { bytes } = await this.bytes(file_path, signal)
    return { path: file_path, sha256: sha256(bytes), operation: 'create', artifactDirectory: this.artifact }
  }

  async edit({ file_path, old_string, new_string, expected_sha256 }, signal) {
    if (!this.role.writer || !this.role.builtinTools.includes('edit')) fail('ROLE_TOOL_DENIED', 'role cannot edit')
    const policy = this.policy()
    const target = await this.target(file_path, { signal, write: true })
    const before = await this.fs.stat(target, signal)
    const { bytes, text } = await this.bytes(file_path, signal)
    const after = await this.fs.stat(target, signal)
    if (!before || before.version !== after?.version || sha256(bytes) !== expected_sha256) fail('HASH_CONFLICT', 'file changed; read the current artifact before editing')
    const normalized = text.replaceAll('\r\n', '\n')
    const oldNormalized = old_string.replaceAll('\r\n', '\n')
    const newNormalized = new_string.replaceAll('\r\n', '\n')
    const pieces = normalized.split(oldNormalized)
    if (!oldNormalized || pieces.length !== 2) fail('EDIT_MATCH_REQUIRED', 'old_string must occur exactly once in the current artifact')
    // Allow for the native provider restoring CRLF; reject before committing a file beyond our read-back budget.
    if (Buffer.byteLength(pieces.join(newNormalized).replaceAll('\n', '\r\n'), 'utf8') > FS_LIMITS.bytes) fail('FS_TOO_LARGE', 'edited text exceeds the artifact byte limit')
    // Revalidate the lexical path after reading; native version CAS covers concurrent native edits.
    const fresh = await this.target(file_path, { signal, write: true })
    if (fresh.targetKey !== target.targetKey) fail('PATH_DENIED', 'file identity changed')
    await this.fs.editText(fresh, { oldString: old_string, newString: new_string, replaceAll: false }, { version: before.version }, signal, policy)
    const current = await this.bytes(file_path, signal)
    return { path: file_path, sha256: sha256(current.bytes), operation: 'update', artifactDirectory: this.artifact }
  }
}

/** Small bounded wildcard language; dynamic programming avoids model-controlled regex backtracking. */
export function globPattern(pattern) {
  if (typeof pattern !== 'string' || !pattern || pattern.length > 256 || /[\\:\x00-\x1f{}\[\]()!]/.test(pattern) || pattern.split('/').some(p => p === '..' || p === '')) fail('PATTERN_DENIED', 'use a relative *, ** or ? wildcard pattern')
  const tokens = []
  for (let index = 0; index < pattern.length; index++) {
    if (pattern[index] !== '*') { tokens.push(pattern[index]); continue }
    let count = 1
    while (pattern[index + 1] === '*') { count++; index++ }
    if (count > 1 && pattern[index + 1] === '/') { tokens.push('segments'); index++ }
    else tokens.push(count > 1 ? 'globstar' : 'star')
  }
  return { test(path) {
    if (path.length > 2048) return false
    let next = new Uint8Array(path.length + 1)
    next[path.length] = 1
    for (let index = tokens.length - 1; index >= 0; index--) {
      const token = tokens[index]
      const current = new Uint8Array(path.length + 1)
      let slashSuffix = 0
      for (let at = path.length; at >= 0; at--) {
        if (token === 'segments') {
          if (path[at] === '/' && next[at + 1]) slashSuffix = 1
          current[at] = next[at] || slashSuffix
        } else if (token === 'star' || token === 'globstar') current[at] = next[at] || (at < path.length && (token === 'globstar' || path[at] !== '/') && current[at + 1]) ? 1 : 0
        else current[at] = at < path.length && (token === '?' ? path[at] !== '/' : token === path[at]) && next[at + 1] ? 1 : 0
      }
      next = current
    }
    return next[0] === 1
  } }
}
