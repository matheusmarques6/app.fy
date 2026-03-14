export interface AppConfigRow {
  readonly id: string
  readonly tenantId: string
  readonly appName: string | null
  readonly iconUrl: string | null
  readonly splashUrl: string | null
  readonly primaryColor: string | null
  readonly secondaryColor: string | null
  readonly menuItems: unknown
  readonly storeUrl: string | null
  readonly androidPackageName: string | null
  readonly iosBundleId: string | null
  readonly buildStatus: string | null
  readonly lastBuildAt: Date | null
  readonly createdAt: Date
  readonly updatedAt: Date
}

export class AppConfigBuilder {
  private data: AppConfigRow = {
    id: crypto.randomUUID(),
    tenantId: crypto.randomUUID(),
    appName: 'Test App',
    iconUrl: null,
    splashUrl: null,
    primaryColor: '#A855F7',
    secondaryColor: '#0A0A0A',
    menuItems: null,
    storeUrl: null,
    androidPackageName: null,
    iosBundleId: null,
    buildStatus: null,
    lastBuildAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  withId(id: string): this {
    this.data = { ...this.data, id }
    return this
  }

  withTenant(tenantId: string): this {
    this.data = { ...this.data, tenantId }
    return this
  }

  withAppName(appName: string): this {
    this.data = { ...this.data, appName }
    return this
  }

  withIcon(iconUrl: string): this {
    this.data = { ...this.data, iconUrl }
    return this
  }

  withSplash(splashUrl: string): this {
    this.data = { ...this.data, splashUrl }
    return this
  }

  withColors(primary: string, secondary: string): this {
    this.data = { ...this.data, primaryColor: primary, secondaryColor: secondary }
    return this
  }

  withMenuItems(items: unknown): this {
    this.data = { ...this.data, menuItems: items }
    return this
  }

  withStoreUrl(url: string): this {
    this.data = { ...this.data, storeUrl: url }
    return this
  }

  withAndroidPackage(name: string): this {
    this.data = { ...this.data, androidPackageName: name }
    return this
  }

  withIosBundle(id: string): this {
    this.data = { ...this.data, iosBundleId: id }
    return this
  }

  building(): this {
    this.data = { ...this.data, buildStatus: 'building' }
    return this
  }

  ready(): this {
    this.data = { ...this.data, buildStatus: 'ready', lastBuildAt: new Date() }
    return this
  }

  published(): this {
    this.data = { ...this.data, buildStatus: 'published', lastBuildAt: new Date() }
    return this
  }

  build(): AppConfigRow {
    return { ...this.data }
  }
}
