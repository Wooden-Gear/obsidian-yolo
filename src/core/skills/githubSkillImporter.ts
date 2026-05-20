import { requestUrl } from 'obsidian'

import { type FileEntry, parseFrontmatter } from './skillValidation'

// ---------------------------------------------------------------------------
// 唯一保留的边界:单文件大小。其它(深度 / 文件数 / 目录数)由 GitHub 自身的
// Trees API 限制(单次响应最多 10 万条 / 7MB,返回 truncated:true)兜底。
// ---------------------------------------------------------------------------

const MAX_FILE_BYTES = 1 * 1024 * 1024 // 单个文件 1MB

// owner / repo / 分支 / 路径 segment 字符集白名单
// GitHub 限制 owner / repo 仅含 alnum / `-` / `_` / `.`,这里复用
const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/

function isSafePathSegment(seg: string): boolean {
  if (!seg) return false
  if (seg === '.' || seg === '..') return false
  if (/[\\]/.test(seg)) return false
  // 拒绝控制字符 / 文件系统危险字符
  // eslint-disable-next-line no-control-regex -- 显式检查 NUL 与控制字符,正是这里的目的
  if (/[<>:"|?*\x00-\x1f]/.test(seg)) return false
  return true
}

function decodeAndValidatePath(path: string): string | null {
  if (/\\/.test(path)) return null
  let decoded: string
  try {
    decoded = decodeURIComponent(path)
  } catch {
    return null
  }
  // eslint-disable-next-line no-control-regex -- 显式检查控制字符
  if (/\\/.test(decoded) || /[\x00-\x1f]/.test(decoded)) return null
  const segments = decoded.split('/')
  for (const seg of segments) {
    if (!isSafePathSegment(seg)) return null
  }
  return decoded
}

// ---------------------------------------------------------------------------
// URL 解析
// ---------------------------------------------------------------------------

export type GitHubUrlInfo = {
  owner: string
  repo: string
  /** 显式分支(URL 里写了的);裸仓库 URL 推断为 'main',允许 fallback 到 'master' */
  branch: string
  /** branch 是否来自 URL 显式指定;影响 master fallback 行为 */
  branchExplicit: boolean
  /** 文件路径(file 模式) / 子目录路径(repo 模式,可选) */
  path?: string
  type: 'file' | 'repo'
}

const GITHUB_BLOB_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)\/blob\/([^/]+)\/(.+\.md)$/

const GITHUB_TREE_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)\/tree\/([^/]+)\/(.+)$/

const GITHUB_REPO_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(\.git)?$/

function isSafeSegment(seg: string): boolean {
  if (!seg) return false
  if (seg === '.' || seg === '..') return false
  return SEGMENT_PATTERN.test(seg)
}

function validateOwnerRepo(owner: string, repo: string): boolean {
  return isSafeSegment(owner) && isSafeSegment(repo)
}

export function parseGitHubUrl(url: string): GitHubUrlInfo | null {
  const trimmed = url.trim().replace(/\/+$/, '')
  if (!trimmed) return null

  const blobMatch = GITHUB_BLOB_RE.exec(trimmed)
  if (blobMatch) {
    const owner = blobMatch[1]
    const repo = blobMatch[2]
    const branch = blobMatch[3]
    if (!validateOwnerRepo(owner, repo)) return null
    if (!isSafeSegment(branch)) return null
    const safePath = decodeAndValidatePath(blobMatch[4])
    if (!safePath) return null
    return {
      owner,
      repo,
      branch,
      branchExplicit: true,
      path: safePath,
      type: 'file',
    }
  }

  const treeMatch = GITHUB_TREE_RE.exec(trimmed)
  if (treeMatch) {
    const owner = treeMatch[1]
    const repo = treeMatch[2]
    const branch = treeMatch[3]
    if (!validateOwnerRepo(owner, repo)) return null
    if (!isSafeSegment(branch)) return null
    const safePath = decodeAndValidatePath(treeMatch[4])
    if (!safePath) return null
    return {
      owner,
      repo,
      branch,
      branchExplicit: true,
      path: safePath,
      type: 'repo',
    }
  }

  const repoMatch = GITHUB_REPO_RE.exec(trimmed)
  if (repoMatch) {
    const owner = repoMatch[1]
    const repo = repoMatch[2]
    if (!validateOwnerRepo(owner, repo)) return null
    return {
      owner,
      repo,
      branch: 'main',
      branchExplicit: false,
      type: 'repo',
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// 错误类型
// ---------------------------------------------------------------------------

export class GitHubRateLimitError extends Error {
  constructor() {
    super('GitHub API rate limit exceeded')
    this.name = 'GitHubRateLimitError'
  }
}

export class GitHubNotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubNotFoundError'
  }
}

export class GitHubLimitExceededError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GitHubLimitExceededError'
  }
}

