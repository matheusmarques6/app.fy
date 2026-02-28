'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import { storesApi, appsApi, integrationsApi, App } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  Save,
  Key,
  Globe,
  Bell,
  Shield,
  Check,
  X,
  Loader2,
  Store,
  RefreshCw,
} from 'lucide-react';

type Tab = 'general' | 'integrations' | 'push' | 'security';

interface IntegrationStatus {
  id: string;
  platform: string;
  status: string;
  shop_domain?: string;
  scopes: string[];
  last_sync_at?: string;
  created_at: string;
}

export default function SettingsPage() {
  const { accessToken } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const storeId = params.storeId as string;

  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabFromUrl || 'general');

  // General tab state
  const [generalName, setGeneralName] = useState('');
  const [generalDomain, setGeneralDomain] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [loadingStore, setLoadingStore] = useState(true);

  // Push tab state
  const [currentApp, setCurrentApp] = useState<App | null>(null);
  const [oneSignalAppId, setOneSignalAppId] = useState('');
  const [oneSignalApiKey, setOneSignalApiKey] = useState('');
  const [savingPush, setSavingPush] = useState(false);
  const [loadingApp, setLoadingApp] = useState(true);

  // Security tab state
  const [webhookSecret, setWebhookSecret] = useState('');
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Integrations tab state
  const [shopifyStatus, setShopifyStatus] = useState<IntegrationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [shopifyError, setShopifyError] = useState<string | null>(null);

  const tabs = [
    { id: 'general' as Tab, name: 'Geral', icon: Globe },
    { id: 'integrations' as Tab, name: 'Integrações', icon: Key },
    { id: 'push' as Tab, name: 'Push Notifications', icon: Bell },
    { id: 'security' as Tab, name: 'Segurança', icon: Shield },
  ];

  useEffect(() => {
    if (tabFromUrl && tabs.some((t) => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Load store data (General + Security tabs)
  useEffect(() => {
    if (!accessToken || !storeId) return;

    const load = async () => {
      setLoadingStore(true);
      try {
        const store = await storesApi.get(accessToken, storeId);
        setGeneralName(store.name ?? '');
        setGeneralDomain(store.primary_domain ?? '');
        const s = store.settings as Record<string, unknown>;
        setWebhookSecret((s?.webhook_signing_secret as string) ?? '');
      } catch {
        // non-critical — fields remain empty
      } finally {
        setLoadingStore(false);
      }
    };

    load();
  }, [accessToken, storeId]);

  // Load app data (Push tab)
  useEffect(() => {
    if (!accessToken || !storeId) return;

    const load = async () => {
      setLoadingApp(true);
      try {
        const apps = await appsApi.list(accessToken, storeId);
        if (apps.length > 0) {
          const app = apps[0];
          setCurrentApp(app);
          setOneSignalAppId(app.onesignal_app_id ?? '');
          // API key is write-only — show placeholder if already set
          if (app.onesignal_api_key) {
            setOneSignalApiKey('');
          }
        }
      } catch {
        // non-critical
      } finally {
        setLoadingApp(false);
      }
    };

    load();
  }, [accessToken, storeId]);

  // Load Shopify status
  useEffect(() => {
    if (activeTab !== 'integrations' || !accessToken || !storeId) return;

    const load = async () => {
      setLoadingStatus(true);
      try {
        const status = await integrationsApi.getShopifyStatus(accessToken, storeId);
        setShopifyStatus(status);
      } catch {
        // non-critical
      } finally {
        setLoadingStatus(false);
      }
    };

    load();
  }, [accessToken, storeId, activeTab]);

  // Listen for OAuth popup result
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'shopify-oauth-success') {
        setShowShopifyModal(false);
        setConnecting(false);
        toast.success('Shopify conectado com sucesso!');
        integrationsApi.getShopifyStatus(accessToken!, storeId).then(setShopifyStatus).catch(() => {});
      } else if (event.data?.type === 'shopify-oauth-error') {
        setConnecting(false);
        setShopifyError('Falha ao conectar com Shopify. Tente novamente.');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [accessToken, storeId]);

  const handleSaveGeneral = async () => {
    if (!accessToken) return;
    setSavingGeneral(true);
    try {
      await storesApi.update(accessToken, storeId, {
        name: generalName,
        primary_domain: generalDomain,
      });
      toast.success('Configurações gerais salvas com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar configurações gerais');
    } finally {
      setSavingGeneral(false);
    }
  };

  const handleSavePush = async () => {
    if (!accessToken || !currentApp) {
      toast.error('Nenhum app encontrado. Crie um app primeiro.');
      return;
    }
    if (!oneSignalAppId.trim()) {
      toast.error('App ID do OneSignal é obrigatório');
      return;
    }
    if (!oneSignalApiKey.trim()) {
      toast.error('REST API Key do OneSignal é obrigatória');
      return;
    }

    setSavingPush(true);
    try {
      const updated = await appsApi.setOneSignal(accessToken, storeId, currentApp.id, {
        app_id: oneSignalAppId.trim(),
        api_key: oneSignalApiKey.trim(),
      });
      setCurrentApp(updated);
      setOneSignalAppId(updated.onesignal_app_id ?? '');
      setOneSignalApiKey('');
      toast.success('Configuração OneSignal salva com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar configuração OneSignal');
    } finally {
      setSavingPush(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (!accessToken) return;
    setSavingSecurity(true);
    try {
      const store = await storesApi.get(accessToken, storeId);
      const existingSettings = (store.settings as Record<string, unknown>) ?? {};
      await storesApi.update(accessToken, storeId, {
        settings: {
          ...existingSettings,
          webhook_signing_secret: webhookSecret.trim(),
        },
      });
      toast.success('Configurações de segurança salvas com sucesso');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar configurações de segurança');
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleConnectShopify = async () => {
    if (!accessToken || !storeId || !shopDomain) return;

    setConnecting(true);
    setShopifyError(null);

    try {
      const { install_url } = await integrationsApi.startShopifyInstall(accessToken, storeId, shopDomain);

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.innerWidth - width) / 2;
      const top = window.screenY + (window.innerHeight - height) / 2;

      window.open(
        install_url,
        'shopify-oauth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
      );
    } catch (err) {
      setShopifyError(err instanceof Error ? err.message : 'Falha ao iniciar conexão com Shopify.');
      setConnecting(false);
    }
  };

  const handleDisconnectShopify = async () => {
    if (!accessToken || !storeId) return;
    if (!confirm('Tem certeza que deseja desconectar o Shopify?')) return;

    setDisconnecting(true);
    try {
      await integrationsApi.disconnectShopify(accessToken, storeId);
      setShopifyStatus(null);
      toast.success('Shopify desconectado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao desconectar');
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 mt-1">Gerencie as configurações da sua loja</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-800">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <tab.icon size={18} />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Informações da Loja</h3>
            {loadingStore ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="animate-spin text-gray-400" size={24} />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Nome da Loja</label>
                  <input
                    type="text"
                    value={generalName}
                    onChange={(e) => setGeneralName(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Domínio Principal</label>
                  <input
                    type="text"
                    value={generalDomain}
                    onChange={(e) => setGeneralDomain(e.target.value)}
                    placeholder="ex: minha-loja.com"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveGeneral}
                disabled={savingGeneral || loadingStore}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {savingGeneral ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{savingGeneral ? 'Salvando...' : 'Salvar Alterações'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-2">Plataforma de E-commerce</h3>
            <p className="text-gray-400 text-sm mb-4">
              Conecte sua loja para sincronizar produtos, pedidos e clientes automaticamente.
            </p>

            {loadingStatus ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Shopify */}
                <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#96bf48] rounded-lg flex items-center justify-center">
                      <Store className="text-white" size={20} />
                    </div>
                    <div>
                      <span className="text-white font-medium">Shopify</span>
                      {shopifyStatus?.status === 'active' && (
                        <p className="text-sm text-gray-400">{shopifyStatus.shop_domain}</p>
                      )}
                    </div>
                  </div>
                  {shopifyStatus?.status === 'active' ? (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-green-400 text-sm">
                        <Check size={16} />
                        Conectado
                      </span>
                      <button
                        onClick={handleDisconnectShopify}
                        disabled={disconnecting}
                        className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors disabled:opacity-50"
                      >
                        {disconnecting ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowShopifyModal(true)}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Conectar
                    </button>
                  )}
                </div>

                {/* WooCommerce */}
                <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg opacity-60">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#7f54b3] rounded-lg flex items-center justify-center">
                      <Store className="text-white" size={20} />
                    </div>
                    <div>
                      <span className="text-white font-medium">WooCommerce</span>
                      <p className="text-sm text-gray-500">Em breve</p>
                    </div>
                  </div>
                  <span className="px-3 py-1.5 text-xs bg-gray-700 text-gray-400 rounded">Em breve</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Push Settings Tab */}
      {activeTab === 'push' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-1">Configuração OneSignal</h3>
            <p className="text-sm text-gray-400 mb-4">
              Credenciais para envio de push notifications via OneSignal.
            </p>

            {loadingApp ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="animate-spin text-gray-400" size={24} />
              </div>
            ) : !currentApp ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Nenhum app encontrado para esta store. Crie um app primeiro.
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">App ID</label>
                  <input
                    type="text"
                    value={oneSignalAppId}
                    onChange={(e) => setOneSignalAppId(e.target.value)}
                    placeholder="ex: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    REST API Key
                    {currentApp.onesignal_api_key && (
                      <span className="ml-2 text-xs text-green-400 font-normal">✓ configurada</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={oneSignalApiKey}
                    onChange={(e) => setOneSignalApiKey(e.target.value)}
                    placeholder={currentApp.onesignal_api_key ? 'Digite para alterar a chave atual' : 'Digite sua OneSignal REST API Key'}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSavePush}
                disabled={savingPush || loadingApp || !currentApp}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {savingPush ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{savingPush ? 'Salvando...' : 'Salvar Configuração'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-1">Segurança de Webhooks</h3>
            <p className="text-sm text-gray-400 mb-4">
              Use este secret para verificar assinaturas de webhooks da sua plataforma de e-commerce.
            </p>

            {loadingStore ? (
              <div className="flex justify-center py-8">
                <RefreshCw className="animate-spin text-gray-400" size={24} />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Webhook Signing Secret
                  </label>
                  <input
                    type="text"
                    value={webhookSecret}
                    onChange={(e) => setWebhookSecret(e.target.value)}
                    placeholder="ex: whsec_xxxxxxxxxxxxxxxxxxxx"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Deixe em branco para remover o secret.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={handleSaveSecurity}
                disabled={savingSecurity || loadingStore}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {savingSecurity ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                <span>{savingSecurity ? 'Salvando...' : 'Salvar Configurações'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopify Connection Modal */}
      {showShopifyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">Conectar Shopify</h2>
              <button
                onClick={() => {
                  setShowShopifyModal(false);
                  setShopifyError(null);
                  setShopDomain('');
                }}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <p className="text-gray-400 text-sm">
                Digite o domínio da sua loja Shopify e clique em conectar. Você será redirecionado para autorizar o acesso.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Domínio da Loja</label>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="minha-loja.myshopify.com"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">O domínio .myshopify.com da sua loja</p>
              </div>

              {shopifyError && (
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {shopifyError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => {
                  setShowShopifyModal(false);
                  setShopifyError(null);
                  setShopDomain('');
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConnectShopify}
                disabled={connecting || !shopDomain}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {connecting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Aguardando autorização...
                  </>
                ) : (
                  <>
                    <Store size={18} />
                    Conectar com Shopify
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
