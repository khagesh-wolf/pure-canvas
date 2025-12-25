import { memo } from 'react';
import { Flame, ChefHat, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export type BadgeType = 'popular' | 'chef-special' | 'new';

interface MenuItemBadgeProps {
  type: BadgeType;
  className?: string;
}

const badgeConfig = {
  popular: {
    icon: Flame,
    label: 'Popular',
    className: 'bg-orange-500/90 text-white',
  },
  'chef-special': {
    icon: ChefHat,
    label: "Chef's Pick",
    className: 'bg-amber-500/90 text-white',
  },
  new: {
    icon: Star,
    label: 'New',
    className: 'bg-emerald-500/90 text-white',
  },
};

const MenuItemBadge = memo(function MenuItemBadge({ type, className }: MenuItemBadgeProps) {
  const config = badgeConfig[type];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide shadow-sm",
        config.className,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
});

export { MenuItemBadge };
