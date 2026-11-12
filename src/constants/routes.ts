export const route = {
  // home as new chat or thread
  home: '/',
  projectDetail: '/project/:projectId',
  threadsDetail: '/llm/chat/:threadId',
  agentWorkspace: '/agent-workspace',
  settings: {
    index: '/settings',
    general: '/settings',
    assistant: '/settings',
    providers: '/settings/providers/:providerName',
  },
  hub: {
    index: '/llm/models',
  },
}
