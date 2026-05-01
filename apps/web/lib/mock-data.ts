export type VersionStatus = 'active' | 'draft' | 'ai_draft' | 'review' | 'archived';

export interface ListingVersion {
  id: string;
  number: number;
  status: VersionStatus;
  createdAt: string;
  author: string;
  source: 'manual' | 'ai_generated';
  title: string;
  bullets: string[];
  description: string;
  keywords: string;
}

export const MOCK_VERSIONS: ListingVersion[] = [
  {
    id: 'v1',
    number: 1,
    status: 'active',
    createdAt: '2026-04-15T10:30:00Z',
    author: '@operator-wang',
    source: 'manual',
    title:
      'Homtone 6QT Programmable Slow Cooker with Digital Timer and Auto Keep Warm Function, Stainless Steel',
    bullets: [
      'LARGE CAPACITY - Perfect for families of 4-6, the 6-quart ceramic pot fits a whole chicken or large roast with room to spare',
      'PROGRAMMABLE TIMER - Set cook time from 30 minutes to 20 hours with automatic switch to Keep Warm when done',
      'DISHWASHER SAFE - Removable ceramic insert and tempered glass lid are both dishwasher safe for easy cleanup',
      '3 TEMPERATURE SETTINGS - Choose from Low, High, or Warm to match any recipe requirement',
      'COOL-TOUCH HANDLES - Stay-cool handles and locking lid make transport safe from counter to table',
    ],
    description:
      'The Homtone 6QT Slow Cooker brings effortless meal preparation to your kitchen. With programmable digital controls and a generous 6-quart capacity, you can prepare healthy, home-cooked meals for the whole family without constant supervision.',
    keywords:
      'slow cooker 6 quart, programmable slow cooker, crock pot, ceramic slow cooker, digital slow cooker, large slow cooker, family slow cooker',
  },
  {
    id: 'v2',
    number: 2,
    status: 'review',
    createdAt: '2026-04-20T14:15:00Z',
    author: '@operator-li',
    source: 'manual',
    title:
      'Homtone 6QT Programmable Slow Cooker with Digital Timer, 3 Cooking Modes & Auto Keep Warm, Stainless Steel',
    bullets: [
      'LARGE 6-QUART CAPACITY - Feeds 4-6 people easily; fits a 6lb chicken or 4lb roast with room for vegetables',
      'SMART DIGITAL TIMER - Program cook time from 30min to 20 hours; automatically switches to Keep Warm',
      'EASY CLEAN DESIGN - Dishwasher-safe removable ceramic insert and tempered glass lid',
      '3 COOKING MODES - Low (8hr), High (4hr), and Warm settings for versatile meal preparation',
      'SAFE TRANSPORT - Cool-touch handles and secure locking lid for potluck-ready portability',
    ],
    description:
      'The Homtone 6QT Slow Cooker brings effortless meal preparation to your kitchen. Program it and forget it — the smart digital timer handles everything from a quick 30-minute warm-up to a 20-hour slow braise, then automatically keeps your food at serving temperature.',
    keywords:
      'slow cooker 6 quart, programmable slow cooker, crock pot large, ceramic insert slow cooker, digital timer cooker, family size slow cooker, keep warm slow cooker',
  },
  {
    id: 'v3',
    number: 3,
    status: 'ai_draft',
    createdAt: '2026-04-22T09:00:00Z',
    author: 'AI (Gemini Pro)',
    source: 'ai_generated',
    title:
      'Homtone 6QT Smart Programmable Slow Cooker — Digital Timer, Auto Keep Warm, 3 Heat Modes, Dishwasher-Safe Ceramic, Stainless Steel',
    bullets: [
      '6-QUART FAMILY SIZE — Generous capacity serves 4-6 people; accommodates a whole 6lb chicken, 4lb roast, or large batch of soup with ease',
      'SET IT & FORGET IT — Programmable 30-min to 20-hour digital timer with automatic Keep Warm ensures perfectly cooked meals on your schedule',
      'EFFORTLESS CLEANUP — FDA-grade removable ceramic pot and shatter-resistant tempered glass lid are fully dishwasher safe',
      'VERSATILE 3-MODE COOKING — Low slow-cook, High fast-cook, and Keep Warm modes give you full control over texture and timing',
      'POTLUCK-READY DESIGN — Stay-cool ergonomic handles and secure locking lid make safe, spill-free transport from kitchen to table',
    ],
    description:
      'Discover the Homtone 6QT Smart Slow Cooker — engineered for busy families who refuse to compromise on home-cooked flavor. The intelligent digital timer lets you program cooking from 30 minutes to 20 hours, then seamlessly transitions to Keep Warm so dinner is ready whenever you are. The premium stainless steel exterior and FDA-grade ceramic insert deliver both durability and food safety.',
    keywords:
      'slow cooker 6 quart programmable, smart slow cooker digital timer, crock pot 6 qt ceramic, large family slow cooker keep warm, dishwasher safe slow cooker, stainless steel slow cooker, set and forget cooker',
  },
];
