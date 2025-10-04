"use client";

import { useState } from "react";
import Image from "next/image";

interface ImageHistoryItem {
  url: string;
  prompt: string;
  timestamp: Date;
}

interface ExperiencePageProps {
  params: Promise<{ experienceId: string }>;
}

export default function ExperiencePage({ }: ExperiencePageProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [imageHistory, setImageHistory] = useState<ImageHistoryItem[]>([]);

  const restoreFromHistory = async (historyItem: ImageHistoryItem) => {
    // Set the selected image
    setSelectedImage(historyItem.url);
    
    // Convert URL back to File object
    try {
      const response = await fetch(historyItem.url);
      const blob = await response.blob();
      const file = new File([blob], `restored-${Date.now()}.png`, {
        type: blob.type || 'image/png'
      });
      setSelectedFile(file);
    } catch (error) {
      console.error('Error restoring image:', error);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        setSelectedImage(imageUrl);
        // Add original image to history
        setImageHistory([{
          url: imageUrl,
          prompt: 'Original upload',
          timestamp: new Date()
        }]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!selectedFile || !instructions.trim()) {
      alert('Please select an image and provide instructions.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('instructions', instructions.trim());

      const response = await fetch('/api/process-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        // Check if response is an image
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('image')) {
          // It's an image response - convert to blob and display
          const imageBlob = await response.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          
          // Create a new File object from the blob for future edits
          const newFile = new File([imageBlob], `edited-${Date.now()}.png`, {
            type: imageBlob.type
          });
          
          // Update the displayed image and file with the edited version
          setSelectedImage(imageUrl);
          setSelectedFile(newFile);
          
          // Add to history
          setImageHistory(prev => [...prev, {
            url: imageUrl,
            prompt: instructions.trim(),
            timestamp: new Date()
          }]);
          
          setInstructions(''); // Clear instructions for next edit
          console.log('Image edited and updated');
        } else {
          // It's a JSON response (error or info)
          const result = await response.json();
          console.log('Server response:', result);
        }
      } else {
        const result = await response.json();
        console.error('API Error:', result.error, result.message);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-8 relative">
      {/* Main content area - always centered */}
      <div className="w-full max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          AI Image Editor
        </h1>
        
        {!selectedImage ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-full max-w-md">
              <label 
                htmlFor="thumbnail-upload" 
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 transition-colors"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg 
                    className="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" 
                    aria-hidden="true" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 20 16"
                  >
                    <path 
                      stroke="currentColor" 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"
                    />
                  </svg>
                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> your image
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    PNG, JPG or JPEG (MAX. 10MB)
                  </p>
                </div>
                <input 
                  id="thumbnail-upload" 
                  type="file" 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-6">
            <div className="relative w-full flex justify-center">
              <div className="relative max-w-full rounded-lg overflow-hidden shadow-lg">
                <Image
                  src={selectedImage}
                  alt="Uploaded thumbnail"
                  width={2400}
                  height={1800}
                  className="object-contain w-auto h-auto"
                  style={{ 
                    maxHeight: '70vh', 
                    maxWidth: '100%' 
                  }}
                  priority
                />
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="w-full max-w-3xl space-y-4">
              <div>
                <label 
                  htmlFor="instructions" 
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Instructions for editing the image:
                </label>
                <input
                  type="text"
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g., Make it brighter, add a red border, blur the background..."
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  required
                />
              </div>
              
              <div className="flex gap-4 justify-center">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-8 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Processing...
                    </div>
                  ) : (
                    'Submit Instructions'
                  )}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setSelectedImage(null);
                    setSelectedFile(null);
                    setInstructions("");
                    setImageHistory([]);
                  }}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  Upload Another Image
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      
      {/* Image History Side Panel */}
      {imageHistory.length > 0 && (
        <div className="fixed right-0 top-0 h-full w-48 bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-lg overflow-y-auto z-10">
          <div className="p-3">
            <h3 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-3 sticky top-0 bg-gray-50/95 dark:bg-gray-900/95 py-2 -mx-3 px-3">
              Image History ({imageHistory.length} versions)
            </h3>
            <div className="space-y-3">
              {imageHistory.map((item, index) => (
                <button
                  key={`${item.timestamp.getTime()}-${index}`}
                  onClick={() => restoreFromHistory(item)}
                  className={`w-full group relative transition-all duration-200 hover:opacity-100 ${
                    selectedImage === item.url
                      ? 'opacity-100'
                      : 'opacity-60'
                  }`}
                >
                  <div className="relative overflow-hidden rounded-lg hover:shadow-lg transition-shadow">
                    <Image
                      src={item.url}
                      alt={`Version ${index + 1}: ${item.prompt}`}
                      width={160}
                      height={160}
                      className="object-cover w-full h-auto"
                    />
                  </div>
                  <div className="mt-2">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      {index === 0 ? 'Original' : `Version ${index}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 opacity-75" title={item.prompt}>
                      {item.prompt}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}