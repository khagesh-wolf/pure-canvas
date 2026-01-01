import { Toaster as Sonner, toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/useTheme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();
  const isMobile = useIsMobile();

  // Map our theme to sonner's expected theme
  const sonnerTheme = theme === 'system' 
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return (
    <Sonner
      theme={sonnerTheme as ToasterProps["theme"]}
      className="toaster group pointer-events-none [&>*]:pointer-events-auto"
      position={isMobile ? "bottom-center" : "bottom-right"}
      closeButton
      visibleToasts={3}
      expand={false}
      richColors
      dir="ltr"
      style={isMobile ? { bottom: "100px" } : { bottom: "24px", right: "24px" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:relative group-[.toaster]:pr-12 pointer-events-auto",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "!absolute !right-3 !left-auto !top-1/2 !-translate-y-1/2 !bg-muted/40 hover:!bg-muted/70 !text-foreground/70 hover:!text-foreground !border-0 !rounded-md !p-1 !h-7 !w-7",
        },
        duration: 4000,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
