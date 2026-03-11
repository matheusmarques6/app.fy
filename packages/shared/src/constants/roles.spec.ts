import { describe, expect, it } from 'vitest'

import { membershipRoles, rolePermissions } from './roles.js'

describe('roles', () => {
  it('should have 3 membership roles', () => {
    expect(membershipRoles).toEqual(['owner', 'editor', 'viewer'])
  })

  it('viewer should be read-only', () => {
    const { read, write, ...rest } = rolePermissions.viewer
    expect(read).toBe(true)
    expect(write).toBe(false)
    expect(Object.values(rest).every((v) => v === false)).toBe(true)
  })

  it('editor should not have delete, billing, or members access', () => {
    expect(rolePermissions.editor.read).toBe(true)
    expect(rolePermissions.editor.write).toBe(true)
    expect(rolePermissions.editor.delete).toBe(false)
    expect(rolePermissions.editor.billing).toBe(false)
    expect(rolePermissions.editor.members).toBe(false)
  })

  it('owner should have total access', () => {
    expect(Object.values(rolePermissions.owner).every((v) => v === true)).toBe(true)
  })
})
