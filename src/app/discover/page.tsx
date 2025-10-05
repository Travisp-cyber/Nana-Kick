'use client';

import { iframeApi } from '@whop/react';

export default function DiscoverPage() {
  const handleAddToWhop = async () => {
    try {
      await iframeApi.requestInstall();
    } catch (error) {
      console.error('Failed to install app:', error);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            AI-Powered Image Editor
          </h1>
          <p className="text-xl text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
            Transform your images with AI. Upload any image and describe what changes you want - our AI will handle the rest.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Simple Upload</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Just upload your image and tell us what you want to change. No complex tools or learning curve.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">AI-Powered Edits</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Our advanced AI understands natural language instructions to make precise edits to your images.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold mb-2">Version History</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Keep track of all your edits and easily revert to any previous version of your image.
            </p>
          </div>
        </div>

        {/* Use Cases */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg mb-16">
          <h2 className="text-3xl font-bold mb-6 text-center">Perfect for Creators</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-lg mb-2">🎨 Content Creators</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Quickly edit thumbnails, social media posts, and promotional materials.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-2">🛍️ E-commerce</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Enhance product photos, remove backgrounds, and create variations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-2">📱 Social Media Managers</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Create eye-catching visuals that stand out in feeds.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-2">🎮 Gaming Communities</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Edit screenshots, create custom graphics, and enhance game art.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to transform your images?</h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Add this app to your Whop community and give your members access to powerful AI image editing.
          </p>
          <button 
            onClick={handleAddToWhop}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:from-blue-700 hover:to-indigo-700 transition-colors"
          >
            Add to Your Whop
          </button>
        </div>
      </div>
    </div>
  );
}