// ---------------------------------------------------------------------------
// 底层 HTTP
// ---------------------------------------------------------------------------

function encodePathSegments(path: string): string {
  return path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
}

function buildRawUrl(info: GitHubUrlInfo, filePath: string): string {
  return `https://raw.githubusercontent.com/${encodeURIComponent(info.owner)}/${encodeURIComponent(info.repo)}/${encodeURIComponent(info.branch)}/${encodePathSegments(filePath)}`
}

function isRateLimitResponse(
  status: number,
  headers: Record<string, string> | undefined,
): boolean {
  if (status === 429) return true
  if (status !== 403) return false
  // primary:x-ratelimit-remaining: 0
  const remaining =
    headers?.['x-ratelimit-remaining'] ?? headers?.['X-RateLimit-Remaining']
  if (remaining === '0') return true
  // secondary:retry-after 头存在(GitHub 在 secondary rate limit 下会带 retry-after)
  if (headers?.['retry-after'] ?? headers?.['Retry-After']) return true
  return false
}

/**
 * 抓取 raw 文本,带大小上限。content-length 优先;没有时下载完成后用 byte length 复核。
 */
async function fetchRawText(rawUrl: string): Promise<string> {
  const response = await requestUrl({ url: rawUrl, throw: false })

  if (isRateLimitResponse(response.status, response.headers)) {
    throw new GitHubRateLimitError()
  }
  if (response.status === 404) {
    throw new GitHubNotFoundError(`404: ${rawUrl}`)
  }
  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${rawUrl}`)
  }

  const contentLengthRaw =
    response.headers?.['content-length'] ?? response.headers?.['Content-Length']
  const contentLength = contentLengthRaw ? Number(contentLengthRaw) : NaN
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_BYTES) {
    throw new GitHubLimitExceededError(
      `file exceeds ${MAX_FILE_BYTES} bytes: ${rawUrl}`,
    )
  }

  const text = response.text
  // CDN 可能 gzip,content-length 比解压后小;下载完成后再用 UTF-8 字节复核
  const byteLength = new TextEncoder().encode(text).byteLength
  if (byteLength > MAX_FILE_BYTES) {
    throw new GitHubLimitExceededError(
      `file exceeds ${MAX_FILE_BYTES} bytes: ${rawUrl}`,
    )
  }
  return text
}

// ---------------------------------------------------------------------------
// Git Trees API:一次请求拿整棵树,后续 raw 下载不消耗 API 配额
// ---------------------------------------------------------------------------

type GitTreeEntry = {
  path: string
  /** 100644=file, 100755=executable, 120000=symlink, 040000=dir, 160000=submodule */
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

type GitTreeResponse = {
  sha: string
  tree: GitTreeEntry[]
  truncated: boolean
}

async function fetchRepoTree(info: GitHubUrlInfo): Promise<GitTreeResponse> {
  const ownerSeg = encodeURIComponent(info.owner)
  const repoSeg = encodeURIComponent(info.repo)
  const refSeg = encodeURIComponent(info.branch)
  const apiUrl = `https://api.github.com/repos/${ownerSeg}/${repoSeg}/git/trees/${refSeg}?recursive=1`

  const response = await requestUrl({ url: apiUrl, throw: false })

  if (isRateLimitResponse(response.status, response.headers)) {
    throw new GitHubRateLimitError()
  }
  if (response.status === 403) {
    throw new Error(`HTTP 403: ${apiUrl}`)
  }
  if (response.status === 404 || response.status === 422) {
    // 422 = ref 不存在(GitHub Trees API 对未知 ref 返回 422)
    throw new GitHubNotFoundError(`ref not found: ${info.branch}`)
  }
  if (response.status >= 400) {
    throw new Error(`HTTP ${response.status}: ${apiUrl}`)
  }
  const body = response.json as GitTreeResponse | null
  if (!body || !Array.isArray(body.tree)) {
    throw new Error(`Unexpected GitHub API response: ${apiUrl}`)
  }
  return body
}

