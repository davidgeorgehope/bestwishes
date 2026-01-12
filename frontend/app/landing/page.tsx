import Link from 'next/link';
import { Heart, Sparkles, Palette, Share2, Printer, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-8 h-8 text-rose-500" />
            <span className="text-2xl font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              Best Wishes
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Create Beautiful Cards with{' '}
            <span className="bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
              AI Magic
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Generate personalized greeting cards for any occasion in seconds.
            Just describe what you want, and let AI bring your wishes to life.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 text-lg"
            >
              Start Creating Free
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 bg-white border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors text-lg"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Hero Image Placeholder */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-2xl p-8 shadow-xl">
            <div className="grid grid-cols-3 gap-4">
              {['Birthday', 'Thank You', 'Wedding'].map((type, i) => (
                <div key={type} className="aspect-[5/7] bg-gradient-to-br from-rose-100 to-pink-100 rounded-xl flex flex-col items-center justify-center p-4 border border-rose-200">
                  <Heart className={`w-12 h-12 mb-2 ${i === 0 ? 'text-rose-400' : i === 1 ? 'text-pink-400' : 'text-rose-500'}`} />
                  <span className="text-gray-700 font-medium text-sm">{type}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Everything You Need to Create Perfect Cards
          </h2>
          <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            Powerful AI features that make card creation effortless and fun.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Sparkles,
                title: 'AI-Powered',
                description: 'Advanced AI generates unique designs based on your description',
                color: 'text-rose-500 bg-rose-100'
              },
              {
                icon: Palette,
                title: 'Personalized',
                description: 'Customize every detail to match your style and message',
                color: 'text-pink-500 bg-pink-100'
              },
              {
                icon: Printer,
                title: 'Print Ready',
                description: 'High-resolution 300 DPI output perfect for professional printing',
                color: 'text-rose-500 bg-rose-100'
              },
              {
                icon: Share2,
                title: 'Easy Sharing',
                description: 'Share digitally or download to print at home or professionally',
                color: 'text-pink-500 bg-pink-100'
              }
            ].map((feature) => (
              <div key={feature.title} className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gradient-to-br from-rose-50 via-white to-pink-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
            Create Cards in 3 Simple Steps
          </h2>
          <p className="text-xl text-gray-600 text-center mb-12 max-w-2xl mx-auto">
            From idea to beautiful card in under a minute.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Describe',
                description: 'Tell us about the recipient and occasion. Include details like interests, hobbies, or the mood you want.'
              },
              {
                step: '2',
                title: 'Generate',
                description: 'Our AI creates multiple unique card designs tailored to your description. Pick your favorite.'
              },
              {
                step: '3',
                title: 'Share',
                description: 'Download your card in high resolution or share it digitally with your loved ones.'
              }
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-rose-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Ready to Create Something Special?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Join thousands of people creating personalized cards with AI.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity text-lg"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <p className="text-gray-500 text-sm mt-4">No credit card required</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 py-8 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Heart className="w-6 h-6 text-rose-500" />
            <span className="font-semibold text-gray-900">Best Wishes</span>
          </div>
          <p className="text-gray-500 text-sm">
            AI-powered greeting cards for every occasion
          </p>
        </div>
      </footer>
    </div>
  );
}
