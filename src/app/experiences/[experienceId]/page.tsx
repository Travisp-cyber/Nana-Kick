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
  const [error, setError] = useState<string | null>(null);
  const [isDeleteMode, setIsDeleteMode] = useState<boolean>(false);
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<number>>(new Set());
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  // Debug logger (no-op in production)
  const debug = (...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') console.log(...args);
  };

  const restoreFromHistory = async (historyItem: ImageHistoryItem) => {
    // Don't restore if in delete mode
    if (isDeleteMode) return;
    
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

  const toggleDeleteMode = () => {
    setIsDeleteMode(!isDeleteMode);
    setSelectedForDeletion(new Set());
  };

  const toggleSelection = (index: number) => {
    const newSelection = new Set(selectedForDeletion);
    if (newSelection.has(index)) {
      newSelection.delete(index);
    } else {
      newSelection.add(index);
    }
    setSelectedForDeletion(newSelection);
  };

  const deleteSelected = async () => {
    // Check if current image is being deleted
    const deletedIndices = Array.from(selectedForDeletion);
    const currentImageIndex = imageHistory.findIndex(item => item.url === selectedImage);
    const currentImageDeleted = deletedIndices.includes(currentImageIndex);
    
    // Filter out the selected items
    const newHistory = imageHistory.filter((_, index) => !selectedForDeletion.has(index));
    
    // If the current image was deleted and there are remaining images, find the best replacement
    if (currentImageDeleted && newHistory.length > 0) {
      // Find the closest previous version that wasn't deleted
      let replacementIndex = -1;
      for (let i = currentImageIndex - 1; i >= 0; i--) {
        if (!selectedForDeletion.has(i)) {
          replacementIndex = i;
          break;
        }
      }
      
      // If no previous version, get the next available one
      if (replacementIndex === -1) {
        for (let i = currentImageIndex + 1; i < imageHistory.length; i++) {
          if (!selectedForDeletion.has(i)) {
            replacementIndex = i;
            break;
          }
        }
      }
      
      // Restore the replacement image before updating history
      if (replacementIndex !== -1) {
        const replacementItem = imageHistory[replacementIndex];
        // Set the new image immediately
        setSelectedImage(replacementItem.url);
        
        // Convert URL back to File object
        try {
          const response = await fetch(replacementItem.url);
          const blob = await response.blob();
          const file = new File([blob], `restored-${Date.now()}.png`, {
            type: blob.type || 'image/png'
          });
          setSelectedFile(file);
        } catch (error) {
          console.error('Error restoring image:', error);
        }
      }
    } else if (currentImageDeleted && newHistory.length === 0) {
      // Only clear if no images left
      setSelectedImage(null);
      setSelectedFile(null);
    }
    
    // Update history after setting the new image
    setImageHistory(newHistory);
    
    // Exit delete mode
    setIsDeleteMode(false);
    setSelectedForDeletion(new Set());
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
    setError(null);
    
    debug('Submitting form with instructions:', instructions.trim());

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('instructions', instructions.trim());

      // Detect if we're running inside Whop iframe by checking multiple indicators
      const isInIframe = window.parent !== window;
      const isWhopDomain = window.location.hostname.includes('whop.com');
      const referrerIsWhop = document.referrer.includes('whop.com');
      
      debug('=== Environment Detection ===');
      debug('- Is in iframe:', isInIframe);
      debug('- Is Whop domain:', isWhopDomain);
      debug('- Referrer is Whop:', referrerIsWhop);
      debug('- Window location:', window.location.href);
      debug('- Document referrer:', document.referrer);
      
      // Build the API URL based on environment
      let apiUrl: string;
      
      // If we're in an iframe or have Whop referrer, use the production URL
      if (isInIframe || referrerIsWhop) {
        // Use the production URL from environment variable
        const productionUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nana-kick.vercel.app';
        apiUrl = `${productionUrl}/api/process-image`;
        debug('Using production URL for API:', apiUrl);
      } else {
        // Local development
        apiUrl = `${window.location.origin}/api/process-image`;
        debug('Using local URL for API:', apiUrl);
      }
      
      debug('Final API URL:', apiUrl);
      debug('Submitting with FormData...');
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'include', // Include cookies if needed
      });
      
      debug('Response status:', response.status);
      debug('Response headers:', response.headers);

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
          debug('Image edited and updated');
        } else {
          // It's a JSON response (error or info)
          const result = await response.json();
          console.error('Server response:', result);
          setError(result.error || 'Failed to process image');
          alert(`Error: ${result.error}\n${result.message || ''}`);
        }
      } else {
        const result = await response.json();
        console.error('API Error:', result);
        setError(`API Error: ${result.error}`);
        alert(`API Error: ${result.error}\n${result.message || ''}`);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      alert(`Network Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Title in top left corner */}
      <div className="absolute top-8 left-8">
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 bg-clip-text text-transparent" style={{ fontFamily: 'var(--font-fredoka)' }}>
          Nana Kick
        </h1>
      </div>
      
      {/* Main content area - centered */}
      <div className="flex flex-col items-center justify-center p-8 pt-24 min-h-screen">
        <div className="w-full max-w-4xl mx-auto">
        
        {!selectedImage ? (
          <div className="flex flex-col items-center justify-center">
            <div className="w-full max-w-md">
              <label 
                htmlFor="thumbnail-upload" 
                className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-2xl cursor-pointer bg-white hover:bg-gray-50 transition-all hover:border-orange-300"
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg 
                    className="w-8 h-8 mb-4 text-orange-500"
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
                  <p className="mb-2 text-sm text-gray-600">
                    <span className="font-semibold">Click to upload</span> your image
                  </p>
                  <p className="text-xs text-gray-500">
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
                {hoveredImage ? (
                  <Image
                    key={hoveredImage}
                    src={hoveredImage}
                    alt="Preview thumbnail"
                    width={2400}
                    height={1800}
                    className="object-contain w-auto h-auto"
                    style={{ 
                      maxHeight: '70vh', 
                      maxWidth: '100%' 
                    }}
                    priority
                  />
                ) : (
                  <Image
                    key={selectedImage}
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
                )}
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="w-full max-w-3xl space-y-4">
              {error && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 px-4 py-3 rounded-lg mb-4">
                  <p className="font-semibold">Error:</p>
                  <p className="text-sm">{error}</p>
                </div>
              )}
              <div>
                <label 
                  htmlFor="instructions" 
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Instructions for editing the image:
                </label>
                <input
                  type="text"
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g., Make it brighter, add a red border, blur the background..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-500 transition-all hover:border-orange-300"
                  required
                />
              </div>
              
              <div className="flex gap-4 justify-center">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-8 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-full font-medium transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
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
                  className="px-6 py-3 bg-white hover:bg-gray-100 disabled:bg-gray-400 disabled:cursor-not-allowed text-gray-800 border border-gray-300 rounded-full font-medium transition-all transform hover:scale-105 shadow-md hover:shadow-lg"
                >
                  Upload Another Image
                </button>
              </div>
            </form>
          </div>
        )}
        </div>
      </div>
      
      {/* Image History Side Panel */}
      {imageHistory.length > 0 && (
        <>
          {/* Icon buttons on the left of the panel */}
          <div className="fixed right-48 top-0 h-full flex flex-col gap-2 p-2 z-10">
            <button
              onClick={toggleDeleteMode}
              className={`p-2 rounded-lg transition-all ${
                isDeleteMode
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-white text-orange-600 hover:bg-orange-50 shadow-md'
              }`}
              title={isDeleteMode ? 'Cancel selection' : 'Select items'}
            >
              {isDeleteMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            {isDeleteMode && selectedForDeletion.size > 0 && (
              <button
                onClick={deleteSelected}
                className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all shadow-md"
                title={`Delete ${selectedForDeletion.size} item${selectedForDeletion.size > 1 ? 's' : ''}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          
          {/* History panel */}
          <div className="fixed right-0 top-0 h-full w-48 bg-white/95 backdrop-blur-sm shadow-lg overflow-y-auto z-10">
            <div className="p-3 pt-4">
            <div className="space-y-3">
              {imageHistory.map((item, index) => (
                <div
                  key={`${item.timestamp.getTime()}-${index}`}
                  className={`relative ${
                    isDeleteMode && selectedForDeletion.has(index)
                      ? 'ring-2 ring-red-500 rounded-lg'
                      : ''
                  }`}
                >
                  <button
                    onClick={() => {
                      if (isDeleteMode) {
                        toggleSelection(index);
                      } else {
                        restoreFromHistory(item);
                      }
                    }}
                    onMouseEnter={() => {
                      if (!isDeleteMode) {
                        setHoveredImage(item.url);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredImage(null);
                    }}
                    className={`w-full group relative transition-all duration-200 hover:opacity-100 ${
                      selectedImage === item.url && !isDeleteMode
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
                      {isDeleteMode && (
                        <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-md">
                          <div className={`w-4 h-4 rounded border-2 ${
                            selectedForDeletion.has(index)
                              ? 'bg-red-500 border-red-500'
                              : 'bg-white border-gray-400'
                          }`}>
                            {selectedForDeletion.has(index) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-medium text-gray-700">
                        {index === 0 ? 'Original' : `Version ${index}`}
                      </p>
                      <p className="text-xs text-gray-500 opacity-75" title={item.prompt}>
                        {item.prompt}
                      </p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
}