"""
Card generation using Google Gemini.
Generates greeting card designs from text prompts and optional photos.
"""

import os
import json
import base64
import time
from typing import Generator, Optional, List
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# Initialize Gemini client
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# Models
TEXT_MODEL = "gemini-3.8-flash"
IMAGE_MODEL = "gemini-3.1-flash-image"  # For image generation


def emit_event(event_type: str, **kwargs) -> str:
    """Create a JSON event string for SSE."""
    event = {"type": event_type, **kwargs}
    return json.dumps(event)


def refine_card_prompt(user_prompt: str, occasion: str = None, style: str = None) -> str:
    """
    Use Gemini to refine the user's prompt into a detailed image generation prompt.
    """
    system_prompt = """You are an expert greeting card designer. Your task is to transform a user's card request
into a detailed image generation prompt that will create a beautiful, printable greeting card design.

The card should:
- Be suitable for printing (clear, high contrast, good composition)
- Have a cohesive visual theme
- Leave appropriate space for a message (usually the bottom third or inside)
- Be visually appealing and appropriate for the occasion

Output ONLY the image generation prompt, nothing else. Make it detailed and specific about:
- Art style (watercolor, digital illustration, minimalist, vintage, etc.)
- Color palette
- Main visual elements
- Composition and layout
- Mood and atmosphere"""

    user_message = f"Create an image prompt for this greeting card request:\n\n{user_prompt}"
    if occasion:
        user_message += f"\n\nOccasion: {occasion}"
    if style:
        user_message += f"\n\nPreferred style: {style}"

    response = client.models.generate_content(
        model=TEXT_MODEL,
        contents=user_message,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.8,
            max_output_tokens=500
        )
    )

    return response.text.strip()


def generate_card_image(prompt: str, photo_data: List[bytes] = None) -> Optional[dict]:
    """
    Generate a card image using Gemini's image generation.

    Returns dict with 'image_data' (bytes) and 'mime_type' (str) or None on failure.
    """
    # Build the full prompt for card generation
    full_prompt = f"""Create a beautiful greeting card design based on this description:

{prompt}

Requirements:
- The image should be a complete greeting card front design
- Use a vertical/portrait orientation (like a real greeting card)
- Make it visually striking and suitable for printing
- Include appropriate decorative elements
- Leave some space at the bottom for a message"""

    try:
        # If we have photos, include them as reference
        contents = []

        if photo_data:
            # Add instruction about using the photos
            contents.append("Create a greeting card design that incorporates or is inspired by these reference photos:")
            for i, photo in enumerate(photo_data):
                # Detect mime type (assume JPEG if unknown)
                mime_type = "image/jpeg"
                if photo[:8] == b'\x89PNG\r\n\x1a\n':
                    mime_type = "image/png"
                elif photo[:2] == b'\xff\xd8':
                    mime_type = "image/jpeg"

                contents.append(types.Part.from_bytes(data=photo, mime_type=mime_type))
            contents.append(full_prompt)
        else:
            contents.append(full_prompt)

        response = client.models.generate_content(
            model=IMAGE_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                response_modalities=["image", "text"],
                temperature=1.0,
            )
        )

        # Extract the image from response
        if response.candidates and response.candidates[0].content.parts:
            for part in response.candidates[0].content.parts:
                if hasattr(part, 'inline_data') and part.inline_data:
                    return {
                        'image_data': part.inline_data.data,
                        'mime_type': part.inline_data.mime_type
                    }

        return None

    except Exception as e:
        print(f"Error generating card image: {e}")
        return None


