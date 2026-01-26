'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Check,
  ChevronLeft,
  Loader2,
  Smartphone,
  Download,
  Settings,
  Rocket,
  Home,
  Search,
  Heart,
  ShoppingBag,
  User,
  Sun,
  Moon,
} from 'lucide-react';
import { appsApi, App } from '@/lib/api-client';

export default function AppPreviewPage() {
  const { data: session } = useSession();
  const params = useParams();
  const router = useRouter();
  const storeId = params.storeId as string;

  const [app, setApp] = useState<App | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('light');
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    const loadApp = async () => {
      if (!session?.accessToken || !storeId) return;

      try {
        setLoading(true);
        const apps = await appsApi.list(session.accessToken, storeId);
        if (apps.length > 0) {
          setApp(apps[0]);
          const config = apps[0].config as Record<string, unknown>;
          if (config?.themeMode) {
            setPreviewTheme(config.themeMode as 'light' | 'dark');
          }
        }
      } catch (err) {
        console.error('Failed to load app:', err);
      } finally {
        setLoading(false);
      }
    };

    loadApp();
  }, [session?.accessToken, storeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <p className="text-gray-400 mb-4">Nenhum aplicativo configurado</p>
        <button
          onClick={() => router.push(`/stores/${storeId}/app-builder`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Criar Aplicativo
        </button>
      </div>
    );
  }

  const config = app.config as Record<string, unknown>;
  const primaryColor = (config?.theme as { primary_color?: string })?.primary_color || '#3B82F6';
  const themeMode = (config?.themeMode as string) || 'light';

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.push(`/stores/${storeId}/app-builder`)}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <ChevronLeft size={20} />
              Voltar ao Editor
            </button>
            <h1 className="text-xl font-semibold text-white">{app.name}</h1>
            <div className="w-32" />
          </div>
        </div>
      </div>

      {/* Success Banner */}
      <div className="bg-green-900/20 border-b border-green-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <Check size={18} className="text-white" />
            </div>
            <div>
              <p className="text-green-300 font-medium">Aplicativo configurado com sucesso!</p>
              <p className="text-green-400/70 text-sm">
                Seu aplicativo está pronto para ser publicado nas lojas.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left - Preview */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Preview do Aplicativo</h2>
            <div className="bg-gray-900 rounded-2xl p-6">
              {/* Phone Frame */}
              <div className="relative mx-auto w-[280px]">
                <div className="bg-gray-800 rounded-[2.5rem] p-2">
                  <div
                    className={`rounded-[2rem] overflow-hidden ${
                      previewTheme === 'dark' ? 'bg-gray-900' : 'bg-white'
                    }`}
                    style={{ aspectRatio: '9/19' }}
                  >
                    {/* Status Bar */}
                    <div className={`flex justify-between items-center px-6 py-2 text-xs ${
                      previewTheme === 'dark' ? 'text-white' : 'text-black'
                    }`}>
                      <span>21:06</span>
                      <div className="flex items-center gap-1">
                        <span>5G</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* App Header */}
                    <div className={`px-4 py-3 flex items-center justify-between ${
                      previewTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                    }`}>
                      <span
                        className="font-semibold"
                        style={{ color: primaryColor }}
                      >
                        {app.name}
                      </span>
                      <Search size={20} className={previewTheme === 'dark' ? 'text-gray-400' : 'text-gray-500'} />
                    </div>

                    {/* Content Preview */}
                    <div className="p-4 space-y-3">
                      {/* Banner */}
                      <div
                        className="h-24 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: primaryColor }}
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
                                : previewTheme === 'dark'
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                            style={cat === 'Todos' ? { backgroundColor: primaryColor } : {}}
                          >
                            {cat}
                          </div>
                        ))}
                      </div>

                      {/* Products Grid */}
                      <div className="grid grid-cols-2 gap-2">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`rounded-lg overflow-hidden ${
                              previewTheme === 'dark' ? 'bg-gray-800' : 'bg-gray-50'
                            }`}
                          >
                            <div className="aspect-square bg-gray-300" />
                            <div className="p-2">
                              <div className={`h-2 w-16 rounded ${
                                previewTheme === 'dark' ? 'bg-gray-700' : 'bg-gray-200'
                              }`} />
                              <div
                                className="h-2 w-10 rounded mt-1"
                                style={{ backgroundColor: primaryColor, opacity: 0.7 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Navigation */}
                    <div className={`absolute bottom-0 left-0 right-0 flex justify-around py-3 border-t ${
                      previewTheme === 'dark'
                        ? 'bg-gray-800 border-gray-700'
                        : 'bg-white border-gray-200'
                    }`}>
                      <Home size={20} style={{ color: primaryColor }} />
                      <Search size={20} className={previewTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                      <Heart size={20} className={previewTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                      <ShoppingBag size={20} className={previewTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                      <User size={20} className={previewTheme === 'dark' ? 'text-gray-500' : 'text-gray-400'} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Preview Controls */}
              <div className="flex justify-center gap-4 mt-4">
                <button
                  onClick={() => setPreviewTheme('light')}
                  className={`p-2 rounded-lg transition-colors ${
                    previewTheme === 'light'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Sun size={18} />
                </button>
                <button
                  onClick={() => setPreviewTheme('dark')}
                  className={`p-2 rounded-lg transition-colors ${
                    previewTheme === 'dark'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  <Moon size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Right - Next Steps */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Próximos Passos</h2>
            <div className="space-y-4">
              {/* Step 1 */}
              <div className="bg-gray-900 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Smartphone className="text-blue-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Teste o aplicativo</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      Baixe o app de preview para testar em seu dispositivo antes de publicar.
                    </p>
                    <button
                      onClick={() => setShowComingSoon(true)}
                      className="mt-3 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Download size={16} />
                      Baixar Preview
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="bg-gray-900 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Settings className="text-purple-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Configurações avançadas</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      Personalize notificações, integrações e outras configurações do app.
                    </p>
                    <button
                      onClick={() => router.push(`/stores/${storeId}/app-builder`)}
                      className="mt-3 px-4 py-2 bg-gray-800 text-white rounded-lg text-sm hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Settings size={16} />
                      Configurar
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="bg-gray-900 rounded-xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <Rocket className="text-green-400" size={20} />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Publicar nas lojas</h3>
                    <p className="text-gray-400 text-sm mt-1">
                      Quando estiver pronto, envie seu app para a App Store e Google Play.
                    </p>
                    <button
                      onClick={() => setShowComingSoon(true)}
                      className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 flex items-center gap-2"
                    >
                      <Rocket size={16} />
                      Publicar App
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* App Info */}
            <div className="mt-6 bg-gray-900 rounded-xl p-5">
              <h3 className="text-white font-medium mb-4">Informações do App</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Status</span>
                  <span className="text-yellow-400">Rascunho</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Template</span>
                  <span className="text-white capitalize">{(config?.template as string) || 'Classic'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tema Padrão</span>
                  <span className="text-white">{themeMode === 'light' ? 'Claro' : 'Escuro'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cor Principal</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: primaryColor }}
                    />
                    <span className="text-white">{primaryColor}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Modal */}
      {showComingSoon && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Rocket className="text-blue-400" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Em breve!</h2>
            <p className="text-gray-400 mb-6">
              Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
              Fique ligado nas atualizações!
            </p>
            <button
              onClick={() => setShowComingSoon(false)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
