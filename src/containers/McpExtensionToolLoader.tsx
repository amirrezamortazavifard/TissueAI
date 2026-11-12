import { ComponentType } from 'react'
import type { Tool } from '@/hooks/useAppState'

type MCPToolComponentProps = {
  tools: Tool[]
}

interface McpExtensionToolLoaderProps {
  tools: Tool[]
  hasActiveMCPServers: boolean
  selectedModelHasTools: boolean
  MCPToolComponent?: ComponentType<MCPToolComponentProps> | null
}

export const McpExtensionToolLoader = ({
  tools,
  hasActiveMCPServers,
  selectedModelHasTools,
  MCPToolComponent,
}: McpExtensionToolLoaderProps) => {
  if (!selectedModelHasTools || !hasActiveMCPServers || !MCPToolComponent) {
    return null
  }

  return (
    <MCPToolComponent
      tools={tools}
    />
  )
}
