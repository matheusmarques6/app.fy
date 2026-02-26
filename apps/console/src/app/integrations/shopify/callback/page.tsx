'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/supabase/hooks';
import { integrationsApi } from '../../../../lib/api-client';
import { CheckCircle, XCircle, Loader2, Store, ArrowRight } from 'lucide-react';

type ValidationStep = {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  error?: string;
};

function ShopifyCallbackContent() {
  const { accessToken, loading: sessionLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [steps, setSteps] = useState<ValidationStep[]>([
    { id: 'oauth', label: 'Autorizacao OAuth', status: 'pending' },
    { id: 'connection', label: 'Conexao com Shopify', status: 'pending' },
    { id: 'products', label: 'Acesso aos produtos', status: 'pending' },
  ]);
  const [overallStatus, setOverallStatus] = useState<'validating' | 'success' | 'error'>('validating');
  const [storeId, setStoreId] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);

  // Get params from URL
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const urlStoreId = searchParams.get('store_id');

  useEffect(() => {
    if (urlStoreId) {
      setStoreId(urlStoreId);
    }
  }, [urlStoreId]);

  // Run validation when session is ready
  useEffect(() => {
    if (sessionLoading || !accessToken || !storeId) {
      return;
    }

    const runValidation = async () => {
      // Step 1: Check OAuth result
      updateStep('oauth', 'loading');
      await sleep(500);

      if (error) {
        updateStep('oauth', 'error', 'Falha na autorizacao OAuth');
        setOverallStatus('error');
        return;
      }

      if (success === 'shopify') {
        updateStep('oauth', 'success');
      } else {
        updateStep('oauth', 'error', 'Resposta OAuth invalida');
        setOverallStatus('error');
        return;
      }

      // Step 2: Check connection status
      updateStep('connection', 'loading');
      await sleep(500);

      try {
        const status = await integrationsApi.getShopifyStatus(accessToken!, storeId);

        if (status?.status === 'active') {
          updateStep('connection', 'success');
          setShopDomain(status.shop_domain || null);
        } else {
          updateStep('connection', 'error', 'Integracao nao esta ativa');
          setOverallStatus('error');
          return;
        }
      } catch (err) {
        updateStep('connection', 'error', 'Erro ao verificar conexao');
        setOverallStatus('error');
        return;
      }

      // Step 3: Test product access
      updateStep('products', 'loading');
      await sleep(500);

      try {
        const preview = await integrationsApi.getShopifyPreview(accessToken!, storeId);

        if (preview.connected) {
          updateStep('products', 'success');
          setOverallStatus('success');
        } else {
          updateStep('products', 'error', 'Nao foi possivel acessar produtos');
          setOverallStatus('error');
        }
      } catch (err) {
        updateStep('products', 'error', 'Erro ao acessar produtos');
        setOverallStatus('error');
      }
    };

    runValidation();
  }, [sessionLoading, accessToken, storeId, success, error]);

  // On success: notify parent window and close popup (or redirect if not popup)
  useEffect(() => {
    if (overallStatus !== 'success' || !storeId) return;

    // Check if we're in a popup window
    const isPopup = window.opener && window.opener !== window;

    if (isPopup) {
      // Send success message to parent window
      window.opener.postMessage(
        { type: 'shopify-oauth-success', storeId },
        window.location.origin
      );
      // Close popup after a short delay to show success state
      const timer = setTimeout(() => {
        window.close();
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      // Fallback: redirect if not in popup
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push(`/stores/${storeId}/app-builder`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [overallStatus, storeId, router]);

  // On error: notify parent window (but don't auto-close to let user see error)
  useEffect(() => {
    if (overallStatus !== 'error') return;

    const isPopup = window.opener && window.opener !== window;
    if (isPopup) {
      window.opener.postMessage(
        { type: 'shopify-oauth-error', storeId },
        window.location.origin
      );
    }
  }, [overallStatus, storeId]);

  const updateStep = (id: string, status: ValidationStep['status'], error?: string) => {
    setSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, status, error } : step))
    );
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getStepIcon = (status: ValidationStep['status']) => {
    switch (status) {
      case 'loading':
        return <Loader2 className="animate-spin text-blue-500" size={24} />;
      case 'success':
        return <CheckCircle className="text-green-500" size={24} />;
      case 'error':
        return <XCircle className="text-red-500" size={24} />;
      default:
        return <div className="w-6 h-6 rounded-full border-2 border-gray-600" />;
    }
  };

  // Loading session
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  // Not authenticated
  if (!sessionLoading && !accessToken) {
    router.push('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-[#96bf48] rounded-2xl flex items-center justify-center">
            <Store className="text-white" size={32} />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white text-center mb-2">
          {overallStatus === 'validating' && 'Validando Conexao...'}
          {overallStatus === 'success' && 'Conexao Estabelecida!'}
          {overallStatus === 'error' && 'Erro na Conexao'}
        </h1>

        {shopDomain && overallStatus === 'success' && (
          <p className="text-gray-400 text-center mb-8">{shopDomain}</p>
        )}

        {/* Validation Steps */}
        <div className="space-y-4 mb-8">
          {steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                step.status === 'loading'
                  ? 'bg-blue-900/20 border border-blue-800'
                  : step.status === 'success'
                  ? 'bg-green-900/20 border border-green-800'
                  : step.status === 'error'
                  ? 'bg-red-900/20 border border-red-800'
                  : 'bg-gray-800/50 border border-gray-700'
              }`}
            >
              {getStepIcon(step.status)}
              <div className="flex-1">
                <p className="text-white font-medium">{step.label}</p>
                {step.error && <p className="text-red-400 text-sm">{step.error}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Success State */}
        {overallStatus === 'success' && (
          <div className="text-center">
            {window.opener && window.opener !== window ? (
              <p className="text-gray-400 mb-4">
                Fechando esta janela automaticamente...
              </p>
            ) : (
              <>
                <p className="text-gray-400 mb-4">
                  Redirecionando para o App Builder em {countdown}s...
                </p>
                <button
                  onClick={() => router.push(`/stores/${storeId}/app-builder`)}
                  className="flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Continuar para App Builder
                  <ArrowRight size={20} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Error State */}
        {overallStatus === 'error' && (
          <div className="text-center space-y-4">
            <p className="text-gray-400">
              Houve um problema ao conectar sua loja. Verifique as credenciais e tente novamente.
            </p>
            <div className="flex gap-3">
              {window.opener && window.opener !== window ? (
                <button
                  onClick={() => window.close()}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Fechar
                </button>
              ) : (
                <button
                  onClick={() => router.push(`/stores/${storeId}/settings?tab=integrations`)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                >
                  Voltar
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading fallback for Suspense
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <Loader2 className="animate-spin text-blue-500" size={48} />
    </div>
  );
}

// Wrap with Suspense for useSearchParams
export default function ShopifyCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ShopifyCallbackContent />
    </Suspense>
  );
}
