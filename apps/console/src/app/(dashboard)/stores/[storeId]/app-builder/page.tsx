'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Smartphone,
  Upload,
  Palette,
  Image,
  Sun,
  Moon,
  Home,
  Search,
  Heart,
  ShoppingBag,
  User,
  AlertCircle,
  Link,
  Store,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { appsApi, integrationsApi, App, StorePreview } from '@/lib/api-client';

// Template definitions
const templates = [
  {
    id: 'classic',
    name: 'Classic',
    category: 'Geral',
    description: 'Layout clássico com banner e grid de produtos',
  },
  {
    id: 'modern',
    name: 'Modern',
    category: 'Geral',
    description: 'Design moderno com cards e animações suaves',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    category: 'Geral',
    description: 'Layout limpo e minimalista',
  },
  {
    id: 'fashion',
    name: 'Fashion',
    category: 'Moda',
    description: 'Ideal para lojas de moda e acessórios',
  },
  {
    id: 'tech',
    name: 'Tech',
    category: 'Digital',
    description: 'Perfeito para eletrônicos e tecnologia',
  },
  {
    id: 'food',
    name: 'Food',
    category: 'Alimentos',
    description: 'Otimizado para delivery e restaurantes',
  },
];

const categories = ['Geral', 'Moda', 'Digital', 'Alimentos', 'Saúde', 'Beleza'];

const fonts = [
  { id: 'inter', name: 'Inter', family: 'Inter, sans-serif' },
  { id: 'roboto', name: 'Roboto', family: 'Roboto, sans-serif' },
  { id: 'lato', name: 'Lato', family: 'Lato, sans-serif' },
  { id: 'poppins', name: 'Poppins', family: 'Poppins, sans-serif' },
  { id: 'opensans', name: 'Open Sans', family: '"Open Sans", sans-serif' },
  { id: 'montserrat', name: 'Montserrat', family: 'Montserrat, sans-serif' },
];

interface AppConfig {
  template: string;
  name: string;
  description: string;
  logoLight: string | null;
  logoDark: string | null;
  primaryColor: string;
  theme: 'light' | 'dark';
  headerFont: string;
  bodyFont: string;
}

const defaultConfig: AppConfig = {
  template: 'classic',
  name: '',
  description: '',
  logoLight: null,
  logoDark: null,
  primaryColor: '#3B82F6',
  theme: 'light',
  headerFont: 'inter',
  bodyFont: 'roboto',
};

