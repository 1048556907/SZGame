/**
 * 全局类型扩展
 */

declare global {
  namespace Electron {
    interface App {
      /** 标记应用是否正在退出，用于 close 事件拦截判断 */
      isQuiting?: boolean
    }
  }

  interface Window {
    // 这里的类型声明主要在 src/types/index.ts 里，此文件只是扩展 Electron
  }
}

export {}
