'use client';

export default function DiscoverPage() {

  const handleAddToWhop = () => {
    const appId = process.env.NEXT_PUBLIC_WHOP_APP_ID;
    if (!appId) {
      console.warn('Missing NEXT_PUBLIC_WHOP_APP_ID. Cannot open install page.');
      return;
    }

    // Direct redirect to the Whop app install page
    const installUrl = `https://whop.com/apps/${appId}`;
    
    // Use window.top to break out of iframe if needed
    if (window.top) {
      window.top.location.href = installUrl;
    } else {
      window.location.href = installUrl;
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 bg-clip-text text-transparent mb-8" style={{ fontFamily: 'var(--font-fredoka)' }}>
            Nana Kick
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto font-light">
            Transform your images with AI. Upload any image and describe what changes you want - our AI will handle the rest.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Simple Upload</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Just upload your image and tell us what you want to change. No complex tools or learning curve.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">AI-Powered Edits</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Our advanced AI understands natural language instructions to make precise edits to your images.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow">
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-100 to-orange-100 dark:from-yellow-900 dark:to-orange-900 rounded-xl flex items-center justify-center mb-5">
              <svg className="w-7 h-7 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-gray-200">Version History</h3>
            <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
              Keep track of all your edits and easily revert to any previous version of your image.
            </p>
          </div>
        </div>

        {/* Use Cases */}
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 shadow-sm mb-20">
          <h2 className="text-3xl font-bold mb-10 text-center text-gray-800 dark:text-gray-200">Perfect for Creators</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex gap-4">
              <span className="text-2xl">🎨</span>
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-200">Content Creators</h4>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Quickly edit thumbnails, social media posts, and promotional materials.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-2xl">🛍️</span>
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-200">E-commerce</h4>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Enhance product photos, remove backgrounds, and create variations.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-2xl">📱</span>
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-200">Social Media Managers</h4>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Create eye-catching visuals that stand out in feeds.
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <span className="text-2xl">🎮</span>
              <div>
                <h4 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-200">Gaming Communities</h4>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Edit screenshots, create custom graphics, and enhance game art.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-6 text-gray-800 dark:text-gray-200">Ready to transform your images?</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Add this app to your Whop community and give your members access to powerful AI image editing.
          </p>
          <button 
            onClick={handleAddToWhop}
            className="bg-gradient-to-r from-orange-500 to-yellow-500 text-white px-10 py-4 rounded-full font-semibold text-lg hover:from-orange-600 hover:to-yellow-600 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Add to Your Whop
          </button>
        </div>
      </div>
    </div>
  );
}