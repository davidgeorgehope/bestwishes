# Best Wishes — Product Design Document

**Domain:** bestwishes.love

---

## Core Value Proposition

**"35 cards, 3 minutes, one checkout."**

**Best Wishes** is the anti-Moonpig: AI-generated designs without template hell, bulk sending without repetitive data entry, personalised messages without writing 35 variations yourself.

**Brand positioning:** The name "Best Wishes" is what you write at the end of a card — warm, universal, familiar. The .love TLD adds emotional resonance without being saccharine.

---

## User Personas

**Primary: "The Christmas Card Sender"**
- Sends 20-50 cards annually for holidays
- Currently spends 2+ hours on Moonpig
- Pain: Address entry, checkout per card, browsing templates
- Wants: Speed, personalisation at scale, "one and done"

**Secondary: "The Small Business Owner"**
- Sends thank-you cards to clients/customers
- Needs brand consistency
- Pain: Generic templates don't match brand voice
- Wants: Custom AI-generated designs, bulk personalisation

**Tertiary: "The Thoughtful Friend"**
- Sends cards for birthdays, occasions throughout year
- Values uniqueness over speed
- Pain: Moonpig cards feel generic
- Wants: AI to help create something that feels genuinely personal

---

## System Architecture — Best Wishes (High Level)

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Create  │  │ Address  │  │   Send   │  │ History  │            │
│  │   Flow   │  │   Book   │  │   Flow   │  │   View   │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
└───────┼─────────────┼─────────────┼─────────────┼───────────────────┘
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                           API LAYER                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Card Generation │ Address Mgmt │ Order Processing │ Auth    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  Nano Banana  │    │   Database    │    │   Print &     │
│  Pro (Gemini  │    │  (Users,      │    │   Fulfilment  │
│  3 Pro Image) │    │  Addresses,   │    │   Partner     │
│               │    │  Cards,       │    │   Integration │
│               │    │  Orders)      │    │               │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## Data Model

### User
```
User {
  id: UUID
  email: string
  name: string
  default_return_address: Address
  preferences: {
    default_style: string  // "playful", "elegant", "minimal"
    tone: string           // "funny", "heartfelt", "professional"
  }
  created_at: timestamp
}
```

### Contact (Address Book Entry)
```
Contact {
  id: UUID
  user_id: UUID
  name: string
  address: Address
  relationship: string     // "mum", "friend", "boss", "client"
  occasions: [
    { type: "birthday", date: date },
    { type: "anniversary", date: date }
  ]
  preferences: {
    tone: string           // "no mushy stuff", "loves puns"
    interests: string[]    // ["cats", "gardening", "golf"]
    avoid: string[]        // ["religious themes", "alcohol"]
  }
  created_at: timestamp
}
```

### Card
```
Card {
  id: UUID
  user_id: UUID
  prompt: string           // Original user prompt
  occasion: string         // "christmas", "birthday", "thank you"
  image_url: string        // Generated card artwork
  image_variants: string[] // Alternative generated options
  base_message: string     // Template message
  style_reference: string  // ID of example used as inspiration
  status: "draft" | "ready" | "sent"
  created_at: timestamp
}
```

### CardVariant (Per-Recipient Personalisation)
```
CardVariant {
  id: UUID
  card_id: UUID
  contact_id: UUID
  personalised_message: string
  preview_url: string      // Rendered preview with message
  status: "pending" | "printed" | "dispatched" | "delivered"
}
```

### Order
```
Order {
  id: UUID
  user_id: UUID
  card_id: UUID
  variants: CardVariant[]
  total_cards: int
  total_price: decimal
  payment_status: "pending" | "paid" | "failed"
  fulfilment_status: "processing" | "printing" | "dispatched"
  created_at: timestamp
}
```

---

## Core Flows

