'use client';

import { useState } from 'react';
import { Smartphone, Palette, Globe, Rocket, Check } from 'lucide-react';

type Step = 'config' | 'design' | 'preview' | 'build';

export default function AppBuilderPage() {
  const [currentStep, setCurrentStep] = useState<Step>('config');

  const steps = [
    { id: 'config' as Step, name: 'Configuration', icon: Globe },
    { id: 'design' as Step, name: 'Design', icon: Palette },
    { id: 'preview' as Step, name: 'Preview', icon: Smartphone },
    { id: 'build' as Step, name: 'Build', icon: Rocket },
  ];

  const stepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">App Builder</h1>
        <p className="text-gray-400 mt-1">Configure and build your mobile app</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between max-w-2xl">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 ${
                index <= stepIndex ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                index < stepIndex
                  ? 'bg-blue-600 text-white'
                  : index === stepIndex
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400'
              }`}>
                {index < stepIndex ? <Check size={16} /> : <step.icon size={16} />}
              </div>
              <span className="text-sm font-medium hidden sm:block">{step.name}</span>
            </button>
            {index < steps.length - 1 && (
              <div className={`w-12 lg:w-24 h-0.5 mx-2 ${
                index < stepIndex ? 'bg-blue-600' : 'bg-gray-700'
              }`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        {currentStep === 'config' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-white">App Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">App Name</label>
                <input
                  type="text"
                  placeholder="My Store App"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Bundle ID</label>
                <input
                  type="text"
                  placeholder="com.mystore.app"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Store URL</label>
                <input
                  type="url"
                  placeholder="https://mystore.com"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Version</label>
                <input
                  type="text"
                  placeholder="1.0.0"
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 'design' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-white">App Design</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Primary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    defaultValue="#3B82F6"
                    className="w-12 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    defaultValue="#3B82F6"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Secondary Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    defaultValue="#1E293B"
                    className="w-12 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    defaultValue="#1E293B"
                    className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">App Icon</label>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-gray-600 transition-colors cursor-pointer">
                  <p className="text-gray-400">Drop icon here or click to upload</p>
                  <p className="text-xs text-gray-500 mt-1">1024x1024 PNG recommended</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Splash Screen</label>
                <div className="border-2 border-dashed border-gray-700 rounded-lg p-8 text-center hover:border-gray-600 transition-colors cursor-pointer">
                  <p className="text-gray-400">Drop image here or click to upload</p>
                  <p className="text-xs text-gray-500 mt-1">2732x2732 PNG recommended</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'preview' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-white">App Preview</h2>
            <div className="flex justify-center">
              <div className="w-72 h-[580px] bg-gray-800 rounded-[3rem] p-3 shadow-xl">
                <div className="w-full h-full bg-gray-950 rounded-[2.5rem] overflow-hidden flex items-center justify-center">
                  <div className="text-center">
                    <Smartphone className="mx-auto text-gray-600 mb-4" size={48} />
                    <p className="text-gray-500">App preview will appear here</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'build' && (
          <div className="space-y-6">
            <h2 className="text-lg font-medium text-white">Build & Deploy</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-2xl"></span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium">iOS Build</h3>
                    <p className="text-sm text-gray-400">Build for App Store</p>
                  </div>
                </div>
                <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                  Start iOS Build
                </button>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                    <span className="text-2xl">🤖</span>
                  </div>
                  <div>
                    <h3 className="text-white font-medium">Android Build</h3>
                    <p className="text-sm text-gray-400">Build for Play Store</p>
                  </div>
                </div>
                <button className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                  Start Android Build
                </button>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Build History</h3>
              <p className="text-gray-500 text-sm">No builds yet. Start your first build above.</p>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => {
            const prev = steps[stepIndex - 1];
            if (prev) setCurrentStep(prev.id);
          }}
          disabled={stepIndex === 0}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => {
            const next = steps[stepIndex + 1];
            if (next) setCurrentStep(next.id);
          }}
          disabled={stepIndex === steps.length - 1}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next Step
        </button>
      </div>
    </div>
  );
}
