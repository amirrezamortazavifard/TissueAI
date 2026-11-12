export function MarkdownTable({ children }: { children?: React.ReactNode }) {
  return (
    <div className="overflow-x-auto my-2">
      <table className="min-w-full border-collapse border border-border text-sm">
        {children}
      </table>
    </div>
  )
}