### Flow 1: Card Creation

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Start                                                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  "Start from    │  │  "Start from    │  │  "Browse        │  │
│  │   scratch"      │  │   a photo"      │  │   examples"     │  │
│  │   (AI prompt)   │  │   (upload)      │  │   (gallery)     │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Describe / Upload                                       │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  "60th birthday for my mum, she loves gardening and       │  │
│  │   cats, make it funny but not crude"                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [Upload photos: mum.jpg, her_garden.jpg]                        │
│                                                                   │
│  Occasion: [Birthday ▼]   Style: [Playful ▼]                     │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Generate & Select                                       │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  Option  │  │  Option  │  │  Option  │  │  Option  │        │
│  │    1     │  │    2     │  │    3     │  │    4     │        │
│  │  [img]   │  │  [img]   │  │  [img]   │  │  [img]   │        │
│  │          │  │    ✓     │  │          │  │          │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│                                                                   │
│  [Regenerate]  [Refine: "make the cat bigger"]                   │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Add Message                                             │
│                                                                   │
│  AI Suggestion:                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  "Happy 60th, Mum! Here's to another year of talking to   │  │
│  │   your plants and pretending the cat understands you.     │  │
│  │   (We both know he does.)"                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [Use this]  [Try another]  [Write my own]                       │
│                                                                   │
│  Font: [Handwritten ▼]   Inside/Outside: [Inside ▼]              │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
        [Save as Draft] or [Continue to Send]
```

### Flow 2: Bulk Send

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Select Card                                             │
│                                                                   │
│  [Use current card]  or  [Choose from saved drafts]              │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Select Recipients                                       │
│                                                                   │
│  Quick filters: [Family] [Friends] [Work] [Christmas List]       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ☑ Mum & Dad          │  123 Oak Lane, Bristol...       │   │
│  │  ☑ Sarah (sister)     │  45 High St, London...          │   │
│  │  ☑ Uncle Bob          │  78 Maple Ave, Manchester...    │   │
│  │  ☑ Janet (work)       │  90 Corporate Park...           │   │
│  │  ☐ Dave (ex)          │  ...                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Selected: 35 recipients                                         │
│  [Select all] [Select none] [Create new list]                    │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Personalisation Level                                   │
│                                                                   │
│  ○ Same message for all                                          │
│    "Merry Christmas! Love, David & Family"                       │
│                                                                   │
│  ● AI-personalised per recipient                                 │
│    Base: "Merry Christmas!"                                      │
│    AI adds personal touches based on relationship                │
│                                                                   │
│  ○ Manual per-recipient                                          │
│    Write individual messages for each                            │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Preview Grid                                            │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Mum & Dad   │  │ Sarah       │  │ Uncle Bob   │              │
│  │ [card img]  │  │ [card img]  │  │ [card img]  │   ...35      │
│  │ "Merry      │  │ "Merry      │  │ "Merry      │              │
│  │ Christmas   │  │ Christmas   │  │ Christmas   │              │
│  │ to the best │  │ sis! Can't  │  │ Bob! Hope   │              │
│  │ parents..." │  │ wait to..." │  │ the golf..." │              │
│  │ [Edit]      │  │ [Edit]      │  │ [Edit]      │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                   │
│  [Approve all] [Edit selected]                                   │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 5: Single Checkout                                         │
│                                                                   │
│  35 cards × £3.49 = £122.15                                      │
│  Delivery: Standard (5-7 days)                                   │
│                                                                   │
│  [Pay with Apple Pay]  [Pay with Card]                           │
│                                                                   │
│  ✓ Cards will be printed and posted directly to recipients       │
└─────────────────────────────────────────────────────────────────┘
```

### Flow 3: Examples / Inspiration Gallery

This is the "vibe off" feature you mentioned. Users browse real prompt+output examples.

