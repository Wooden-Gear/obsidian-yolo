import { minimatch } from 'minimatch'
import { TFile, Vault } from 'obsidian'

export const findFilesMatchingPatterns = (
  patterns: string[],
  vault: Vault,
): Promise<TFile[]> => {
  const files = vault.getMarkdownFiles()
  const matchedFiles = files.filter((file) => {
    return patterns.some((pattern) => minimatch(file.path, pattern))
  })
  return Promise.resolve(matchedFiles)
}
