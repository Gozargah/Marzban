import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"
import useDirDetection from "@/hooks/use-dir-detection"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()
  const dir = useDirDetection()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]} 
      className="toaster group font-body"
      dir={dir}
      toastOptions={{
        classNames: {
          toast:
            "group font-body toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