```
┌─────────────────────────────────────────────────────────────────┐
│  INSPIRATION GALLERY                                             │
│                                                                   │
│  Filter: [All] [Birthday] [Christmas] [Thank You] [Wedding]      │
│          [Funny] [Elegant] [Photo-based] [Illustrated]           │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [CARD IMAGE]                                            │    │
│  │                                                          │    │
│  │  Whimsical illustration of a cat wearing a party hat,   │    │
│  │  surrounded by flowers, text integrated as garden sign   │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  PROMPT: "Birthday card for my mum who loves cats and           │
│  gardening, whimsical style, include 'Happy Birthday' as        │
│  a garden sign"                                                  │
│                                                                   │
│  OCCASION: Birthday  |  STYLE: Illustrated, Whimsical           │
│                                                                   │
│  [Use this as starting point]  [Save for later]                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [CARD IMAGE]                                            │    │
│  │                                                          │    │
│  │  Family photo merged into snowy scene, everyone         │    │
│  │  wearing illustrated Christmas jumpers, snow falling     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  PROMPT: "Christmas card using our family photo, make it        │
│  look like we're in a snowy scene, add illustrated Christmas    │
│  jumpers to everyone, cosy vibe"                                 │
│                                                                   │
│  PHOTOS USED: 1 family photo                                     │
│  OCCASION: Christmas  |  STYLE: Photo + Illustration Blend      │
│                                                                   │
│  [Use this as starting point]  [Save for later]                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  [CARD IMAGE]                                            │    │
│  │                                                          │    │
│  │  Elegant minimalist design, gold foil effect text,      │    │
│  │  subtle geometric pattern background                     │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
│  PROMPT: "Elegant thank you card for business clients,          │
│  minimalist, gold accents, professional but warm"                │
│                                                                   │
│  OCCASION: Thank You  |  STYLE: Elegant, Minimalist             │
│                                                                   │
│  [Use this as starting point]  [Save for later]                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Nano Banana Pro Integration

### Image Generation Call
```javascript
// Example API call structure
const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent", {
  method: "POST",
  headers: { "x-goog-api-key": API_KEY },
  body: JSON.stringify({
    contents: [{
      parts: [
        // User photos (up to 5 for person consistency)
        { inline_data: { mime_type: "image/jpeg", data: photo1Base64 } },
        { inline_data: { mime_type: "image/jpeg", data: photo2Base64 } },
        // Style reference from examples gallery
        { inline_data: { mime_type: "image/jpeg", data: styleReferenceBase64 } },
        // Prompt
        { text: `Create a greeting card design.
          Occasion: ${occasion}
          User request: ${userPrompt}
          Style: Match the style of the reference image.
          Integrate the people from the uploaded photos naturally.
          Include space for a message in ${messagePosition}.
          Aspect ratio: 5:7 (standard card portrait)
          
          Important: This is for print, so use high contrast and 
          ensure any text is legible.`
        }
      ]
    }],
    generationConfig: {
      responseModalities: ["image"],
      imageDimensions: { width: 2100, height: 2940 } // 300 DPI at 7x10 inches
    }
  })
});
```

### Photo Merging Strategy
Nano Banana Pro's 14-image context window enables:
1. User photos (up to 5 people with consistency)
2. Style reference images (from examples gallery)
3. Brand assets (for business users)
4. Previous generated iterations (for refinement)

### Text Rendering
Leverage Nano Banana Pro's text integration for:
- Card messages as integrated artwork (hand-lettered style, neon signs, etc.)
- Multi-language support for international sending
- Consistent typography across batch variants

---

## Example Prompt Library (Seed Content)

### Birthday
| Prompt | Style Tags | Notes |
|--------|------------|-------|
| "80th birthday for grandma, vintage floral, elegant but not boring, she was a dancer in her youth" | Vintage, Elegant, Floral | Good for showing photo integration |
| "30th birthday for my best mate, we're into hiking, make it funny, maybe a mountain with candles" | Funny, Illustrated, Outdoors | Shows humour integration |
| "Kids birthday party invite, dinosaur theme, bright colours, space for party details" | Playful, Bold, Kids | Demonstrates text integration |

### Christmas
| Prompt | Style Tags | Notes |
|--------|------------|-------|
| "Christmas card with our family photo (4 people + dog), make it look like a vintage holiday postcard" | Photo-based, Vintage, Family | Core use case |
| "Funny christmas card, our cat looking grumpy in a santa hat, minimal text" | Funny, Photo-based, Minimal | Pet cards are huge |
| "Elegant christmas card for business clients, winter scene, not religious, professional" | Elegant, Business, Minimal | B2B use case |

### Thank You
| Prompt | Style Tags | Notes |
|--------|------------|-------|
| "Wedding thank you card, using our wedding photo, romantic but not cheesy, gold accents" | Elegant, Photo-based, Romantic | Post-wedding batch send |
| "Thank you cards for baby shower guests, cute illustrated baby theme, pastel colours" | Illustrated, Cute, Pastel | Event follow-up |

### Sympathy / Difficult
| Prompt | Style Tags | Notes |
|--------|------------|-------|
| "Sympathy card, gentle watercolour flowers, peaceful, no religious symbols" | Gentle, Watercolour, Peaceful | Sensitive handling required |
| "Thinking of you card for friend going through divorce, supportive not patronising, nature theme" | Supportive, Nature, Subtle | Nuanced tone |

---

## Address Book Features

### Import Sources
- Google Contacts (OAuth)
- Apple Contacts (via iCloud export)
- CSV upload (standard format)
- Manual entry

### Smart Lists
- Auto-generated: "Family", "Friends", "Work"
- User-created: "Christmas 2024", "Wedding Guests"
- Occasion-based: "December Birthdays", "Upcoming Anniversaries"

### Relationship Intelligence
Used for AI message personalisation:
```
Contact: Uncle Bob
Relationship: uncle
Tone preference: "loves bad puns"
Interests: golf, classic cars
Avoid: "nothing political"
Last card sent: Christmas 2024