export default function AppBuilderPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const router = useRouter();
  const storeId = params.storeId as string;
  const { currentStore } = useAppStore();

  // State
  const [step, setStep] = useState(0); // 0 = onboarding, 1-4 = wizard steps
  const [config, setConfig] = useState<AppConfig>({
    ...defaultConfig,
    name: currentStore?.name || '',
  });
  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('Geral');

  // Integration & store preview state
  const [integrationStatus, setIntegrationStatus] = useState<{
    connected: boolean;
    platform?: string;
    shopDomain?: string;
    shopName?: string;
  } | null>(null);
  const [storePreview, setStorePreview] = useState<StorePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const steps = [
    { id: 0, name: 'Sua Loja', icon: Store },
    { id: 1, name: 'Template', icon: Image },
    { id: 2, name: 'Informações', icon: Smartphone },
    { id: 3, name: 'Cores e Fonte', icon: Palette },
    { id: 4, name: 'Criar App', icon: Check },
  ];

  // Load existing app and integration status
  useEffect(() => {
    const loadData = async () => {
      if (!accessToken || !storeId) return;

      try {
        setLoading(true);

        // Load integration status
        const status = await appsApi.getIntegrationStatus(accessToken!, storeId);
        setIntegrationStatus(status);

        // Load existing app
        const apps = await appsApi.list(accessToken!, storeId);
        if (apps.length > 0) {
          setApp(apps[0]);
          const existingConfig = apps[0].config as Record<string, unknown>;
          if (existingConfig) {
            setConfig({
              template: (existingConfig.template as string) || 'classic',
              name: apps[0].name || currentStore?.name || '',
              description: (existingConfig.description as string) || '',
              logoLight: (existingConfig.logoLight as string) || null,
              logoDark: (existingConfig.logoDark as string) || null,
              primaryColor: (existingConfig.theme as { primary_color?: string })?.primary_color || '#3B82F6',
              theme: (existingConfig.themeMode as 'light' | 'dark') || 'light',
              headerFont: (existingConfig.headerFont as string) || 'inter',
              bodyFont: (existingConfig.bodyFont as string) || 'roboto',
            });
          }
        }

        // If connected, load store preview
        if (status?.connected && status.platform === 'shopify') {
          setLoadingPreview(true);
          try {
            const preview = await integrationsApi.getShopifyPreview(accessToken!, storeId);
            setStorePreview(preview);

            // Auto-fill name from store if not set
            if (preview.shop?.name && !config.name) {
              setConfig(prev => ({ ...prev, name: preview.shop!.name }));
            }
          } catch (err) {
            console.error('Failed to load store preview:', err);
          } finally {
            setLoadingPreview(false);
          }
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [accessToken, storeId, currentStore?.name]);

  // Update config when store changes
  useEffect(() => {
    if (currentStore?.name && !config.name) {
      setConfig(prev => ({ ...prev, name: currentStore.name }));
    }
  }, [currentStore?.name, config.name]);

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleCreateApp = async () => {
    if (!accessToken || !storeId) return;

    try {
      setCreating(true);
      setError(null);

      const appConfig = {
        template: config.template,
        description: config.description,
        logoLight: config.logoLight,
        logoDark: config.logoDark,
        theme: {
          primary_color: config.primaryColor,
        },
        themeMode: config.theme,
        headerFont: config.headerFont,
        bodyFont: config.bodyFont,
        tabs: ['home', 'categories', 'search', 'cart', 'account'],
      };

      if (app) {
        const updated = await appsApi.update(accessToken!, storeId, app.id, {
          name: config.name,
          config: appConfig,
        });
        setApp(updated);
      } else {
        const newApp = await appsApi.create(accessToken!, storeId, config.name);
        const updated = await appsApi.update(accessToken!, storeId, newApp.id, {
          config: appConfig,
        });
        setApp(updated);
      }

      router.push(`/stores/${storeId}/app-builder/preview`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar aplicativo');
    } finally {
      setCreating(false);
    }
  };

  const handleFileUpload = (type: 'logoLight' | 'logoDark') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setConfig(prev => ({ ...prev, [type]: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  // Not connected - show connection required screen
  if (!integrationStatus?.connected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-lg text-center">
          <div className="w-20 h-20 bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="text-yellow-500" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">
            Conecte sua loja primeiro
          </h1>
          <p className="text-gray-400 mb-6">
            Para criar o aplicativo, precisamos acessar os dados da sua loja
            (produtos, logo, categorias). Conecte sua plataforma de e-commerce para continuar.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push(`/stores/${storeId}/settings?tab=integrations`)}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Link size={20} />
              Conectar Loja
            </button>
            <button
              onClick={() => router.back()}
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header with Steps */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-center gap-4 overflow-x-auto">
            {steps.map((s, index) => (
              <div key={s.id} className="flex items-center">
                <button
                  onClick={() => setStep(s.id)}
                  className={`flex flex-col items-center gap-2 ${
                    step >= s.id ? 'text-blue-500' : 'text-gray-500'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      step > s.id
                        ? 'bg-blue-600 text-white'
                        : step === s.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400'
                    }`}
                  >
                    {step > s.id ? <Check size={20} /> : <s.icon size={20} />}
                  </div>
                  <span className="text-xs font-medium whitespace-nowrap">{s.name}</span>
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`w-12 h-0.5 mx-2 ${
                      step > s.id ? 'bg-blue-600' : 'bg-gray-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Side - Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step 0: Onboarding - Your Store Preview */}
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Sua Loja</h2>
                  <p className="text-gray-400 mt-1">
                    Veja como sua loja está e como ficará no aplicativo
                  </p>
                </div>

                {loadingPreview ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-blue-500" size={32} />
                  </div>
                ) : (
                  <>
                    {/* Store Info Card */}
                    <div className="bg-gray-900 rounded-xl p-6">
                      <div className="flex items-center gap-4 mb-6">
                        {storePreview?.shop?.logo ? (
                          <img
                            src={storePreview.shop.logo}
                            alt="Store Logo"
                            className="w-16 h-16 rounded-xl object-contain bg-white p-2"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center">
                            <Store className="text-gray-500" size={32} />
                          </div>
                        )}
                        <div>
                          <h3 className="text-xl font-semibold text-white">
                            {storePreview?.shop?.name || integrationStatus?.shopName || currentStore?.name}
                          </h3>
                          <p className="text-gray-400 text-sm">
                            {storePreview?.shop?.domain || integrationStatus?.shopDomain}
                          </p>
                          <span className="inline-flex items-center gap-1 mt-1 text-green-400 text-xs">
                            <Check size={12} />
                            Conectado via {integrationStatus?.platform}
                          </span>
                        </div>
                      </div>

                      {/* Products Preview */}
                      {storePreview?.products && storePreview.products.length > 0 ? (
                        <>
                          <h4 className="text-sm font-medium text-gray-300 mb-3">
                            Seus Produtos ({storePreview.products.length})
                          </h4>
                          <div className="grid grid-cols-4 gap-3">
                            {storePreview.products.slice(0, 8).map((product) => (
                              <div
                                key={product.id}
                                className="bg-gray-800 rounded-lg overflow-hidden"
                              >
                                {product.image ? (
                                  <img
                                    src={product.image}
                                    alt={product.title}
                                    className="w-full aspect-square object-cover"
                                  />
                                ) : (
                                  <div className="w-full aspect-square bg-gray-700 flex items-center justify-center">
                                    <ShoppingBag className="text-gray-500" size={24} />
                                  </div>
                                )}
                                <div className="p-2">
                                  <p className="text-white text-xs truncate">{product.title}</p>
                                  <p className="text-gray-400 text-xs">
                                    {product.currency} {product.price}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <ShoppingBag className="mx-auto mb-2" size={32} />
                          <p>Nenhum produto encontrado</p>
                        </div>
                      )}
                    </div>

                    {/* App Preview Teaser */}
                    <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-800/50 rounded-xl p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                          <Sparkles className="text-blue-400" size={24} />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">
                            Pronto para criar seu app!
                          </h3>
                          <p className="text-gray-300 text-sm mt-1">
                            Seus produtos serão automaticamente sincronizados com o aplicativo.
                            Escolha um template, personalize as cores e seu app estará pronto.
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 1: Template Selection */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Selecione o modelo</h2>
                  <p className="text-gray-400 mt-1">
                    Escolha um template que combine com seu negócio
                  </p>
                </div>

                {/* Category Tabs */}
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedCategory === cat
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Template Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {templates
                    .filter((t) => selectedCategory === 'Geral' || t.category === selectedCategory)
                    .map((template) => (
                      <button
                        key={template.id}
                        onClick={() => setConfig((prev) => ({ ...prev, template: template.id }))}
                        className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                          config.template === template.id
                            ? 'border-blue-500 ring-2 ring-blue-500/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <div className="aspect-[9/16] bg-gray-800 flex items-center justify-center">
                          <div className="text-center p-4">
                            <Smartphone className="mx-auto text-gray-600 mb-2" size={32} />
                            <span className="text-sm text-gray-400">{template.name}</span>
                          </div>
                        </div>
                        {config.template === template.id && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                            <Check size={14} className="text-white" />
                          </div>
                        )}
                        <div className="p-3 bg-gray-900">
                          <p className="text-white font-medium text-sm">{template.name}</p>
                          <p className="text-gray-500 text-xs">{template.description}</p>
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {/* Step 2: App Info */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Informações do aplicativo</h2>
                  <p className="text-gray-400 mt-1">
                    Configure as informações básicas do seu app
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Nome do Aplicativo
                    </label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => setConfig((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Digite o nome do seu aplicativo"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Descrição curta
                    </label>
                    <textarea
                      value={config.description}
                      onChange={(e) => setConfig((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="Uma breve descrição do seu aplicativo"
                      rows={3}
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    {/* Logo Light */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Logo (Tema Claro)
                      </label>
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors bg-gray-800/50">
                        {config.logoLight ? (
                          <img
                            src={config.logoLight}
                            alt="Logo Light"
                            className="max-h-32 object-contain"
                          />
                        ) : (
                          <div className="text-center">
                            <Upload className="mx-auto text-gray-500 mb-2" size={24} />
                            <p className="text-sm text-gray-400">Arraste ou clique</p>
                            <p className="text-xs text-gray-500">PNG, JPG, SVG</p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload('logoLight')}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Logo Dark */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Logo (Tema Escuro)
                      </label>
                      <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-700 rounded-lg cursor-pointer hover:border-gray-600 transition-colors bg-gray-800/50">
                        {config.logoDark ? (
                          <img
                            src={config.logoDark}
                            alt="Logo Dark"
                            className="max-h-32 object-contain"
                          />
                        ) : (
                          <div className="text-center">
                            <Upload className="mx-auto text-gray-500 mb-2" size={24} />
                            <p className="text-sm text-gray-400">Arraste ou clique</p>
                            <p className="text-xs text-gray-500">PNG, JPG, SVG</p>
                          </div>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload('logoDark')}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Colors & Fonts */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Cores e Fontes</h2>
                  <p className="text-gray-400 mt-1">
                    Personalize a aparência do seu aplicativo
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Primary Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Cor Principal
                    </label>
                    <div className="flex items-center gap-4">
                      <input
                        type="color"
                        value={config.primaryColor}
                        onChange={(e) => setConfig((prev) => ({ ...prev, primaryColor: e.target.value }))}
                        className="w-16 h-16 rounded-lg cursor-pointer border-0"
                      />
                      <div className="flex gap-2">
                        {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'].map(
                          (color) => (
                            <button
                              key={color}
                              onClick={() => setConfig((prev) => ({ ...prev, primaryColor: color }))}
                              className={`w-10 h-10 rounded-full border-2 transition-all ${
                                config.primaryColor === color
                                  ? 'border-white scale-110'
                                  : 'border-transparent'
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          )
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Theme Mode */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Tema Padrão
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setConfig((prev) => ({ ...prev, theme: 'light' }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          config.theme === 'light'
                            ? 'border-blue-500 bg-white'
                            : 'border-gray-700 bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Sun className="text-yellow-500" size={24} />
                          <span className="font-medium text-gray-900">Claro</span>
                        </div>
                      </button>
                      <button
                        onClick={() => setConfig((prev) => ({ ...prev, theme: 'dark' }))}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          config.theme === 'dark'
                            ? 'border-blue-500 bg-gray-900'
                            : 'border-gray-700 bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Moon className="text-blue-400" size={24} />
                          <span className="font-medium text-white">Escuro</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Fonts */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Fonte do Cabeçalho
                      </label>
                      <select
                        value={config.headerFont}
                        onChange={(e) => setConfig((prev) => ({ ...prev, headerFont: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        {fonts.map((font) => (
                          <option key={font.id} value={font.id}>
                            {font.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Fonte do Corpo
                      </label>
                      <select
                        value={config.bodyFont}
                        onChange={(e) => setConfig((prev) => ({ ...prev, bodyFont: e.target.value }))}
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        {fonts.map((font) => (
                          <option key={font.id} value={font.id}>
                            {font.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review & Create */}
            {step === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Revisar e Criar</h2>
                  <p className="text-gray-400 mt-1">
                    Confira as configurações do seu aplicativo
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
                    {error}
                  </div>
                )}

                <div className="bg-gray-900 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between py-3 border-b border-gray-800">
                    <span className="text-gray-400">Template</span>
                    <span className="text-white font-medium capitalize">{config.template}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-800">
                    <span className="text-gray-400">Nome</span>
                    <span className="text-white font-medium">{config.name || '(não definido)'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-800">
                    <span className="text-gray-400">Cor Principal</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full"
                        style={{ backgroundColor: config.primaryColor }}
                      />
                      <span className="text-white font-medium">{config.primaryColor}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-800">
                    <span className="text-gray-400">Tema</span>
                    <span className="text-white font-medium capitalize">{config.theme === 'light' ? 'Claro' : 'Escuro'}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 border-b border-gray-800">
                    <span className="text-gray-400">Fonte Cabeçalho</span>
                    <span className="text-white font-medium capitalize">{config.headerFont}</span>
                  </div>
                  <div className="flex items-center justify-between py-3">
                    <span className="text-gray-400">Fonte Corpo</span>
                    <span className="text-white font-medium capitalize">{config.bodyFont}</span>
                  </div>
                </div>

                <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Check className="text-blue-400 mt-0.5" size={20} />
                    <div>
                      <p className="text-blue-300 font-medium">Pronto para criar!</p>
                      <p className="text-blue-400/70 text-sm mt-1">
                        O aplicativo será configurado automaticamente com integração à sua loja,
                        push notifications e sincronização de produtos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-6 border-t border-gray-800">
              <button
                onClick={handleBack}
                disabled={step === 0}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                  step === 0
                    ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                    : 'bg-gray-800 text-white hover:bg-gray-700'
                }`}
              >
                <ChevronLeft size={20} />
                Voltar
              </button>

              {step < 4 ? (
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Próximo
                  <ChevronRight size={20} />
                </button>
              ) : (
                <button
                  onClick={handleCreateApp}
                  disabled={creating || !config.name}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Check size={20} />
                      Criar Aplicativo
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Right Side - Preview */}
          <div className="hidden lg:block">
            <div className="sticky top-8">
              <div className="bg-gray-900 rounded-2xl p-4">
                {/* Phone Frame */}
                <div className="relative mx-auto w-[280px]">
                  {/* Phone Bezel */}
                  <div className="bg-gray-800 rounded-[2.5rem] p-2">
                    {/* Screen */}
                    <div
                      className={`rounded-[2rem] overflow-hidden ${
                        config.theme === 'dark' ? 'bg-gray-900' : 'bg-white'
                      }`}
                      style={{ aspectRatio: '9/19' }}
                    >
                      {/* Status Bar */}
                      <div className={`flex justify-between items-center px-6 py-2 text-xs ${
                        config.theme === 'dark' ? 'text-white' : 'text-black'
                      }`}>
                        <span>21:06</span>
                        <div className="flex items-center gap-1">
                          <span>5G</span>
                          <span>100%</span>
                        </div>
                      </div>

                      {/* App Header */}
                      <div className={`px-4 py-3 flex items-center justify-between ${
                        config.theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                      }`}>
                        {config.logoLight || config.logoDark ? (
                          <img
                            src={(config.theme === 'dark' ? config.logoDark || config.logoLight : config.logoLight || config.logoDark) ?? undefined}
                            alt="Logo"
                            className="h-6 object-contain"
                          />
                        ) : (
                          <span
                            className="font-semibold"
                            style={{ color: config.primaryColor }}
                          >
                            {config.name || storePreview?.shop?.name || 'Minha Loja'}
                          </span>
                        )}
                        <Search size={20} className={config.theme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
                      </div>

                      {/* Content Preview with Real Products */}
                      <div className="p-4 space-y-3">
                        {/* Banner */}
                        <div
                          className="h-24 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: config.primaryColor }}
                        >
                          <span className="text-white font-medium text-sm">Banner Promocional</span>
                        </div>

                        {/* Categories */}
                        <div className="flex gap-2 overflow-x-auto py-2">
                          {['Todos', 'Novos', 'Promoção'].map((cat) => (
                            <div
                              key={cat}
                              className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${
                                cat === 'Todos'
                                  ? 'text-white'
                                  : config.theme === 'dark'
                                  ? 'bg-gray-700 text-gray-300'
                                  : 'bg-gray-100 text-gray-600'
                              }`}
                              style={cat === 'Todos' ? { backgroundColor: config.primaryColor } : {}}
                            >
                              {cat}
                            </div>
                          ))}
                        </div>

                        {/* Products Grid - Use real products if available */}
                        <div className="grid grid-cols-2 gap-2">
                          {(storePreview?.products?.slice(0, 4) || [1, 2, 3, 4]).map((product, i) => (
                            <div
                              key={typeof product === 'object' ? product.id : i}
                              className={`rounded-lg overflow-hidden ${
                                config.theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                              }`}
                            >
                              {typeof product === 'object' && product.image ? (
                                <img
                                  src={product.image}
                                  alt={product.title}
                                  className="w-full aspect-square object-cover"
                                />
                              ) : (
                                <div className="aspect-square bg-gray-300" />
                              )}
                              <div className="p-2">
                                {typeof product === 'object' ? (
                                  <>
                                    <p className={`text-xs truncate ${config.theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                                      {product.title}
                                    </p>
                                    <p className="text-xs" style={{ color: config.primaryColor }}>
                                      {product.currency} {product.price}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <div className={`h-2 w-16 rounded ${
                                      config.theme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                                    }`} />
                                    <div
                                      className="h-2 w-10 rounded mt-1"
                                      style={{ backgroundColor: config.primaryColor, opacity: 0.7 }}
                                    />
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Bottom Navigation */}
                      <div className={`absolute bottom-0 left-0 right-0 flex justify-around py-3 border-t ${
                        config.theme === 'dark'
                          ? 'bg-gray-800 border-gray-700'
                          : 'bg-white border-gray-200'
                      }`}>
                        <Home size={20} style={{ color: config.primaryColor }} />
                        <Search size={20} className={config.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                        <Heart size={20} className={config.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                        <ShoppingBag size={20} className={config.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                        <User size={20} className={config.theme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Controls */}
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, theme: 'light' }))}
                    className={`p-2 rounded-lg transition-colors ${
                      config.theme === 'light'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Sun size={18} />
                  </button>
                  <button
                    onClick={() => setConfig((prev) => ({ ...prev, theme: 'dark' }))}
                    className={`p-2 rounded-lg transition-colors ${
                      config.theme === 'dark'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Moon size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
