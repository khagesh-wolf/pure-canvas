import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Users } from 'lucide-react';

interface TableInfo {
  tableNumber: number;
  isOccupied: boolean;
  customerCount?: number;
  totalAmount?: number;
}

interface TableMapProps {
  tables: TableInfo[];
  onTableClick?: (tableNumber: number) => void;
  className?: string;
}

const TableMap = memo(function TableMap({ tables, onTableClick, className }: TableMapProps) {
  return (
    <div className={cn("grid grid-cols-5 gap-3 p-4", className)}>
      {tables.map((table) => (
        <button
          key={table.tableNumber}
          onClick={() => onTableClick?.(table.tableNumber)}
          className={cn(
            "relative aspect-square rounded-xl border-2 flex flex-col items-center justify-center transition-all duration-200 hover:scale-105 hover:shadow-lg group",
            table.isOccupied
              ? "bg-success/10 border-success text-success hover:bg-success/20"
              : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/50"
          )}
        >
          <span className="text-lg font-bold">{table.tableNumber}</span>
          {table.isOccupied && (
            <>
              <div className="flex items-center gap-1 text-xs mt-1">
                <Users className="w-3 h-3" />
                <span>{table.customerCount || 1}</span>
              </div>
              {table.totalAmount !== undefined && table.totalAmount > 0 && (
                <span className="text-[10px] mt-0.5 font-medium">
                  रू{table.totalAmount}
                </span>
              )}
              <span className="absolute top-1 right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
            </>
          )}
        </button>
      ))}
    </div>
  );
});

export { TableMap };
