/**
 * Architecture test: Every *.repository.ts in @appfy/core MUST extend BaseRepository.
 *
 * This test reads the file system and verifies that all repository classes
 * follow the project convention of extending BaseRepository for tenant isolation.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

function findFiles(dir: string, pattern: RegExp, results: string[] = []): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry)
    try {
      const stat = statSync(fullPath)
      if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist') {
        findFiles(fullPath, pattern, results)
      } else if (stat.isFile() && pattern.test(entry)) {
        results.push(fullPath)
      }
    } catch {
      // Skip inaccessible files
    }
  }
  return results
}

describe('Architecture: Repository extends BaseRepository', () => {
  // Resolve the core package root relative to this test file's location in the monorepo
  const coreRoot = join(__dirname, '..', '..', '..', 'core', 'src')

  it('should find at least one repository file in @appfy/core', () => {
    const repoFiles = findFiles(coreRoot, /\.repository\.ts$/)
    expect(repoFiles.length).toBeGreaterThan(0)
  })

  it('every *.repository.ts class must extend BaseRepository', () => {
    const repoFiles = findFiles(coreRoot, /\.repository\.ts$/)
    const violations: string[] = []

    for (const file of repoFiles) {
      const content = readFileSync(file, 'utf-8')
      const relativePath = relative(coreRoot, file)

      // Skip the base repository itself
      if (relativePath.includes('base.repository')) continue

      // Check that the file has a class that extends BaseRepository
      const hasExtends = /class\s+\w+\s+extends\s+BaseRepository/.test(content)
      const hasClassDeclaration = /export\s+(abstract\s+)?class\s+\w+/.test(content)

      if (hasClassDeclaration && !hasExtends) {
        violations.push(relativePath)
      }
    }

    expect(
      violations,
      `These repositories do not extend BaseRepository: ${violations.join(', ')}`,
    ).toEqual([])
  })

  it('every repository imports BaseRepository', () => {
    const repoFiles = findFiles(coreRoot, /\.repository\.ts$/)
    const violations: string[] = []

    for (const file of repoFiles) {
      const content = readFileSync(file, 'utf-8')
      const relativePath = relative(coreRoot, file)

      if (relativePath.includes('base.repository')) continue

      const hasImport = /import.*BaseRepository/.test(content)
      const hasClassDeclaration = /export\s+(abstract\s+)?class\s+\w+/.test(content)

      if (hasClassDeclaration && !hasImport) {
        violations.push(relativePath)
      }
    }

    expect(
      violations,
      `These repositories do not import BaseRepository: ${violations.join(', ')}`,
    ).toEqual([])
  })
})
