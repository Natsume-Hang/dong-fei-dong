/**
 * 懂非懂 (DongFeiDong) — 应用入口
 *
 * 本文件是整个 SPA 的启动入口，负责：
 * 1. 初始化各核心模块（Logger、Store、Router）
 * 2. 注册路由变化监听，驱动页面模块的 onShow/onHide 生命周期
 * 3. 设置全局错误处理（同步错误 + 未捕获 Promise 异常）
 * 4. 暴露 window.DFDDebug 调试工具
 * 5. 维护模块注册表，追踪已加载的页面/组件模块
 */
;(function () {
  'use strict'

  // ============================================================
  // 应用版本信息
  // ============================================================
  const APP_VERSION = '1.0.0'
  const APP_NAME = '懂非懂'

  // ============================================================
  // 模块注册表
  // 记录各页面/组件模块是否已成功加载，便于调试和状态追踪
  // ============================================================
  const moduleRegistry = new Map()

  /**
   * 注册一个模块到注册表
   * @param {string} name - 模块名称（如 'pages/home'）
   * @param {object} module - 模块导出对象
   */
  function registerModule(name, module) {
    moduleRegistry.set(name, {
      name,
      loaded: true,
      registeredAt: Date.now(),
      module
    })
  }

  /**
   * 获取所有已注册模块的列表
   * @returns {Array<{name: string, loaded: boolean, registeredAt: number}>}
   */
  function listModules() {
    return Array.from(moduleRegistry.values()).map((entry) => ({
      name: entry.name,
      loaded: entry.loaded,
      registeredAt: new Date(entry.registeredAt).toISOString()
    }))
  }

  // ============================================================
  // 页面模块映射
  // 路由名称 → 对应页面模块的引用（由各页面脚本自行挂载）
  // ============================================================
  const pageModules = {}

  /**
   * 注册页面模块
   * @param {string} pageName - 页面路由名称（如 'home'、'result'）
   * @param {object} pageModule - 页面模块，需实现 onShow() / onHide() 方法
   */
  function registerPageModule(pageName, pageModule) {
    pageModules[pageName] = pageModule
    registerModule(`pages/${pageName}`, pageModule)
  }

  // ============================================================
  // 路由变化处理
  // 当路由切换时，调用对应页面模块的生命周期方法
  // ============================================================

  /** @type {string|null} 当前激活的页面路由 */
  let currentPage = null

  /**
   * 处理路由变化事件
   * @param {string} newPage - 新页面路由名称
   * @param {object} [params] - 路由参数（可选）
   */
  function handleRouteChange(newPage, params) {
    const previousPage = currentPage
    currentPage = newPage

    // 触发旧页面的 onHide
    if (previousPage && pageModules[previousPage] && typeof pageModules[previousPage].onHide === 'function') {
      try {
        pageModules[previousPage].onHide()
      } catch (err) {
        Logger.error('Router', `页面 ${previousPage} 的 onHide 执行出错:`, err)
      }
    }

    // 触发新页面的 onShow
    if (pageModules[newPage] && typeof pageModules[newPage].onShow === 'function') {
      try {
        pageModules[newPage].onShow(params)
      } catch (err) {
        Logger.error('Router', `页面 ${newPage} 的 onShow 执行出错:`, err)
      }
    }
  }

  // ============================================================
  // 全局错误处理
  // ============================================================

  /**
   * 全局同步错误捕获
   * @param {string} message - 错误信息
   * @param {string} source - 出错文件
   * @param {number} lineno - 行号
   * @param {number} colno - 列号
   * @param {Error} error - Error 对象
   */
  function globalErrorHandler(message, source, lineno, colno, error) {
    Logger.error('GlobalError', `${message} (${source}:${lineno}:${colno})`, error)
    // 返回 true 可阻止默认控制台输出（生产环境可考虑）
    return false
  }

  /**
   * 未捕获的 Promise 异常处理
   * @param {PromiseRejectionEvent} event
   */
  function unhandledRejectionHandler(event) {
    const reason = event.reason
    Logger.error('UnhandledRejection', '未捕获的 Promise 异常:', reason)
  }

  // ============================================================
  // 调试工具 (window.DFDDebug)
  // 仅在开发/调试时使用，通过控制台访问
  // ============================================================

  /** @type {boolean} AI 超时模拟标志 */
  let _mockAITimeout = false

  /** @type {boolean} AI 不可用模拟标志 */
  let _mockAIUnavailable = false

  /**
   * 创建调试工具对象
   * @returns {object} DFDDebug 调试接口
   */
  function createDebugTools() {
    return {
      /**
       * 打印所有本地存储中 dfd_ 前缀的内容
       */
      dumpStorage() {
        const entries = {}
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key.startsWith('dfd_')) {
            try {
              entries[key] = JSON.parse(localStorage.getItem(key))
            } catch {
              entries[key] = localStorage.getItem(key)
            }
          }
        }
        Logger.info('DFDDebug', 'Storage 内容:', entries)
        return entries
      },

      /**
       * 清除所有 dfd_ 前缀的本地存储
       */
      clearAllStorage() {
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key.startsWith('dfd_')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key))
        Logger.info('DFDDebug', `已清除 ${keysToRemove.length} 条存储记录`)
      },

      /**
       * 打印种子数据库信息
       */
      dumpSeedDB() {
        if (typeof SeedDB !== 'undefined' && SeedDB.getAll) {
          const all = SeedDB.getAll()
          Logger.info('DFDDebug', '种子数据库条目数:', all.length)
          Logger.info('DFDDebug', '种子数据库内容:', all)
        } else {
          Logger.warn('DFDDebug', 'SeedDB 模块未加载或无 getAll 方法')
        }
      },

      /**
       * 模拟 AI 请求超时（用于测试超时处理逻辑）
       */
      mockAITimeout() {
        _mockAITimeout = true
        Logger.info('DFDDebug', '已启用 AI 超时模拟')
      },

      /**
       * 模拟 AI 服务不可用（用于测试降级逻辑）
       */
      mockAIUnavailable() {
        _mockAIUnavailable = true
        Logger.info('DFDDebug', '已启用 AI 不可用模拟')
      },

      /**
       * 设置日志级别
       * @param {'debug'|'info'|'warn'|'error'|'none'} level
       */
      setLogLevel(level) {
        if (typeof Logger !== 'undefined' && Logger._setMinLevel) {
          Logger._setMinLevel(level)
          Logger.info('DFDDebug', `日志级别已设为: ${level}`)
        }
      },

      /**
       * 列出所有已注册的模块
       * @returns {Array}
       */
      listModules() {
        return listModules()
      },

      /**
       * 获取应用信息摘要
       * @returns {object}
       */
      getAppInfo() {
        // 计算存储用量
        let storageSize = 0
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key.startsWith('dfd_')) {
            storageSize += key.length + (localStorage.getItem(key) || '').length
          }
        }

        return {
          name: APP_NAME,
          version: APP_VERSION,
          currentPage,
          moduleCount: moduleRegistry.size,
          storageUsage: `${storageSize} 字符`,
          storageAvailable: Store.isAvailable(),
          mockAITimeout: _mockAITimeout,
          mockAIUnavailable: _mockAIUnavailable
        }
      }
    }
  }

  // ============================================================
  // 主初始化函数
  // ============================================================

  /**
   * 应用初始化
   * 按依赖顺序依次启动各核心模块
   */
  function init() {
    // 1. 初始化日志系统
    Logger.info('App', '应用启动')

    // 2. 初始化本地存储
    //    检测存储可用性，不可用时降级为内存模式
    Store.checkAvailability()
    Logger.info('App', `存储可用: ${Store.isAvailable()}`)

    // 3. 初始化路由系统
    Router.init()
    Logger.info('App', '路由系统已初始化')

    // 3.5 预加载种子数据库（异步，不阻塞启动）
    if (typeof SeedDB !== 'undefined' && SeedDB.load) {
      SeedDB.load().then((result) => {
        if (result && result.success) {
          Logger.info('App', `种子数据库预加载完成，共 ${result.data} 条记录`)
        } else {
          Logger.warn('App', '种子数据库预加载失败，将在首次搜索时重试')
        }
      }).catch((err) => {
        Logger.warn('App', '种子数据库预加载异常', err.message)
      })
    }

    // 4. 注册路由变化处理器
    //    路由切换时自动调用对应页面模块的生命周期方法
    Router.onRouteChange(handleRouteChange)

    // 5. 设置全局错误处理
    window.onerror = globalErrorHandler
    window.addEventListener('unhandledrejection', unhandledRejectionHandler)
    Logger.info('App', '全局错误处理已设置')

    // 6. 暴露调试工具
    window.DFDDebug = createDebugTools()
    Logger.info('App', '调试工具已挂载到 window.DFDDebug')

    // 7. 自动注册已存在的页面模块
    //    各页面脚本如果已将模块挂载到 window 上，此处统一注册
    autoRegisterPageModules()

    Logger.info('App', `应用初始化完成 — v${APP_VERSION}`)

    // 8. 手动触发当前路由的生命周期方法
    //    Router.init() 在 onRouteChange 注册之前执行，导致首次加载时
    //    页面的 onShow 不会被调用。此处补发一次。
    const currentHash = window.location.hash.replace('#/', '')
    if (currentHash && window.DFDPages && window.DFDPages[currentHash]) {
      handleRouteChange(currentHash)
    }
  }

  /**
   * 自动检测并注册已挂载到 window 上的页面模块
   * 约定：页面模块通过 window.DFDPages = { home: {...}, result: {...}, ... } 挂载
   */
  function autoRegisterPageModules() {
    if (window.DFDPages && typeof window.DFDPages === 'object') {
      Object.keys(window.DFDPages).forEach((pageName) => {
        registerPageModule(pageName, window.DFDPages[pageName])
        Logger.info('App', `已注册页面模块: pages/${pageName}`)
      })
    }

    // 同样检测组件模块
    if (window.DFDComponents && typeof window.DFDComponents === 'object') {
      Object.keys(window.DFDComponents).forEach((compName) => {
        registerModule(`components/${compName}`, window.DFDComponents[compName])
      })
    }
  }

  // ============================================================
  // DOMContentLoaded 启动
  // ============================================================
  document.addEventListener('DOMContentLoaded', init)

  // ============================================================
  // 导出 App 对象到全局
  // ============================================================
  const App = {
    version: APP_VERSION,
    registerModule,
    registerPageModule,
    listModules,
    handleRouteChange,

    /**
     * 获取当前页面路由
     * @returns {string|null}
     */
    getCurrentPage() {
      return currentPage
    },

    /**
     * 检查是否处于调试模式
     * @returns {boolean}
     */
    isMockTimeout() {
      return _mockAITimeout
    },

    /**
     * 检查是否模拟 AI 不可用
     * @returns {boolean}
     */
    isMockUnavailable() {
      return _mockAIUnavailable
    }
  }

  window.App = App
})()
