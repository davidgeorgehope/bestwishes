'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  FolderHeart,
  Images,
  LogOut,
  Loader2,
  Upload,
  X,
  Heart
} from 'lucide-react';

type Tab = 'create' | 'my-cards' | 'gallery';

interface Card {
  id: number;
  prompt: string;
  occasion: string | null;
  style: string | null;
  base_message: string | null;
  status: string;
  created_at: number;
}

interface Example {
  id: number;
  prompt: string;
  occasion: string | null;
  style_tags: string[];
  is_featured: boolean;
}

interface CardVariant {
  index: number;
  image_base64: string;
  mime_type: string;
  variation: string;
}

export default function Home() {
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('create');

  // Create tab state
  const [prompt, setPrompt] = useState('');
  const [occasion, setOccasion] = useState('');
  const [style, setStyle] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generatedVariants, setGeneratedVariants] = useState<CardVariant[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<number | null>(null);

  // My Cards state
  const [cards, setCards] = useState<Card[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // Gallery state
  const [examples, setExamples] = useState<Example[]>([]);
  const [loadingExamples, setLoadingExamples] = useState(false);
  const [occasionFilter, setOccasionFilter] = useState('');

  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message });
  };

  const loadCards = useCallback(async () => {
    if (!token) return;
    setLoadingCards(true);
    try {
      const response = await fetch('/api/cards', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCards(data.cards || []);
      }
    } catch (error) {
      console.error('Failed to load cards:', error);
    } finally {
      setLoadingCards(false);
    }
  }, [token]);

  const loadExamples = useCallback(async () => {
    setLoadingExamples(true);
    try {
      const url = occasionFilter
        ? `/api/examples?occasion=${encodeURIComponent(occasionFilter)}`
        : '/api/examples';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setExamples(data.examples || []);
      }
    } catch (error) {
      console.error('Failed to load examples:', error);
    } finally {
      setLoadingExamples(false);
    }
  }, [occasionFilter]);

  // Load data when tab changes
  useEffect(() => {
    if (activeTab === 'my-cards' && token) {
      loadCards();
    } else if (activeTab === 'gallery') {
      loadExamples();
    }
  }, [activeTab, token, loadCards, loadExamples]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newPhotos = Array.from(files).slice(0, 5 - photos.length);
      setPhotos([...photos, ...newPhotos]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      showNotification('error', 'Please enter a description for your card');
      return;
    }

    setIsGenerating(true);
    setGenerationProgress('Starting...');
    setGeneratedVariants([]);
    setSelectedVariant(null);

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      if (occasion) formData.append('occasion', occasion);
      if (style) formData.append('style', style);
      photos.forEach(photo => formData.append('photos', photo));

      const response = await fetch('/api/cards/generate-stream', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      const tempVariants: CardVariant[] = [];

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'progress') {
                setGenerationProgress(data.message);
              } else if (data.type === 'variant_ready') {
                setGenerationProgress(`Generated ${data.variation} design...`);
              } else if (data.type === 'complete') {
                if (data.variants && data.variants.length > 0) {
                  setGeneratedVariants(data.variants);
                  setSelectedVariant(0);
                  showNotification('success', data.message || 'Cards generated!');
                } else {
                  showNotification('error', 'No card designs were generated');
                }
              } else if (data.type === 'error') {
                showNotification('error', data.message);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      showNotification('error', 'Failed to generate card. Please try again.');
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const handleStartOver = () => {
    setGeneratedVariants([]);
    setSelectedVariant(null);
    setPrompt('');
    setOccasion('');
    setStyle('');
    setPhotos([]);
  };

  const handleUseExample = (example: Example) => {
    setPrompt(example.prompt);
    setOccasion(example.occasion || '');
    setStyle(example.style_tags?.join(', ') || '');
    setActiveTab('create');
    showNotification('info', 'Example loaded! Customize and generate your card.');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
      </div>
    );
  }

  if (!user) return null;

  const tabs = [
    { id: 'create' as Tab, label: 'Create', icon: Sparkles },
    { id: 'my-cards' as Tab, label: 'My Cards', icon: FolderHeart },
    { id: 'gallery' as Tab, label: 'Gallery', icon: Images },
  ];

  const occasions = [
    'Birthday', 'Christmas', 'Thank You', 'Wedding', 'Anniversary',
    'Baby Shower', 'Graduation', 'Get Well', 'Sympathy', 'Other'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-600' :
          notification.type === 'error' ? 'bg-red-600' : 'bg-blue-600'
        } text-white max-w-md`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-8 h-8 text-rose-500" />
            <h1 className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              Best Wishes
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">{user.email}</span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? 'text-rose-600 border-rose-500'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Create Tab */}
        {activeTab === 'create' && (
          <div className="max-w-4xl mx-auto">
            {/* Show variant selection if we have generated variants */}
            {generatedVariants.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900">Choose Your Card Design</h2>
                  <button
                    onClick={handleStartOver}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    Start Over
                  </button>
                </div>

                {/* Variant Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {generatedVariants.map((variant) => (
                    <button
                      key={variant.index}
                      onClick={() => setSelectedVariant(variant.index)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all shadow-md ${
                        selectedVariant === variant.index
                          ? 'border-rose-500 ring-2 ring-rose-500/50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="aspect-[5/7]">
                        <img
                          src={`data:${variant.mime_type};base64,${variant.image_base64}`}
                          alt={`${variant.variation} design`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <span className="text-white text-xs capitalize">{variant.variation}</span>
                      </div>
                      {selectedVariant === variant.index && (
                        <div className="absolute top-2 right-2 bg-rose-500 rounded-full p-1">
                          <Heart className="w-3 h-3 text-white fill-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Selected variant preview and actions */}
                {selectedVariant !== null && (
                  <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-lg">
                    <div className="flex gap-6">
                      {/* Preview */}
                      <div className="flex-1">
                        <img
                          src={`data:${generatedVariants[selectedVariant].mime_type};base64,${generatedVariants[selectedVariant].image_base64}`}
                          alt="Selected card"
                          className="w-full max-w-md mx-auto rounded-lg shadow-lg"
                        />
                      </div>
                      {/* Actions */}
                      <div className="w-64 space-y-4">
                        <h3 className="text-lg font-medium text-gray-900">Card Options</h3>
                        <p className="text-gray-600 text-sm">
                          {prompt.length > 100 ? prompt.slice(0, 100) + '...' : prompt}
                        </p>
                        <button
                          onClick={() => {
                            showNotification('info', 'Save functionality coming soon!');
                          }}
                          className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:opacity-90 text-white font-medium rounded-lg transition-opacity"
                        >
                          Save Card
                        </button>
                        <button
                          onClick={handleGenerate}
                          disabled={isGenerating}
                          className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors flex items-center justify-center gap-2 border border-gray-300"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Regenerating...
                            </>
                          ) : (
                            'Regenerate'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Show the creation form */
              <div className="max-w-2xl mx-auto">
                <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-lg">
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Create a Card</h2>

                  {/* Prompt */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Describe your card
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="e.g., Birthday card for my mum who loves gardening and cats, make it funny but not crude"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
                      rows={4}
                      disabled={isGenerating}
                    />
                  </div>

                  {/* Occasion & Style */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Occasion
                      </label>
                      <select
                        value={occasion}
                        onChange={(e) => setOccasion(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        disabled={isGenerating}
                      >
                        <option value="">Select occasion...</option>
                        {occasions.map(o => (
                          <option key={o} value={o.toLowerCase()}>{o}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Style (optional)
                      </label>
                      <input
                        type="text"
                        value={style}
                        onChange={(e) => setStyle(e.target.value)}
                        placeholder="e.g., playful, elegant, minimal"
                        className="w-full px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                        disabled={isGenerating}
                      />
                    </div>
                  </div>

                  {/* Photo Upload */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Photos (optional, up to 5)
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {photos.map((photo, index) => (
                        <div key={index} className="relative">
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Photo ${index + 1}`}
                            className="w-20 h-20 object-cover rounded-lg border border-gray-300"
                          />
                          <button
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                            disabled={isGenerating}
                          >
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                      {photos.length < 5 && (
                        <label className={`w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-400 transition-colors ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoUpload}
                            className="hidden"
                            multiple
                            disabled={isGenerating}
                          />
                          <Upload className="w-6 h-6 text-gray-400" />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="w-full py-3 bg-gradient-to-r from-rose-600 to-pink-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-opacity flex items-center justify-center gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {generationProgress || 'Generating...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Card
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* My Cards Tab */}
        {activeTab === 'my-cards' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-6">My Cards</h2>
            {loadingCards ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              </div>
            ) : cards.length === 0 ? (
              <div className="text-center py-12 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm">
                <FolderHeart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">You have not created any cards yet</p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
                >
                  Create your first card
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {cards.map((card) => (
                  <div key={card.id} className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="aspect-[5/7] bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                      <Heart className="w-12 h-12 text-gray-300" />
                    </div>
                    <p className="text-gray-900 text-sm font-medium truncate">{card.prompt}</p>
                    <p className="text-gray-500 text-xs mt-1">
                      {card.occasion || 'General'} • {new Date(card.created_at * 1000).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Gallery Tab */}
        {activeTab === 'gallery' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Inspiration Gallery</h2>
              <select
                value={occasionFilter}
                onChange={(e) => {
                  setOccasionFilter(e.target.value);
                  loadExamples();
                }}
                className="px-4 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">All occasions</option>
                {occasions.map(o => (
                  <option key={o} value={o.toLowerCase()}>{o}</option>
                ))}
              </select>
            </div>
            {loadingExamples ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              </div>
            ) : examples.length === 0 ? (
              <div className="text-center py-12 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl shadow-sm">
                <Images className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No examples available yet</p>
                <p className="text-gray-500 text-sm mt-2">Check back soon for inspiration!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {examples.map((example) => (
                  <div key={example.id} className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-4 group shadow-sm">
                    <div className="aspect-[5/7] bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                      <Heart className="w-12 h-12 text-gray-300" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={() => handleUseExample(example)}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm rounded-lg transition-colors"
                        >
                          Use this
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-900 text-sm">{example.prompt}</p>
                    {example.style_tags && example.style_tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {example.style_tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
