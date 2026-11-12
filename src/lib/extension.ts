import { ExtensionTypeEnum } from '@/types/core'

/**
 * Minimal extension base contract used by the ExtensionManager.
 * Kept loose so existing code that touches extensions keeps compiling
 * without a full extension runtime (TissueAI has no extension backend).
 */
export interface BaseExtension {
  name?: string
  productName?: string
  description?: string
  version?: string
  provider?: string
  type?: () => ExtensionTypeEnum | string
  onLoad?: () => Promise<void> | void
  onUnload?: () => void
  [key: string]: unknown
}

/** A registered inference engine (llamacpp / mlx / ollama ...). */
export interface AIEngine extends BaseExtension {
  provider: string
  load?: (params?: unknown) => Promise<unknown>
  unload?: (params?: unknown) => Promise<unknown>
}

/**
 * Manages the registration and retrieval of extensions.
 */
export class ExtensionManager {
  private static instance: ExtensionManager

  // Registered extensions
  private extensions = new Map<string, BaseExtension>()

  // Registered inference engines
  private engines = new Map<string, AIEngine>()

  // Notified whenever an extension registers, so consumers waiting on a
  // not-yet-ready extension (startup race) can re-attempt instead of polling.
  private registrationListeners = new Set<() => void>()

  /**
   * Registers an extension.
   */
  register<T extends BaseExtension>(name: string, extension: T) {
    this.extensions.set(name, extension)

    if ('provider' in extension && typeof extension.provider === 'string') {
      this.engines.set(
        extension.provider,
        extension as unknown as AIEngine
      )
    }

    this.registrationListeners.forEach((cb) => cb())
  }

  /**
   * Subscribes to extension registrations. Returns an unsubscribe function.
   */
  onRegistrationChange(cb: () => void): () => void {
    this.registrationListeners.add(cb)
    return () => this.registrationListeners.delete(cb)
  }

  /**
   * Retrieves an extension by its type.
   */
  get<T extends BaseExtension>(type: ExtensionTypeEnum): T | undefined {
    return this.getAll().find(
      (e) => (e.type ? e.type() === type : false)
    ) as T | undefined
  }

  /**
   * Retrieves an extension by name.
   */
  getByName(name: string): BaseExtension | undefined {
    return this.extensions.get(name)
  }

  /**
   * Retrieves all registered extensions.
   */
  getAll(): BaseExtension[] {
    return Array.from(this.extensions.values())
  }

  /**
   * Retrieves a registered engine by name.
   */
  getEngine<T extends AIEngine>(engine: string): T | undefined {
    return this.engines.get(engine) as T | undefined
  }

  /**
   * Shared instance of ExtensionManager.
   */
  static getInstance(): ExtensionManager {
    if (!ExtensionManager.instance) {
      ExtensionManager.instance = new ExtensionManager()
    }
    return ExtensionManager.instance
  }
}
