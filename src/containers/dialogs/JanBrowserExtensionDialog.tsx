import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export type JanBrowserExtensionDialogState = 'closed' | 'checking' | 'not_installed'

export default function JanBrowserExtensionDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Browser Extension</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Browser extension not available in this build.</p>
      </DialogContent>
    </Dialog>
  )
}
