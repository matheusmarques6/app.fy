'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Settings,
  Image,
  Key,
  Hammer,
  Loader2,
  Check,
  X,
  Upload,
  Trash2,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Smartphone,
  Apple,
  Bot,
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import {
  appsApi,
  assetsApi,
  credentialsApi,
  buildsApi,
  App,
  AppCredential,
  Build,
  BuildReadiness,
} from '@/lib/api-client';

type Tab = 'config' | 'assets' | 'credentials' | 'builds' | 'modules' | 'theme' | 'security';

export default function AppBuilderPage() {
  const { data: session } = useSession();
  const params = useParams();
  const storeId = params.storeId as string;
  const { currentStore } = useAppStore();

  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [app, setApp] = useState<App | null>(null);
  const [credentials, setCredentials] = useState<AppCredential[]>([]);
  const [builds, setBuilds] = useState<Build[]>([]);
  const [readiness, setReadiness] = useState<BuildReadiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabs = [
    { id: 'config' as Tab, label: 'Settings', icon: Settings },
    { id: 'assets' as Tab, label: 'Assets', icon: Image },
    { id: 'credentials' as Tab, label: 'Credentials', icon: Key },
    { id: 'builds' as Tab, label: 'Builds', icon: Hammer },
  ];

  // Load app data
  const loadApp = useCallback(async () => {
    if (!session?.accessToken || !storeId) return;

    try {
      setLoading(true);
      setError(null);

      const apps = await appsApi.list(session.accessToken, storeId);
      if (apps.length > 0) {
        const appData = apps[0];
        setApp(appData);

        // Load related data in parallel
        const [creds, buildList, ready] = await Promise.all([
          credentialsApi.list(session.accessToken, storeId, appData.id),
          buildsApi.list(session.accessToken, storeId, appData.id, { limit: 10 }),
          appsApi.getBuildReadiness(session.accessToken, storeId, appData.id),
        ]);

        setCredentials(creds);
        setBuilds(buildList);
        setReadiness(ready);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load app');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, storeId]);

  useEffect(() => {
    loadApp();
  }, [loadApp]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 text-red-400">
        <div className="flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
        <button
          onClick={loadApp}
          className="mt-4 text-sm text-blue-400 hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
        <Smartphone className="mx-auto text-gray-600" size={48} />
        <h2 className="text-xl font-medium text-white mt-4">No App Configured</h2>
        <p className="text-gray-400 mt-2">
          Your store doesn&apos;t have a mobile app yet. Contact support to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">App Builder</h1>
          <p className="text-gray-400 mt-1">
            Configure and build your mobile app for {currentStore?.name}
          </p>
        </div>
        {readiness && (
          <div className="flex items-center gap-2">
            {readiness.ready ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-green-900/30 text-green-400 rounded-lg text-sm">
                <CheckCircle2 size={16} />
                Ready to build
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-900/30 text-yellow-400 rounded-lg text-sm">
                <AlertCircle size={16} />
                {readiness.missing.length} items missing
              </span>
            )}
          </div>
        )}
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
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        {activeTab === 'config' && (
          <ConfigTab
            app={app}
            storeId={storeId}
            token={session?.accessToken || ''}
            onUpdate={(updated) => setApp(updated)}
            onRefreshReadiness={loadApp}
          />
        )}
        {activeTab === 'assets' && (
          <AssetsTab
            app={app}
            storeId={storeId}
            token={session?.accessToken || ''}
            onUpdate={(updated) => setApp(updated)}
          />
        )}
        {activeTab === 'credentials' && (
          <CredentialsTab
            app={app}
            storeId={storeId}
            token={session?.accessToken || ''}
            credentials={credentials}
            onUpdate={setCredentials}
          />
        )}
        {activeTab === 'builds' && (
          <BuildsTab
            app={app}
            storeId={storeId}
            token={session?.accessToken || ''}
            builds={builds}
            readiness={readiness}
            onRefresh={loadApp}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Config Tab
// ============================================================================

interface ConfigTabProps {
  app: App;
  storeId: string;
  token: string;
  onUpdate: (app: App) => void;
  onRefreshReadiness: () => void;
}

function ConfigTab({ app, storeId, token, onUpdate, onRefreshReadiness }: ConfigTabProps) {
  const [name, setName] = useState(app.name);
  const [bundleIdIos, setBundleIdIos] = useState(app.bundle_id_ios || '');
  const [bundleIdAndroid, setBundleIdAndroid] = useState(app.bundle_id_android || '');
  const [onesignalAppId, setOnesignalAppId] = useState(app.onesignal_app_id || '');
  const [onesignalApiKey, setOnesignalApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingOneSignal, setSavingOneSignal] = useState(false);
  const [generatingKeypair, setGeneratingKeypair] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await appsApi.update(token, storeId, app.id, {
        name,
        bundle_id_ios: bundleIdIos || undefined,
        bundle_id_android: bundleIdAndroid || undefined,
      });
      onUpdate(updated);
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSetOneSignal = async () => {
    if (!onesignalAppId || !onesignalApiKey) return;
    setSavingOneSignal(true);
    try {
      const updated = await appsApi.setOneSignal(token, storeId, app.id, {
        app_id: onesignalAppId,
        api_key: onesignalApiKey,
      });
      onUpdate(updated);
      setOnesignalApiKey('');
      onRefreshReadiness();
    } catch (err) {
      console.error('Failed to set OneSignal:', err);
    } finally {
      setSavingOneSignal(false);
    }
  };

  const handleRemoveOneSignal = async () => {
    setSavingOneSignal(true);
    try {
      const updated = await appsApi.removeOneSignal(token, storeId, app.id);
      onUpdate(updated);
      setOnesignalAppId('');
      onRefreshReadiness();
    } catch (err) {
      console.error('Failed to remove OneSignal:', err);
    } finally {
      setSavingOneSignal(false);
    }
  };

  const handleGenerateKeypair = async () => {
    setGeneratingKeypair(true);
    try {
      await appsApi.generateKeypair(token, storeId, app.id);
      onRefreshReadiness();
    } catch (err) {
      console.error('Failed to generate keypair:', err);
    } finally {
      setGeneratingKeypair(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">App Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <div className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                app.status === 'published' ? 'bg-green-900/50 text-green-300' :
                app.status === 'building' ? 'bg-blue-900/50 text-blue-300' :
                'bg-gray-700 text-gray-400'
              }`}>
                {app.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bundle IDs */}
      <div>
        <h2 className="text-lg font-medium text-white mb-4">Bundle Identifiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Apple size={14} className="inline mr-1" />
              iOS Bundle ID
            </label>
            <input
              type="text"
              value={bundleIdIos}
              onChange={(e) => setBundleIdIos(e.target.value)}
              placeholder="com.example.app"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Bot size={14} className="inline mr-1" />
              Android Package Name
            </label>
            <input
              type="text"
              value={bundleIdAndroid}
              onChange={(e) => setBundleIdAndroid(e.target.value)}
              placeholder="com.example.app"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white rounded-lg transition-colors"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          Save Changes
        </button>
      </div>

      {/* OneSignal */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-lg font-medium text-white mb-4">Push Notifications (OneSignal)</h2>
        {app.onesignal_app_id ? (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-white font-medium">OneSignal Configured</span>
                </div>
                <p className="text-sm text-gray-400 mt-1 font-mono">{app.onesignal_app_id}</p>
              </div>
              <button
                onClick={handleRemoveOneSignal}
                disabled={savingOneSignal}
                className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
              >
                {savingOneSignal ? <Loader2 size={14} className="animate-spin" /> : 'Remove'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">OneSignal App ID</label>
              <input
                type="text"
                value={onesignalAppId}
                onChange={(e) => setOnesignalAppId(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">REST API Key</label>
              <input
                type="password"
                value={onesignalApiKey}
                onChange={(e) => setOnesignalApiKey(e.target.value)}
                placeholder="Enter API key"
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="md:col-span-2">
              <button
                onClick={handleSetOneSignal}
                disabled={savingOneSignal || !onesignalAppId || !onesignalApiKey}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
              >
                {savingOneSignal ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                Configure OneSignal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Remote Config Keypair */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-lg font-medium text-white mb-4">Remote Config Security</h2>
        {app.rc_public_key ? (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-white font-medium">Ed25519 Keypair Generated</span>
            </div>
            <p className="text-xs text-gray-400 font-mono break-all">
              Public Key: {app.rc_public_key.substring(0, 32)}...
            </p>
          </div>
        ) : (
          <div>
            <p className="text-gray-400 text-sm mb-4">
              Generate an Ed25519 keypair for signing Remote Config updates. This ensures config integrity on devices.
            </p>
            <button
              onClick={handleGenerateKeypair}
              disabled={generatingKeypair}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded-lg transition-colors"
            >
              {generatingKeypair ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}
              Generate Keypair
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Assets Tab
// ============================================================================

interface AssetsTabProps {
  app: App;
  storeId: string;
  token: string;
  onUpdate: (app: App) => void;
}

function AssetsTab({ app, storeId, token, onUpdate }: AssetsTabProps) {
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingSplash, setUploadingSplash] = useState(false);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [splashPreview, setSplashPreview] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);
  const splashInputRef = useRef<HTMLInputElement>(null);

  const handleIconUpload = async (file: File) => {
    setUploadingIcon(true);
    try {
      const result = await assetsApi.uploadIcon(token, storeId, app.id, file);
      onUpdate({ ...app, icon_url: result.icon_url });
      setIconPreview(URL.createObjectURL(file));
    } catch (err) {
      console.error('Failed to upload icon:', err);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleSplashUpload = async (file: File) => {
    setUploadingSplash(true);
    try {
      const result = await assetsApi.uploadSplash(token, storeId, app.id, file);
      onUpdate({ ...app, splash_url: result.splash_url });
      setSplashPreview(URL.createObjectURL(file));
    } catch (err) {
      console.error('Failed to upload splash:', err);
    } finally {
      setUploadingSplash(false);
    }
  };

  const handleDeleteIcon = async () => {
    try {
      await assetsApi.deleteIcon(token, storeId, app.id);
      onUpdate({ ...app, icon_url: undefined });
      setIconPreview(null);
    } catch (err) {
      console.error('Failed to delete icon:', err);
    }
  };

  const handleDeleteSplash = async () => {
    try {
      await assetsApi.deleteSplash(token, storeId, app.id);
      onUpdate({ ...app, splash_url: undefined });
      setSplashPreview(null);
    } catch (err) {
      console.error('Failed to delete splash:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* App Icon */}
      <div>
        <h2 className="text-lg font-medium text-white mb-2">App Icon</h2>
        <p className="text-sm text-gray-400 mb-4">
          Upload a 1024x1024 PNG image. It will be automatically resized for all platforms.
        </p>
        <div className="flex items-start gap-6">
          <div
            className={`w-32 h-32 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden ${
              app.icon_url || iconPreview ? 'border-gray-700' : 'border-gray-600 bg-gray-800'
            }`}
          >
            {uploadingIcon ? (
              <Loader2 className="animate-spin text-blue-500" size={32} />
            ) : iconPreview || app.icon_url ? (
              <img
                src={iconPreview || app.icon_url}
                alt="App Icon"
                className="w-full h-full object-cover"
              />
            ) : (
              <Image className="text-gray-600" size={32} />
            )}
          </div>
          <div className="flex-1">
            <input
              ref={iconInputRef}
              type="file"
              accept="image/png"
              onChange={(e) => e.target.files?.[0] && handleIconUpload(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => iconInputRef.current?.click()}
              disabled={uploadingIcon}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Upload size={18} />
              {app.icon_url ? 'Replace Icon' : 'Upload Icon'}
            </button>
            {app.icon_url && (
              <button
                onClick={handleDeleteIcon}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <Trash2 size={18} />
                Remove Icon
              </button>
            )}
            <p className="text-xs text-gray-500 mt-3">
              PNG format, 1024x1024 pixels recommended
            </p>
          </div>
        </div>
      </div>

      {/* Splash Screen */}
      <div className="border-t border-gray-800 pt-6">
        <h2 className="text-lg font-medium text-white mb-2">Splash Screen</h2>
        <p className="text-sm text-gray-400 mb-4">
          Upload a 2732x2732 PNG image for the launch screen.
        </p>
        <div className="flex items-start gap-6">
          <div
            className={`w-32 h-48 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden ${
              app.splash_url || splashPreview ? 'border-gray-700' : 'border-gray-600 bg-gray-800'
            }`}
          >
            {uploadingSplash ? (
              <Loader2 className="animate-spin text-blue-500" size={32} />
            ) : splashPreview || app.splash_url ? (
              <img
                src={splashPreview || app.splash_url}
                alt="Splash Screen"
                className="w-full h-full object-cover"
              />
            ) : (
              <Image className="text-gray-600" size={32} />
            )}
          </div>
          <div className="flex-1">
            <input
              ref={splashInputRef}
              type="file"
              accept="image/png"
              onChange={(e) => e.target.files?.[0] && handleSplashUpload(e.target.files[0])}
              className="hidden"
            />
            <button
              onClick={() => splashInputRef.current?.click()}
              disabled={uploadingSplash}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              <Upload size={18} />
              {app.splash_url ? 'Replace Splash' : 'Upload Splash'}
            </button>
            {app.splash_url && (
              <button
                onClick={handleDeleteSplash}
                className="mt-2 flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
              >
                <Trash2 size={18} />
                Remove Splash
              </button>
            )}
            <p className="text-xs text-gray-500 mt-3">
              PNG format, 2732x2732 pixels recommended
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Credentials Tab
// ============================================================================

interface CredentialsTabProps {
  app: App;
  storeId: string;
  token: string;
  credentials: AppCredential[];
  onUpdate: (credentials: AppCredential[]) => void;
}

function CredentialsTab({ app, storeId, token, credentials, onUpdate }: CredentialsTabProps) {
  const [showIosForm, setShowIosForm] = useState(false);
  const [showAndroidForm, setShowAndroidForm] = useState(false);

  const iosCredential = credentials.find((c) => c.platform === 'ios');
  const androidCredential = credentials.find((c) => c.platform === 'android');

  const handleDelete = async (credentialId: string) => {
    try {
      await credentialsApi.delete(token, storeId, app.id, credentialId);
      onUpdate(credentials.filter((c) => c.id !== credentialId));
    } catch (err) {
      console.error('Failed to delete credential:', err);
    }
  };

  return (
    <div className="space-y-8">
      {/* iOS Credentials */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Apple size={20} className="text-gray-400" />
            <h2 className="text-lg font-medium text-white">iOS Credentials</h2>
          </div>
          {!iosCredential && !showIosForm && (
            <button
              onClick={() => setShowIosForm(true)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              + Add iOS Credentials
            </button>
          )}
        </div>

        {iosCredential ? (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-white font-medium">Distribution Certificate</span>
                </div>
                <div className="text-sm text-gray-400 space-y-0.5">
                  <p>Team ID: {iosCredential.metadata.teamId}</p>
                  <p>Bundle ID: {iosCredential.metadata.bundleId}</p>
                  {iosCredential.metadata.expiresAt && (
                    <p>Expires: {new Date(iosCredential.metadata.expiresAt).toLocaleDateString()}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(iosCredential.id)}
                className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        ) : showIosForm ? (
          <IosCredentialForm
            app={app}
            storeId={storeId}
            token={token}
            onSuccess={(cred) => {
              onUpdate([...credentials, cred]);
              setShowIosForm(false);
            }}
            onCancel={() => setShowIosForm(false)}
          />
        ) : (
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <Key className="mx-auto text-gray-600 mb-2" size={32} />
            <p className="text-gray-400">No iOS credentials configured</p>
          </div>
        )}
      </div>

      {/* Android Credentials */}
      <div className="border-t border-gray-800 pt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot size={20} className="text-gray-400" />
            <h2 className="text-lg font-medium text-white">Android Credentials</h2>
          </div>
          {!androidCredential && !showAndroidForm && (
            <button
              onClick={() => setShowAndroidForm(true)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              + Add Android Credentials
            </button>
          )}
        </div>

        {androidCredential ? (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 size={16} className="text-green-400" />
                  <span className="text-white font-medium">Keystore</span>
                </div>
                <div className="text-sm text-gray-400 space-y-0.5">
                  <p>Key Alias: {androidCredential.metadata.keyAlias}</p>
                  {androidCredential.metadata.validUntil && (
                    <p>Valid Until: {new Date(androidCredential.metadata.validUntil).toLocaleDateString()}</p>
                  )}
                  {androidCredential.metadata.fingerprintSha256 && (
                    <p className="font-mono text-xs">SHA256: {androidCredential.metadata.fingerprintSha256.substring(0, 20)}...</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDelete(androidCredential.id)}
                className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors text-sm"
              >
                Remove
              </button>
            </div>
          </div>
        ) : showAndroidForm ? (
          <AndroidCredentialForm
            app={app}
            storeId={storeId}
            token={token}
            onSuccess={(cred) => {
              onUpdate([...credentials, cred]);
              setShowAndroidForm(false);
            }}
            onCancel={() => setShowAndroidForm(false)}
          />
        ) : (
          <div className="bg-gray-800/50 rounded-lg p-6 text-center">
            <Key className="mx-auto text-gray-600 mb-2" size={32} />
            <p className="text-gray-400">No Android credentials configured</p>
          </div>
        )}
      </div>
    </div>
  );
}

// iOS Credential Form
function IosCredentialForm({
  app,
  storeId,
  token,
  onSuccess,
  onCancel,
}: {
  app: App;
  storeId: string;
  token: string;
  onSuccess: (cred: AppCredential) => void;
  onCancel: () => void;
}) {
  const [p12File, setP12File] = useState<File | null>(null);
  const [provisioningFile, setProvisioningFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!p12File || !provisioningFile || !password) return;

    setUploading(true);
    setError(null);

    try {
      const p12Base64 = await fileToBase64(p12File);
      const provisioningBase64 = await fileToBase64(provisioningFile);

      const result = await credentialsApi.uploadIos(token, storeId, app.id, {
        certificate_p12: p12Base64,
        password,
        provisioning_profile: provisioningBase64,
      });

      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload credentials');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Distribution Certificate (.p12)
        </label>
        <input
          type="file"
          accept=".p12"
          onChange={(e) => setP12File(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-gray-700 file:text-white hover:file:bg-gray-600"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Certificate Password
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Provisioning Profile (.mobileprovision)
        </label>
        <input
          type="file"
          accept=".mobileprovision"
          onChange={(e) => setProvisioningFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-gray-700 file:text-white hover:file:bg-gray-600"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={uploading || !p12File || !provisioningFile || !password}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          Upload
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Android Credential Form
function AndroidCredentialForm({
  app,
  storeId,
  token,
  onSuccess,
  onCancel,
}: {
  app: App;
  storeId: string;
  token: string;
  onSuccess: (cred: AppCredential) => void;
  onCancel: () => void;
}) {
  const [keystoreFile, setKeystoreFile] = useState<File | null>(null);
  const [keystorePassword, setKeystorePassword] = useState('');
  const [keyAlias, setKeyAlias] = useState('');
  const [keyPassword, setKeyPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!keystoreFile || !keystorePassword || !keyAlias || !keyPassword) return;

    setUploading(true);
    setError(null);

    try {
      const keystoreBase64 = await fileToBase64(keystoreFile);

      const result = await credentialsApi.uploadAndroid(token, storeId, app.id, {
        keystore: keystoreBase64,
        keystore_password: keystorePassword,
        key_alias: keyAlias,
        key_password: keyPassword,
      });

      onSuccess(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload credentials');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded p-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Keystore File (.jks or .keystore)
        </label>
        <input
          type="file"
          accept=".jks,.keystore"
          onChange={(e) => setKeystoreFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-gray-700 file:text-white hover:file:bg-gray-600"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Keystore Password
          </label>
          <input
            type="password"
            value={keystorePassword}
            onChange={(e) => setKeystorePassword(e.target.value)}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Key Alias
          </label>
          <input
            type="text"
            value={keyAlias}
            onChange={(e) => setKeyAlias(e.target.value)}
            placeholder="upload"
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Key Password
        </label>
        <input
          type="password"
          value={keyPassword}
          onChange={(e) => setKeyPassword(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          onClick={handleSubmit}
          disabled={uploading || !keystoreFile || !keystorePassword || !keyAlias || !keyPassword}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
        >
          {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
          Upload
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Builds Tab
// ============================================================================

interface BuildsTabProps {
  app: App;
  storeId: string;
  token: string;
  builds: Build[];
  readiness: BuildReadiness | null;
  onRefresh: () => void;
}

function BuildsTab({ app, storeId, token, builds, readiness, onRefresh }: BuildsTabProps) {
  const [platform, setPlatform] = useState<'ios' | 'android'>('android');
  const [versionName, setVersionName] = useState('1.0.0');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartBuild = async () => {
    setBuilding(true);
    setError(null);

    try {
      await buildsApi.create(token, storeId, app.id, {
        platform,
        version_name: versionName,
        build_type: 'release',
      });
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start build');
    } finally {
      setBuilding(false);
    }
  };

  const handleDownload = async (buildId: string) => {
    try {
      const result = await buildsApi.getDownloadUrl(token, storeId, app.id, buildId);
      window.open(result.url, '_blank');
    } catch (err) {
      console.error('Failed to get download URL:', err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'built':
        return 'bg-green-900/50 text-green-300';
      case 'running':
      case 'building':
        return 'bg-blue-900/50 text-blue-300';
      case 'pending':
        return 'bg-yellow-900/50 text-yellow-300';
      case 'failed':
        return 'bg-red-900/50 text-red-300';
      default:
        return 'bg-gray-700 text-gray-400';
    }
  };

  const canBuild = readiness?.ready || false;

  return (
    <div className="space-y-6">
      {/* Build Readiness */}
      {readiness && !readiness.ready && (
        <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-400 mb-2">
            <AlertCircle size={18} />
            <span className="font-medium">Missing Requirements</span>
          </div>
          <ul className="text-sm text-yellow-300/80 space-y-1 ml-6">
            {readiness.missing.map((item, i) => (
              <li key={i}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* New Build Form */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-white font-medium mb-4">Start New Build</h3>
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded p-3 text-sm text-red-400 mb-4">
            {error}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as 'ios' | 'android')}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="android">Android (APK)</option>
              <option value="ios">iOS (IPA)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Version</label>
            <input
              type="text"
              value={versionName}
              onChange={(e) => setVersionName(e.target.value)}
              placeholder="1.0.0"
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleStartBuild}
              disabled={building || !canBuild}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              {building ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Hammer size={18} />
              )}
              Start Build
            </button>
          </div>
        </div>
      </div>

      {/* Build History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Build History</h3>
          <button
            onClick={onRefresh}
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {builds.length === 0 ? (
          <div className="bg-gray-800/50 rounded-lg p-8 text-center">
            <Hammer className="mx-auto text-gray-600 mb-2" size={32} />
            <p className="text-gray-400">No builds yet</p>
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Platform</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Started</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {builds.map((build) => (
                  <tr key={build.id} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3">
                      <span className="text-white font-mono">{build.version.version_name}</span>
                      <span className="text-gray-500 text-sm ml-2">({build.version.version_code})</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-gray-300">
                        {build.version.platform === 'ios' ? <Apple size={14} /> : <Bot size={14} />}
                        {build.version.platform === 'ios' ? 'iOS' : 'Android'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(build.job.status)}`}>
                        {build.job.status === 'running' && <Loader2 size={12} className="animate-spin" />}
                        {build.job.status === 'completed' && <Check size={12} />}
                        {build.job.status === 'failed' && <X size={12} />}
                        {build.job.status === 'pending' && <Clock size={12} />}
                        {build.job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {build.job.started_at
                        ? new Date(build.job.started_at).toLocaleString()
                        : new Date(build.job.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {build.job.status === 'completed' && build.version.artifact_url && (
                        <button
                          onClick={() => handleDownload(build.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-600/20 text-green-400 rounded hover:bg-green-600/30 transition-colors text-sm"
                        >
                          <Download size={14} />
                          Download
                        </button>
                      )}
                      {build.job.status === 'failed' && build.job.error_message && (
                        <span className="text-red-400 text-xs" title={build.job.error_message}>
                          Error
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:application/octet-stream;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
  });
}