def generate_card_variants_stream(
    user_id: int,
    prompt: str,
    occasion: str = None,
    style: str = None,
    photos: List[bytes] = None,
    num_variants: int = 4
) -> Generator[str, None, None]:
    """
    Generate multiple card design variants with progress updates.
    Yields SSE event strings.
    """
    yield emit_event("start", message="Starting card generation...")

    # Step 1: Refine the prompt
    yield emit_event("progress", step=1, total=num_variants + 2,
                     message="Crafting your card design...")

    try:
        refined_prompt = refine_card_prompt(prompt, occasion, style)
        yield emit_event("prompt_refined", refined_prompt=refined_prompt)
    except Exception as e:
        yield emit_event("error", message=f"Failed to process prompt: {str(e)}")
        return

    # Step 2: Generate variants
    variants = []

    for i in range(num_variants):
        yield emit_event("progress", step=i + 2, total=num_variants + 2,
                        message=f"Generating design {i + 1} of {num_variants}...")

        try:
            # Add variation instruction for diversity
            variation_prompts = [
                refined_prompt,  # Original
                f"{refined_prompt}\n\nMake this version more playful and colorful.",
                f"{refined_prompt}\n\nMake this version more elegant and sophisticated.",
                f"{refined_prompt}\n\nMake this version more minimalist and modern.",
            ]

            variant_prompt = variation_prompts[i] if i < len(variation_prompts) else refined_prompt

            result = generate_card_image(variant_prompt, photos)

            if result:
                variants.append({
                    'index': i,
                    'image_base64': base64.b64encode(result['image_data']).decode('utf-8'),
                    'mime_type': result['mime_type'],
                    'variation': ['original', 'playful', 'elegant', 'minimal'][i] if i < 4 else 'variant'
                })
                yield emit_event("variant_ready", index=i,
                               variation=['original', 'playful', 'elegant', 'minimal'][i] if i < 4 else 'variant')
            else:
                yield emit_event("variant_failed", index=i, message="Failed to generate this variant")

        except Exception as e:
            yield emit_event("variant_failed", index=i, message=str(e))

        # Small delay between generations to avoid rate limiting
        if i < num_variants - 1:
            time.sleep(1)

    # Step 3: Complete
    yield emit_event("progress", step=num_variants + 2, total=num_variants + 2,
                    message="Finalizing your cards...")

    if variants:
        yield emit_event("complete",
                        message=f"Generated {len(variants)} card designs!",
                        variants=variants,
                        prompt_used=refined_prompt)
    else:
        yield emit_event("error", message="Failed to generate any card designs. Please try again.")


def generate_card_message(
    prompt: str,
    occasion: str = None,
    recipient_info: str = None,
    tone: str = "warm"
) -> dict:
    """
    Generate a personalized message for a greeting card.

    Returns dict with 'message' and 'alternatives'.
    """
    system_prompt = """You are an expert at writing heartfelt, personalized greeting card messages.
Write messages that are:
- Genuine and warm (not generic or cliché)
- Appropriate length for a greeting card (2-4 sentences)
- Matching the requested tone
- Personal when recipient info is provided

Output format:
First line: The main recommended message
Then: 3 alternative messages, each on its own line starting with "ALT: "
"""

    user_message = f"Write a greeting card message for: {prompt}"
    if occasion:
        user_message += f"\nOccasion: {occasion}"
    if recipient_info:
        user_message += f"\nAbout the recipient: {recipient_info}"
    user_message += f"\nTone: {tone}"

    try:
        response = client.models.generate_content(
            model=TEXT_MODEL,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.9,
                max_output_tokens=300
            )
        )

        lines = response.text.strip().split('\n')
        main_message = lines[0] if lines else "Wishing you all the best!"
        alternatives = []

        for line in lines[1:]:
            if line.startswith("ALT: "):
                alternatives.append(line[5:].strip())
            elif line.strip() and not line.startswith("ALT"):
                alternatives.append(line.strip())

        # Ensure we have at least some alternatives
        if not alternatives:
            alternatives = [
                "Sending warm wishes your way!",
                "With love and best wishes!",
                "Thinking of you!"
            ]

        return {
            "message": main_message,
            "alternatives": alternatives[:3]
        }

    except Exception as e:
        print(f"Error generating message: {e}")
        return {
            "message": "Wishing you all the best!",
            "alternatives": [
                "Sending warm wishes your way!",
                "With love and best wishes!",
                "Thinking of you!"
            ]
        }
