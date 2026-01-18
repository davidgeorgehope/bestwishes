import { NextResponse } from "next/server";

export async function GET() {
  const markdown = `# Best Wishes

Create Beautiful Cards with AI Magic

Generate personalized greeting cards for any occasion in seconds. Just describe what you want, and let AI bring your wishes to life.

## Features

### AI-Powered
Advanced AI generates unique designs based on your description.

### Personalized
Customize every detail to match your style and message.

### Print Ready
High-resolution 300 DPI output perfect for professional printing.

### Easy Sharing
Share digitally or download to print at home or professionally.

## How It Works

### 1. Describe
Tell us about the recipient and occasion. Include details like interests, hobbies, or the mood you want.

### 2. Generate
Our AI creates multiple unique card designs tailored to your description. Pick your favorite.

### 3. Share
Download your card in high resolution or share it digitally with your loved ones.

## Occasions

- Birthday
- Christmas
- Thank You
- Wedding
- Anniversary
- Baby Shower
- Graduation
- Get Well
- Sympathy
- And more...

## Get Started

- [Start Creating Free](/signup) - No credit card required
- [Sign In](/login)
`;

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