→ AI generates: "Merry Christmas Bob! Hope Santa brings you 
   a hole-in-one this year. Or at least a new putter to blame 
   when he doesn't. 🎄"
```

---

## Reminder System

Notifications from: hello@bestwishes.love

### Notification Types
1. **Occasion reminders**: "Sarah's birthday is in 2 weeks"
2. **Send prompts**: "You sent Christmas cards on Dec 10 last year"
3. **Delivery confirmation**: "Your card to Mum was delivered"

### Timing Logic
- Birthdays: 14 days before, 7 days before
- Christmas: October 15 (international), November 15 (domestic)
- User-configurable lead times

---

## Pricing Model

### Per Card
- Standard: £3.49 (includes postage)
- Premium (thicker stock): £4.49
- Photo cards: £3.99

### Bulk Discounts
- 10-24 cards: 10% off
- 25-49 cards: 15% off
- 50+ cards: 20% off

### Subscription (Optional)
- £5.99/month: 2 free cards + 20% off all orders
- £9.99/month: 5 free cards + 25% off + priority printing

---

## Print & Fulfilment

### Recommendation: Prodigi (Primary) + Gelato (US/Canada)

Best Wishes uses a dual-provider strategy to optimise for speed and cost based on recipient location.

### Why Prodigi as Primary

1. **"Mail4Me" Direct Delivery** — Prodigi prints the card, prints the personalised message inside, places it in an envelope, and posts directly to the recipient. This is the core capability Best Wishes needs — cards go from us to recipients, not to customers first.

2. **UK-based, UK-first** — Headquartered in Farnham/Alton, UK. Ideal for UK recipients (primary market).

3. **Greeting card specialism** — Classic and fine art options, multiple paper stocks (280gsm gloss, 324gsm Mohawk), eco-friendly/vegan certified.

4. **Solid API** — RESTful, well-documented, v4 supports multi-asset products (front, back, inside panels as separate image uploads).

5. **No subscription** — Pay per order, no monthly fees to start.

### Why Gelato for US/Canada

- 130+ production partners across 32 countries
- Multiple US facilities for local printing
- 72-hour fulfilment to US recipients
- Avoids transatlantic shipping costs and delays

### Routing Logic

| Recipient Location | Fulfilment Partner | Method |
|--------------------|-------------------|--------|
| UK | Prodigi | Mail4Me Direct Delivery (UK) |
| EU | Prodigi | Mail4Me Direct Delivery (UK) |
| US / Canada | Gelato | Local print + ship to recipient |
| Rest of World | Prodigi | Global shipping from UK |

### Unit Economics

| Component | UK (Prodigi) | US (Gelato) |
|-----------|--------------|-------------|
| Card + envelope | ~£0.80-1.20 | ~$1.00-1.50 |
| Inside message print | Included | Included |
| Postage (direct to recipient) | ~£1.00-1.50 | ~$2.00-3.00 |
| **Total cost** | **~£2.00-2.70** | **~$3.00-4.50** |
| Sell price | £3.49-3.99 | $4.49-4.99 |
| **Margin** | ~30-45% | ~25-35% |

### API Integration Overview

**Prodigi API (v4)**
```
POST https://api.prodigi.com/v4.0/Orders
{
  "merchantReference": "bestwishes-12345",
  "shippingMethod": "Standard",
  "recipient": {
    "name": "Mum & Dad",
    "address": { ... }
  },
  "items": [{
    "sku": "GLOBAL-GRC-HP-A5L",  // A5 Landscape greeting card
    "copies": 1,
    "assets": [
      { "printArea": "front", "url": "https://..." },
      { "printArea": "inside", "url": "https://..." }
    ]
  }]
}
```

**Gelato API**
```
POST https://order.gelatoapis.com/v4/orders
{
  "orderReferenceId": "bestwishes-12345",
  "customerReferenceId": "user-abc",
  "currency": "USD",
  "items": [{
    "itemReferenceId": "card-1",
    "productUid": "cards_pf_a6_pt_350-gsm-coated-silk",
    "files": [
      { "type": "default", "url": "https://..." }
    ],
    "quantity": 1
  }],
  "shippingAddress": { ... }
}
```

### Card Specifications

| Spec | UK (Prodigi) | US (Gelato) |
|------|--------------|-------------|
| Size | A5 (148×210mm) or A6 (105×148mm) | 5×7" or 4×6" |
| Paper | 324gsm Mohawk (fine art) or 280gsm gloss | 350gsm coated silk |
| Finish | Matte or gloss | Matte, silk, or gloss |
| Envelope | White, included | White, included |
| Bleed | 3mm | 3mm |
| Resolution | 300 DPI minimum | 300 DPI minimum |

### Nano Banana Pro → Print File Pipeline

```
User prompt + photos
        ↓
