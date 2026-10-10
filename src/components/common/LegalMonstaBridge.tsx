import { memo, useEffect } from '../../lib/teact/teact';

import type { GlobalState } from '../../global/types';

import { ALL_FOLDER_ID } from '../../config';
import {
  LEGAL_MONSTA_ATTENTION_CHANNEL_NAME,
  writeLegalMonstaAttentionState,
} from '../../util/legalMonstaAttention';

import useSelector from '../../hooks/data/useSelector';
import { useFolderManagerForUnreadCounters } from '../../hooks/useFolderManager';

const BRIDGE_MESSAGE_TYPE = 'legalmonsta:telegram:state';
const BRIDGE_VERSION = 1;
const ALLOWED_PARENT_ORIGINS = new Set([
  'https://legalmonsta.kz',
  'https://www.legalmonsta.kz',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

type IncomingCall = 'audio' | 'video' | undefined;

function selectIsAuthorized(global: GlobalState) {
  return global.auth.state === 'authorizationStateReady' || Boolean(global.currentUserId);
}

function selectHasResolvedAuthorization(global: GlobalState) {
  return global.auth.state !== undefined;
}

function selectIncomingCall(global: GlobalState): IncomingCall {
  const { phoneCall, currentUserId } = global;
  if (!phoneCall || phoneCall.state !== 'requested' || phoneCall.adminId === currentUserId) return undefined;
  return phoneCall.isVideo ? 'video' : 'audio';
}

function resolveParentOrigin() {
  if (window.parent === window || !document.referrer) return undefined;
  try {
    const origin = new URL(document.referrer).origin;
    return ALLOWED_PARENT_ORIGINS.has(origin) ? origin : undefined;
  } catch {
    return undefined;
  }
}

function LegalMonstaBridge() {
  const isAuthorized = useSelector(selectIsAuthorized);
  const hasResolvedAuthorization = useSelector(selectHasResolvedAuthorization);
  const incomingCall = useSelector(selectIncomingCall);
  const unreadCounters = useFolderManagerForUnreadCounters();
  const unreadSummary = unreadCounters[ALL_FOLDER_ID];
  const hasUnread = Boolean(unreadSummary?.notificationsCount);

  useEffect(() => {
    const hasResolvedAttention = isAuthorized
      ? unreadSummary !== undefined
      : hasResolvedAuthorization;
    if (hasResolvedAttention) {
      void writeLegalMonstaAttentionState(hasUnread);
      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel(LEGAL_MONSTA_ATTENTION_CHANNEL_NAME);
        channel.postMessage({ hasUnread });
        channel.close();
      }
    }

    const parentOrigin = resolveParentOrigin();
    if (!parentOrigin) return;
    window.parent.postMessage({
      type: BRIDGE_MESSAGE_TYPE,
      version: BRIDGE_VERSION,
      payload: {
        isAuthorized,
        hasUnread,
        incomingCall,
      },
    }, parentOrigin);
  }, [hasResolvedAuthorization, hasUnread, incomingCall, isAuthorized, unreadSummary]);

  return undefined;
}

export default memo(LegalMonstaBridge);
