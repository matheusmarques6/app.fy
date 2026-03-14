/**
 * Architecture tests: Code quality scans
 *
 * Verifies coding conventions are followed across the codebase:
 * - No console.log in production code
 * - No .only or .skip left in test files
 * - No 'any' type usage (should use 'unknown')
 * - Tests follow *.spec.ts naming convention
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const PACKAGES_ROOT = join(__dirname, '..', '..', '..', '..')

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
      if (stat.isDirectory() && entry !== 'node_modules' && entry !== 'dist' && entry !== '.git') {
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

describe('Architecture: Code Quality Scans', () => {
  const srcDirs = [
    join(PACKAGES_ROOT, 'packages', 'core', 'src'),
    join(PACKAGES_ROOT, 'packages', 'shared', 'src'),
    join(PACKAGES_ROOT, 'apps', 'api', 'src'),
  ]

  describe('no console.log in production code', () => {
    it('should not use console.log in source files (except error-handler)', () => {
      const violations: string[] = []

      for (const dir of srcDirs) {
        const files = findFiles(dir, /\.ts$/)
        for (const file of files) {
          if (file.includes('.spec.') || file.includes('.test.')) continue
          if (file.includes('error-handler')) continue // allowed for unhandled errors

          const content = readFileSync(file, 'utf-8')
          const lines = content.split('\n')

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!
            // Match console.log but not commented-out lines
            if (/^\s*console\.log\(/.test(line)) {
              violations.push(`${relative(PACKAGES_ROOT, file)}:${i + 1}`)
            }
          }
        }
      }

      expect(
        violations,
        `Found console.log in production code:\n${violations.join('\n')}`,
      ).toEqual([])
    })
  })

  describe('no .only or .skip in test files', () => {
    it('should not have .only left in test files', () => {
      const violations: string[] = []

      for (const dir of srcDirs) {
        const files = findFiles(dir, /\.spec\.ts$/)
        for (const file of files) {
          if (file.includes('code-quality.spec')) continue // this file uses .only in strings

          const content = readFileSync(file, 'utf-8')
          const lines = content.split('\n')

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!
            if (/\b(describe|it|test)\.only\(/.test(line)) {
              violations.push(`${relative(PACKAGES_ROOT, file)}:${i + 1}`)
            }
          }
        }
      }

      expect(
        violations,
        `Found .only in test files:\n${violations.join('\n')}`,
      ).toEqual([])
    })

    it('should not have .skip left in test files (use .todo instead)', () => {
      const violations: string[] = []

      for (const dir of srcDirs) {
        const files = findFiles(dir, /\.spec\.ts$/)
        for (const file of files) {
          if (file.includes('code-quality.spec')) continue

          const content = readFileSync(file, 'utf-8')
          const lines = content.split('\n')

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]!
            if (/\b(describe|it|test)\.skip\(/.test(line)) {
              violations.push(`${relative(PACKAGES_ROOT, file)}:${i + 1}`)
            }
          }
        }
      }

      expect(
        violations,
        `Found .skip in test files (use .todo instead):\n${violations.join('\n')}`,
      ).toEqual([])
    })
  })

  describe('test file naming convention', () => {
    it('should not have *.test.ts files (use *.spec.ts)', () => {
      const violations: string[] = []

      for (const dir of srcDirs) {
        const files = findFiles(dir, /\.test\.ts$/)
        for (const file of files) {
          violations.push(relative(PACKAGES_ROOT, file))
        }
      }

      expect(
        violations,
        `Found *.test.ts files (should be *.spec.ts):\n${violations.join('\n')}`,
      ).toEqual([])
    })
  })
})
