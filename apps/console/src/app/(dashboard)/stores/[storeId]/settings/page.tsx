'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useAppStore } from '../../../../../lib/store';
import { integrationsApi } from '../../../../../lib/api-client';
import {
  Save,
  Key,
  Globe,
  Bell,
  Shield,
  Check,
  X,
  Loader2,
  ExternalLink,
  AlertCircle,
  Store,
  Eye,
  EyeOff,
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

interface CredentialsStatus {
  configured: boolean;
  api_key_preview?: string;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const params = useParams();
  const searchParams = useSearchParams();
  const storeId = params.storeId as string;
  const { currentStore } = useAppStore();

  // Get tab from URL or default to 'general'
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const [activeTab, setActiveTab] = useState<Tab>(tabFromUrl || 'general');

  // Shopify credentials state
  const [credentialsStatus, setCredentialsStatus] = useState<CredentialsStatus | null>(null);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);

  // Shopify connection state
  const [shopifyStatus, setShopifyStatus] = useState<IntegrationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [showShopifyModal, setShowShopifyModal] = useState(false);
  const [shopDomain, setShopDomain] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const tabs = [
    { id: 'general' as Tab, name: 'Geral', icon: Globe },
    { id: 'integrations' as Tab, name: 'Integrações', icon: Key },
    { id: 'push' as Tab, name: 'Push Notifications', icon: Bell },
    { id: 'security' as Tab, name: 'Segurança', icon: Shield },
  ];

  // Update tab when URL changes
  useEffect(() => {
    if (tabFromUrl && tabs.some(t => t.id === tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Load Shopify credentials and status
  useEffect(() => {
    const loadShopifyData = async () => {
      if (!session?.accessToken || !storeId) return;

      setLoadingStatus(true);
      try {
        // Load credentials status and connection status in parallel
        const [credentials, status] = await Promise.all([
          integrationsApi.getShopifyCredentials(session.accessToken, storeId),
          integrationsApi.getShopifyStatus(session.accessToken, storeId),
        ]);
        setCredentialsStatus(credentials);
        setShopifyStatus(status);
      } catch (err) {
        console.error('Failed to load Shopify data:', err);
      } finally {
        setLoadingStatus(false);
      }
    };

    if (activeTab === 'integrations') {
      loadShopifyData();
    }
  }, [session?.accessToken, storeId, activeTab]);

  const handleSaveCredentials = async () => {
    if (!session?.accessToken || !storeId || !apiKey || !apiSecret) return;

    setSavingCredentials(true);
    setError(null);

    try {
      await integrationsApi.saveShopifyCredentials(session.accessToken, storeId, apiKey, apiSecret);
      setCredentialsStatus({ configured: true, api_key_preview: `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` });
      setShowCredentialsModal(false);
      setApiKey('');
      setApiSecret('');
      setSuccess('Credenciais Shopify salvas com sucesso!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar credenciais');
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleConnectShopify = async () => {
    if (!session?.accessToken || !storeId) return;

    setConnecting(true);
    setError(null);

    try {
      // Initiate OAuth flow - get install URL from API
      const result = await integrationsApi.initiateShopifyOAuth(
        session.accessToken,
        storeId,
        shopDomain,
      );

      // Redirect to Shopify for authorization
      window.location.href = result.install_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao iniciar conexão com Shopify');
      setConnecting(false);
    }
  };

  const handleDisconnectShopify = async () => {
    if (!session?.accessToken || !storeId) return;

    if (!confirm('Tem certeza que deseja desconectar o Shopify?')) return;

    setDisconnecting(true);
    try {
      await integrationsApi.disconnectShopify(session.accessToken, storeId);
      setShopifyStatus(null);
      setSuccess('Shopify desconectado');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desconectar');
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

      {/* Success/Error Messages */}
      {success && (
        <div className="flex items-center gap-2 p-4 bg-green-900/20 border border-green-800 rounded-lg text-green-400">
          <Check size={20} />
          {success}
          <button onClick={() => setSuccess(null)} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-900/20 border border-red-800 rounded-lg text-red-400">
          <AlertCircle size={20} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto">
            <X size={18} />
          </button>
        </div>
      )}

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
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Nome da Loja</label>
                <input
                  type="text"
                  defaultValue={currentStore?.name}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Domínio Principal</label>
                <input
                  type="text"
                  defaultValue={currentStore?.primary_domain}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Fuso Horário</label>
                <select className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500">
                  <option>America/Sao_Paulo</option>
                  <option>America/New_York</option>
                  <option>Europe/London</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Save size={18} />
                <span>Salvar Alterações</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="space-y-6">
          {/* Shopify App Credentials */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-2">Credenciais do App Shopify</h3>
            <p className="text-gray-400 text-sm mb-4">
              Configure as credenciais do seu app Shopify para permitir a conexão OAuth.
              <a
                href="https://partners.shopify.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 ml-1"
              >
                Criar app no Shopify Partners →
              </a>
            </p>

            {loadingStatus ? (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            ) : credentialsStatus?.configured ? (
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-600/20 rounded-lg flex items-center justify-center">
                    <Check className="text-green-400" size={20} />
                  </div>
                  <div>
                    <span className="text-white font-medium">Credenciais Configuradas</span>
                    <p className="text-sm text-gray-400">API Key: {credentialsStatus.api_key_preview}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCredentialsModal(true)}
                  className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Atualizar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-yellow-900/20 border border-yellow-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-yellow-600/20 rounded-lg flex items-center justify-center">
                    <AlertCircle className="text-yellow-400" size={20} />
                  </div>
                  <div>
                    <span className="text-white font-medium">Credenciais não configuradas</span>
                    <p className="text-sm text-gray-400">Configure para habilitar a conexão com Shopify</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCredentialsModal(true)}
                  className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Configurar
                </button>
              </div>
            )}
          </div>

          {/* Store Connection */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-2">Conexão da Loja</h3>
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
                        className="px-3 py-1.5 text-sm bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded transition-colors"
                      >
                        {disconnecting ? 'Desconectando...' : 'Desconectar'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowShopifyModal(true)}
                      disabled={!credentialsStatus?.configured}
                      className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                      title={!credentialsStatus?.configured ? 'Configure as credenciais primeiro' : ''}
                    >
                      Conectar
                    </button>
                  )}
                </div>

                {/* WooCommerce - Coming Soon */}
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
                  <span className="px-3 py-1.5 text-xs bg-gray-700 text-gray-400 rounded">
                    Em breve
                  </span>
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
            <h3 className="text-lg font-medium text-white mb-4">Configuração OneSignal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">App ID</label>
                <input
                  type="text"
                  placeholder="Digite seu OneSignal App ID"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">REST API Key</label>
                <input
                  type="password"
                  placeholder="Digite sua OneSignal REST API Key"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                <Save size={18} />
                <span>Salvar Configuração</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Segurança de Webhooks</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Webhook Signing Secret</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    readOnly
                    value="whsec_xxxxxxxxxxxxx"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-400 font-mono text-sm"
                  />
                  <button className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors">
                    Regenerar
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Use este secret para verificar assinaturas de webhooks da sua plataforma de e-commerce.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Shopify Credentials Modal */}
      {showCredentialsModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <h2 className="text-xl font-semibold text-white">Configurar Credenciais Shopify</h2>
              <button
                onClick={() => setShowCredentialsModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Instructions */}
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4 space-y-2">
                <p className="text-blue-200 text-sm font-medium">Como obter as credenciais:</p>
                <ol className="text-blue-200/80 text-sm list-decimal list-inside space-y-1">
                  <li>Acesse <a href="https://partners.shopify.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">partners.shopify.com</a></li>
                  <li>Crie um novo App (ou use um existente)</li>
                  <li>Copie o <strong>API Key</strong> e <strong>API Secret Key</strong></li>
                  <li>Configure a URL de callback: <code className="bg-blue-900/50 px-1 rounded text-xs">{process.env.NEXT_PUBLIC_API_URL}/v1/integrations/shopify/callback</code></li>
                </ol>
              </div>

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Key (Client ID)
                  </label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Seu Shopify API Key"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    API Secret Key (Client Secret)
                  </label>
                  <div className="relative">
                    <input
                      type={showApiSecret ? 'text' : 'password'}
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder="Seu Shopify API Secret Key"
                      className="w-full px-4 py-3 pr-12 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showApiSecret ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => {
                  setShowCredentialsModal(false);
                  setApiKey('');
                  setApiSecret('');
                  setError(null);
                }}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCredentials}
                disabled={savingCredentials || !apiKey || !apiSecret}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
              >
                {savingCredentials ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Salvar Credenciais
                  </>
                )}
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
              <h2 className="text-xl font-semibold text-white">Conectar Loja Shopify</h2>
              <button
                onClick={() => setShowShopifyModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Info */}
              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <p className="text-blue-200 text-sm">
                  Digite o domínio da sua loja Shopify. Você será redirecionado para o Shopify
                  para autorizar o acesso aos dados da loja (produtos, pedidos, clientes).
                </p>
              </div>

              {/* Form */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Domínio da Loja
                </label>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder="minha-loja.myshopify.com"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  O domínio .myshopify.com da sua loja
                </p>
              </div>

              {error && (
                <div className="p-3 bg-red-900/20 border border-red-800 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowShopifyModal(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConnectShopify}
                disabled={connecting || !shopDomain}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-blue-800 disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Redirecionando...
                  </>
                ) : (
                  <>
                    <ExternalLink size={18} />
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
