import { describe, expect, it } from 'vitest'
import { SpyBase } from '../spy-base.js'
import { NotificationRepositorySpy } from '../notification-repository.spy.js'
import { PushProviderSpy } from '../push-provider.spy.js'
import { BullMQSpy } from '../bullmq.spy.js'
import { CacheSpy } from '../cache.spy.js'

describe('SpyBase', () => {
  function makeSut() {
    class TestSpy extends SpyBase {
      doSomething(arg: string) {
        this.trackCall('doSomething', [arg])
      }
    }
    return new TestSpy()
  }

  it('tracks call count', () => {
    const sut = makeSut()
    expect(sut.callCount('doSomething')).toBe(0)
    sut.doSomething('a')
    expect(sut.callCount('doSomething')).toBe(1)
    sut.doSomething('b')
    expect(sut.callCount('doSomething')).toBe(2)
  })

  it('captures last call args', () => {
    const sut = makeSut()
    sut.doSomething('hello')
    expect(sut.lastCallArgs('doSomething')).toEqual(['hello'])
    sut.doSomething('world')
    expect(sut.lastCallArgs('doSomething')).toEqual(['world'])
  })

  it('wasCalled returns correct boolean', () => {
    const sut = makeSut()
    expect(sut.wasCalled('doSomething')).toBe(false)
    sut.doSomething('x')
    expect(sut.wasCalled('doSomething')).toBe(true)
  })

  it('returns 0 / empty for uncalled methods', () => {
    const sut = makeSut()
    expect(sut.callCount('nonexistent')).toBe(0)
    expect(sut.lastCallArgs('nonexistent')).toEqual([])
    expect(sut.wasCalled('nonexistent')).toBe(false)
  })

  it('reset clears all tracking', () => {
    const sut = makeSut()
    sut.doSomething('a')
    sut.doSomething('b')
    expect(sut.callCount('doSomething')).toBe(2)
    sut.reset()
    expect(sut.callCount('doSomething')).toBe(0)
    expect(sut.wasCalled('doSomething')).toBe(false)
  })
})

describe('NotificationRepositorySpy', () => {
  it('tracks create calls', async () => {
    const spy = new NotificationRepositorySpy()
    await spy.create('tenant-1', { title: 'Test', body: 'Body', type: 'manual' })
    expect(spy.callCount('create')).toBe(1)
    expect(spy.lastCallArgs('create')[0]).toBe('tenant-1')
  })

  it('tracks findById calls', async () => {
    const spy = new NotificationRepositorySpy()
    await spy.findById('tenant-1', 'id-1')
    expect(spy.callCount('findById')).toBe(1)
    expect(spy.lastCallArgs('findById')).toEqual(['tenant-1', 'id-1'])
  })

  it('returns configured result', async () => {
    const spy = new NotificationRepositorySpy()
    spy.result = undefined
    const result = await spy.findById('tenant-1', 'id-1')
    expect(result).toBeUndefined()
  })
})

describe('PushProviderSpy', () => {
  it('tracks sendNotification calls', async () => {
    const spy = new PushProviderSpy()
    // PushNotificationPayload type from @appfy/core
    await spy.sendNotification('app-1', {
      title: 'Test',
      body: 'Body',
      tokens: ['token-1'],
    } as never)
    expect(spy.callCount('sendNotification')).toBe(1)
    expect(spy.lastCallArgs('sendNotification')[0]).toBe('app-1')
  })

  it('can simulate failures', async () => {
    const spy = new PushProviderSpy()
    spy.shouldFail = true
    await expect(spy.sendNotification('app-1', {} as never)).rejects.toThrow(
      'Push provider test failure',
    )
  })

  it('tracks createApp calls', async () => {
    const spy = new PushProviderSpy()
    const result = await spy.createApp({} as never)
    expect(result.appId).toBe('test-app-id')
    expect(spy.callCount('createApp')).toBe(1)
  })
})

describe('BullMQSpy', () => {
  it('tracks add calls with delay', async () => {
    const spy = new BullMQSpy()
    await spy.add('test-job', { data: 1 }, { delay: 5000 })
    expect(spy.callCount('add')).toBe(1)
    expect(spy.getJobs()).toHaveLength(1)
    const job = spy.getJobs()[0]
    expect(job).toBeDefined()
    expect(job?.opts?.delay).toBe(5000)
  })

  it('getJobsByName filters correctly', async () => {
    const spy = new BullMQSpy()
    await spy.add('push', { a: 1 })
    await spy.add('ingest', { b: 2 })
    await spy.add('push', { c: 3 })
    expect(spy.getJobsByName('push')).toHaveLength(2)
    expect(spy.getJobsByName('ingest')).toHaveLength(1)
  })

  it('reset clears jobs', async () => {
    const spy = new BullMQSpy()
    await spy.add('test', { x: 1 })
    spy.reset()
    expect(spy.getJobs()).toHaveLength(0)
    expect(spy.callCount('add')).toBe(0)
  })
})

describe('CacheSpy', () => {
  it('tracks get/set calls', async () => {
    const spy = new CacheSpy()
    await spy.set('key', 'value', 60)
    expect(spy.callCount('set')).toBe(1)
    const result = await spy.get('key')
    expect(spy.callCount('get')).toBe(1)
    expect(result).toBe('value')
  })

  it('returns null for missing keys', async () => {
    const spy = new CacheSpy()
    const result = await spy.get('nonexistent')
    expect(result).toBeNull()
  })

  it('del removes key', async () => {
    const spy = new CacheSpy()
    await spy.set('key', 'value')
    await spy.del('key')
    const result = await spy.get('key')
    expect(result).toBeNull()
  })

  it('reset clears store and counters', async () => {
    const spy = new CacheSpy()
    await spy.set('key', 'value')
    spy.reset()
    expect(spy.size()).toBe(0)
    expect(spy.callCount('set')).toBe(0)
  })
})
