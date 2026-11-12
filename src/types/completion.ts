// MCP and Completion Types

export interface MCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  server?: string
}

export interface MCPToolCallResult {
  error?: string
  content: Array<{ type?: string; text: string }>
}
