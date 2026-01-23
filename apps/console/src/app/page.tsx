export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white mb-4">
          AppFy
        </h1>
        <p className="text-xl text-gray-400 mb-8">
          E-commerce App Builder
        </p>
        <div className="inline-flex items-center px-4 py-2 bg-green-500/20 text-green-400 rounded-full text-sm">
          <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
          Phase 1 Complete - Console Coming Soon
        </div>
      </div>
    </main>
  );
}
