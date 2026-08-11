import {
  Inbox,
  Instagram,
  Layers,
  LayoutGrid,
  Linkedin,
  ListChecks,
  MessageCircle,
  QrCode,
  Smartphone,
  Workflow,
  Youtube,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import type { IconKey } from '@/modules/marketing/domain/icon-key';

/**
 * Maps content icon keys to concrete components.
 *
 * This indirection is what lets marketing content stay serializable data — a
 * tenant config (or, later, a database row) references `"share"`, never a React
 * component. Because IconKey is a union, adding a key without a mapping is a
 * compile error.
 */
export const ICON_REGISTRY: Record<IconKey, LucideIcon> = {
  catalog: LayoutGrid,
  share: QrCode,
  inbox: Inbox,
  speed: Zap,
  organize: ListChecks,
  chat: MessageCircle,
  centralize: Layers,
  automate: Workflow,
  ease: Smartphone,
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
};

export function resolveIcon(key: IconKey): LucideIcon {
  return ICON_REGISTRY[key];
}