Nano Banana Pro generates card at 2100×2940px (300 DPI @ 7×10")
        ↓
Best Wishes adds:
  - Bleed margins (3mm)
  - Safe zone guides
  - Inside panel with message text
        ↓
Export as high-res PNG/PDF
        ↓
Upload to Prodigi/Gelato via signed URL
        ↓
Order submitted via API
        ↓
Card printed, enveloped, posted to recipient
```

### Webhook Events

Both providers support webhooks for order status updates:

- `order.created` — Order received
- `order.shipped` — Card dispatched (includes tracking where available)
- `order.delivered` — Delivery confirmed (limited availability)
- `order.cancelled` — Order cancelled
- `order.problem` — Issue with order (reprint needed, etc.)

---

## MVP Scope (v1)

### Must Have
- [ ] AI card generation (text prompt → image)
- [ ] Photo upload and merging (1-3 photos)
- [ ] Single card send flow
- [ ] Basic address book (manual entry + CSV import)
- [ ] Bulk send (same message to multiple recipients)
- [ ] Single checkout for multiple cards
- [ ] Examples gallery (curated, not user-generated)

### Nice to Have (v1.1)
- [ ] Google/Apple contacts import
- [ ] AI-personalised messages per recipient
- [ ] Occasion reminders
- [ ] Order history and re-send

### Later (v2+)
- [ ] User-submitted examples (moderated)
- [ ] Brand/style presets for business users
- [ ] API for integration (CRM, etc.)
- [ ] Envelope customisation

---

## Key Differentiators vs Moonpig

| Moonpig | Best Wishes |
|---------|-------------|
| Browse 10,000 templates | Describe what you want, AI generates |
| Photo in a frame | Photos merged into artwork |
| One card per checkout | 35 cards, one checkout |
| Manual address entry each time | Address book with smart lists |
| Same message for all | AI-personalised per recipient |
| Generic templates | Examples gallery for inspiration |
| ~15 mins per card | ~3 mins for entire batch |

---

## Open Questions

1. **International expansion**: UK + US first, but what's the priority order for EU, Australia, Canada as separate markets?

2. **Moderation**: How to handle potentially inappropriate AI generations? Pre-generation guardrails vs post-generation review?

3. **Photo privacy**: How long to retain uploaded photos? GDPR implications for UK/EU users?

4. **Competitive moat**: What stops Moonpig adding AI? Speed to market + UX focus + bulk sending as differentiator?

5. **Seasonal capacity**: Christmas is 70%+ of greeting card volume. How to handle Prodigi/Gelato capacity constraints in November-December?

