import { memo } from 'react';
import { Heart } from 'lucide-react';
import { LazyImage } from '@/components/ui/LazyImage';
import { MenuItemBadge, BadgeType } from '@/components/ui/MenuItemBadge';
import { cn } from '@/lib/utils';

interface MenuItemCardProps {
  id: string;
  name: string;
  price: number;
  description?: string;
  image?: string;
  available: boolean;
  qty: number;
  isFavorite: boolean;
  badge?: BadgeType;
  onAddToCart: () => void;
  onUpdateQty: (delta: number) => void;
  onToggleFavorite: () => void;
  isAnimating?: boolean;
}

const MenuItemCard = memo(function MenuItemCard({
  id,
  name,
  price,
  description,
  image,
  available,
  qty,
  isFavorite,
  badge,
  onAddToCart,
  onUpdateQty,
  onToggleFavorite,
  isAnimating,
}: MenuItemCardProps) {
  return (
    <div 
      className={cn(
        "flex justify-between border-b border-[#eee] pb-4 mb-5 transition-all duration-200 hover:bg-muted/20 -mx-4 px-4 py-2 rounded-lg",
        !available && 'opacity-60'
      )}
    >
      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold mb-1">{name}</h3>
          {badge && <MenuItemBadge type={badge} />}
          <button
            onClick={(e) => { 
              e.stopPropagation();
              const btn = e.currentTarget;
              btn.classList.remove('heart-animate');
              void btn.offsetWidth;
              btn.classList.add('heart-animate');
              onToggleFavorite();
            }}
            className={cn(
              "transition-colors duration-200 hover:scale-110",
              isFavorite ? 'text-[#e74c3c]' : 'text-[#ccc] hover:text-[#e74c3c]/50'
            )}
          >
            <Heart className={cn("w-4 h-4", isFavorite && 'fill-current')} />
          </button>
        </div>
        <p className="font-medium text-[#333]">रू{price}</p>
        {description && (
          <p className="text-xs text-[#888] mt-1 line-clamp-2">{description}</p>
        )}
        
        {/* Inline Quantity Control or Unavailable */}
        <div className="mt-3">
          {!available ? (
            <span className="inline-block bg-gray-200 text-gray-500 font-medium px-4 py-1.5 rounded-full text-sm">
              Unavailable
            </span>
          ) : qty === 0 ? (
            <button
              onClick={onAddToCart}
              className={cn(
                "bg-white border border-[#ddd] text-[#06C167] font-bold px-5 py-1.5 rounded-full shadow-sm hover:shadow-md hover:border-[#06C167] transition-all duration-200",
                isAnimating && 'cart-bounce'
              )}
            >
              ADD
            </button>
          ) : (
            <div className="inline-flex items-center bg-white border border-[#eee] rounded-full overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.1)]">
              <button
                onClick={() => onUpdateQty(-1)}
                className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0] hover:bg-[#f8f8f8] transition-colors"
              >
                −
              </button>
              <span className="font-bold text-sm w-6 text-center">{qty}</span>
              <button
                onClick={() => onUpdateQty(1)}
                className="w-9 h-8 flex items-center justify-center text-[#06C167] text-xl active:bg-[#f0f0f0] hover:bg-[#f8f8f8] transition-colors"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
      <div className={cn(
        "w-[100px] h-[100px] rounded-xl bg-[#eee] overflow-hidden flex-shrink-0",
        !available && 'grayscale'
      )}>
        <LazyImage
          src={image || ''}
          alt={name}
          className="w-full h-full"
          fallbackClassName="w-full h-full"
        />
      </div>
    </div>
  );
});

export { MenuItemCard };