// ---------------------------------------------------------------------------
// 公共入口
// ---------------------------------------------------------------------------

export type GitHubFetchResult = {
  files: FileEntry[]
  /** 显示用源名 */
  sourceName: string
  /** 目录模式 = frontmatter.name;单文件模式 = 源文件名 */
  targetName: string
  isDirectory: boolean
}

export async function fetchGitHubSkill(
  url: string,
): Promise<GitHubFetchResult> {
  const info = parseGitHubUrl(url)
  if (!info) {
    throw new Error('Invalid GitHub URL')
  }

  if (info.type === 'file') {
    const filePath = info.path!
    const content = await fetchRawText(buildRawUrl(info, filePath))
    const fileName = filePath.split('/').pop() ?? filePath
    return {
      files: [{ relativePath: fileName, content }],
      sourceName: fileName,
      targetName: fileName,
      isDirectory: false,
    }
  }

  // ---- repo / tree 模式 ----
  const dirPath = info.path ?? ''
  const skillMdPath = dirPath ? `${dirPath}/SKILL.md` : 'SKILL.md'

  // 1. 拿整棵 tree(允许裸仓库 URL 时 main → master fallback)
  let tree: GitTreeResponse
  let effectiveInfo = info
  try {
    tree = await fetchRepoTree(info)
  } catch (err) {
    if (
      err instanceof GitHubNotFoundError &&
      !info.branchExplicit &&
      info.branch === 'main'
    ) {
      effectiveInfo = { ...info, branch: 'master' }
      tree = await fetchRepoTree(effectiveInfo)
    } else {
      throw err
    }
  }

  if (tree.truncated) {
    throw new GitHubLimitExceededError(
      'repository tree exceeds GitHub single-response limit (truncated)',
    )
  }

  // 2. 在 tree 里定位 SKILL.md
  const skillMdEntry = tree.tree.find(
    (e) => e.type === 'blob' && e.path === skillMdPath,
  )
  if (!skillMdEntry) {
    throw new GitHubNotFoundError('SKILL.md not found at the specified path')
  }

  // 3. 收集 skill 子树下所有 blob(过滤 symlink / submodule)
  const subtreePrefix = dirPath ? `${dirPath}/` : ''
  const blobs = tree.tree.filter((e) => {
    if (e.type !== 'blob') return false // 排除 tree / commit(submodule)
    if (e.mode === '120000') return false // 排除 symlink
    if (dirPath === '') return true
    return e.path === skillMdPath || e.path.startsWith(subtreePrefix)
  })

  // 4. 串行下载每个 blob 的 raw 内容,组装相对路径
  const files: FileEntry[] = []
  let skillMdContent = ''
  for (const blob of blobs) {
    // 提前用 tree 元数据里的 size 拦掉超大文件,省一次完整下载
    if (typeof blob.size === 'number' && blob.size > MAX_FILE_BYTES) {
      throw new GitHubLimitExceededError(
        `file exceeds ${MAX_FILE_BYTES} bytes: ${blob.path}`,
      )
    }
    const relativePath = dirPath
      ? blob.path.slice(subtreePrefix.length)
      : blob.path
    const content = await fetchRawText(buildRawUrl(effectiveInfo, blob.path))
    files.push({ relativePath, content })
    if (blob.path === skillMdPath) skillMdContent = content
  }

  // targetName 来自 frontmatter.name,fallback 到 dirPath 末段 / 仓库名
  const fm = parseFrontmatter(skillMdContent)
  const fmName =
    typeof fm?.name === 'string' && fm.name.trim().length > 0
      ? fm.name.trim()
      : null
  const fallbackName = dirPath
    ? (dirPath.split('/').pop() ?? info.repo)
    : info.repo
  const targetName = fmName ?? fallbackName

  return {
    files,
    sourceName: dirPath ? (dirPath.split('/').pop() ?? info.repo) : info.repo,
    targetName,
    isDirectory: true,
  }
}
