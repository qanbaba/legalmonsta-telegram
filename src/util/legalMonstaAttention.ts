export const LEGAL_MONSTA_ATTENTION_CACHE_NAME = 'lm-telegram-attention-v1';
export const LEGAL_MONSTA_ATTENTION_STATE_PATH = '/legalmonsta/attention-state.json';
export const LEGAL_MONSTA_ATTENTION_CHANNEL_NAME = 'legalmonsta:telegram:attention';
export const LEGAL_MONSTA_ATTENTION_CLIENT_MESSAGE_TYPE = 'legalmonsta:telegram:attention-changed';

type LegalMonstaAttentionState = {
  hasUnread: boolean;
  updatedAt: number;
};

export async function writeLegalMonstaAttentionState(hasUnread: boolean) {
  if (!('caches' in globalThis)) return;

  const cache = await globalThis.caches.open(LEGAL_MONSTA_ATTENTION_CACHE_NAME);
  const state: LegalMonstaAttentionState = {
    hasUnread,
    updatedAt: Date.now(),
  };
  const stateUrl = new URL(LEGAL_MONSTA_ATTENTION_STATE_PATH, globalThis.location.origin);
  await cache.put(stateUrl, new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' },
  }));
}
