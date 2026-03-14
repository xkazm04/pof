// ---------------------------------------------------------------------------
// Realistic mock data for demo panels
// Domain-agnostic: no lorem ipsum, no "Item 1/2/3"
// ---------------------------------------------------------------------------

export interface ListItem {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'draft' | 'review' | 'archived';
  avatar: string | null;
}

export interface DetailSection {
  title: string;
  fields: Array<{ label: string; value: string }>;
}

export interface DetailEntity {
  name: string;
  type: string;
  sections: DetailSection[];
}

export interface MediaItem {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  type: 'image' | 'video' | 'audio';
}

/** Scrollable list items for DataListPanel */
export const MOCK_LIST_ITEMS: ListItem[] = [
  { id: '1', name: 'Aurora Campaign', description: 'Q4 brand awareness push targeting new demographics', status: 'active', avatar: null },
  { id: '2', name: 'Meridian Analytics', description: 'Real-time dashboard for customer engagement metrics', status: 'draft', avatar: null },
  { id: '3', name: 'Solstice Protocol', description: 'Security audit framework for cloud infrastructure', status: 'review', avatar: null },
  { id: '4', name: 'Ember Redesign', description: 'Visual identity refresh for the core product line', status: 'active', avatar: null },
  { id: '5', name: 'Catalyst Onboarding', description: 'Interactive walkthrough for first-time enterprise users', status: 'archived', avatar: null },
  { id: '6', name: 'Zenith Connector', description: 'Third-party API integration for payment processing', status: 'draft', avatar: null },
  { id: '7', name: 'Horizon Insights', description: 'Predictive analytics module for quarterly forecasting', status: 'review', avatar: null },
  { id: '8', name: 'Apex Rollout', description: 'Phased deployment strategy for the mobile platform', status: 'active', avatar: null },
];

/** Detail entity for DetailPanel */
export const MOCK_DETAIL: DetailEntity = {
  name: 'Aurora Campaign',
  type: 'Campaign',
  sections: [
    {
      title: 'Overview',
      fields: [
        { label: 'Status', value: 'Active' },
        { label: 'Priority', value: 'High' },
        { label: 'Owner', value: 'Sarah Chen' },
        { label: 'Created', value: '2026-01-15' },
      ],
    },
    {
      title: 'Metrics',
      fields: [
        { label: 'Reach', value: '2.4M' },
        { label: 'Engagement', value: '12.8%' },
        { label: 'Conversion', value: '3.2%' },
      ],
    },
    {
      title: 'Notes',
      fields: [
        { label: 'Description', value: 'Targeting millennials in urban markets with video-first content strategy.' },
      ],
    },
  ],
};

/** Media items for MediaGridPanel */
export const MOCK_MEDIA_ITEMS: MediaItem[] = [
  { id: '1', title: 'Hero Banner - Desktop', thumbnailUrl: null, type: 'image' },
  { id: '2', title: 'Product Showcase - Mobile', thumbnailUrl: null, type: 'image' },
  { id: '3', title: 'Brand Story - 60s', thumbnailUrl: null, type: 'video' },
  { id: '4', title: 'Testimonial Reel', thumbnailUrl: null, type: 'video' },
  { id: '5', title: 'Feature Walkthrough', thumbnailUrl: null, type: 'image' },
  { id: '6', title: 'Social Banner - Square', thumbnailUrl: null, type: 'image' },
  { id: '7', title: 'Podcast Intro', thumbnailUrl: null, type: 'audio' },
  { id: '8', title: 'Landing Page Hero', thumbnailUrl: null, type: 'image' },
  { id: '9', title: 'Email Header Graphic', thumbnailUrl: null, type: 'image' },
];
