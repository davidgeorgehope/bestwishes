"""
Card generation using xAI (Grok text + grok-imagine images).
Generates greeting card designs from text prompts and optional photos.
"""

import os
import json
import base64
import time
from typing import Generator, Optional, List
import httpx
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

XAI_BASE_URL = "https://api.x.ai/v1"
XAI_API_KEY = os.getenv("XAI_API_KEY")

# xAI client (OpenAI-compatible API)
client = OpenAI(api_key=XAI_API_KEY or "missing", base_url=XAI_BASE_URL)

# Models
TEXT_MODEL = "grok-4.3"
IMAGE_MODEL = "grok-imagine-image-2.0"


def _chat(system_prompt: str, user_message: str, temperature: float, max_tokens: int) -> str:
    response = client.chat.completions.create(
        model=TEXT_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return response.choices[0].message.content or ""


def emit_event(event_type: str, **kwargs) -> str:
    """Create a JSON event string for SSE."""
    event = {"type": event_type, **kwargs}
    return json.dumps(event)


def refine_card_prompt(user_prompt: str, occasion: str = None, style: str = None) -> str:
    """
    Use Grok to refine the user's prompt into a detailed image generation prompt.
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

    return _chat(system_prompt, user_message, 0.8, 500).strip()


def generate_card_image(prompt: str, photo_data: List[bytes] = None) -> Optional[dict]:
    """
    Generate a card image using xAI grok-imagine.

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
        headers = {"Authorization": f"Bearer {XAI_API_KEY}"}
        body = {"model": IMAGE_MODEL, "response_format": "b64_json"}
        if photo_data:
            # Reference photo -> xAI image edit endpoint (uses the first photo)
            photo = photo_data[0]
            mime_type = "image/png" if photo[:8] == b'\x89PNG\r\n\x1a\n' else "image/jpeg"
            data_url = f"data:{mime_type};base64,{base64.b64encode(photo).decode()}"
            body.update(
                prompt="Create a greeting card design that incorporates or is inspired by this reference photo.\n\n" + full_prompt,
                image={"url": data_url, "type": "image_url"},
            )
            url = f"{XAI_BASE_URL}/images/edits"
        else:
            body.update(prompt=full_prompt, aspect_ratio="2:3")
            url = f"{XAI_BASE_URL}/images/generations"

        resp = httpx.post(url, headers=headers, json=body, timeout=180)
        resp.raise_for_status()
        b64 = resp.json()["data"][0]["b64_json"]
        return {'image_data': base64.b64decode(b64), 'mime_type': 'image/jpeg'}

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
        text = _chat(system_prompt, user_message, 0.9, 300)

        lines = text.strip().split('\n')
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
