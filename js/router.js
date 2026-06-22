/**
 * router.js - 懂非懂 (DongFeiDong) 哈希路由模块
 *
 * 基于 IIFE 单例模式，实现基于 URL hash 的前端路由。
 * 支持页面切换、底部导航高亮、浏览器前进/后退、路由变更回调等功能。
 * 所有路由变更通过 Logger 记录。
 *
 * 依赖: window.Logger (logger.js)
 * 导出: window.Router
 */

;(function () {
  'use strict'

  // ==================== 路由配置 ====================

  /**
   * 路由映射表：hash 路径 → 页面名称
   * 页面名称对应 HTML 中 .page 元素的 data-page 属性
   */
  const ROUTE_MAP = Object.freeze({
    '#/': 'home',
    '#/home': 'home',
    '#/result': 'result',
    '#/history': 'history',
    '#/favorites': 'favorites',
    '#/daily': 'daily',
  })

  /** 默认路由（hash 为空或未匹配时使用） */
  const DEFAULT_ROUTE = 'home'

  /** 默认 hash（对应默认路由） */
  const DEFAULT_HASH = '#/home'

  // ==================== 内部状态 ====================

  /** 路由变更回调函数列表 */
  const listeners = []

  /** 是否已初始化（防止重复绑定事件） */
  let initialized = false

  // ==================== 内部工具方法 ====================

  /**
   * 获取 Logger 引用（兼容 Logger 尚未加载的情况）
   * @returns {object|null}
   */
  const getLogger = () => window.Logger || null

  /**
   * 从当前 URL hash 解析路由名称
   * @returns {string} 路由名称
   */
  const parseRoute = () => {
    const hash = window.location.hash || '#/'

    // 精确匹配已知路由
    if (ROUTE_MAP[hash]) {
      return ROUTE_MAP[hash]
    }

    // 尝试匹配不含尾部斜杠的路径（兼容 #/result?id=xxx 等带参数的情况）
    const hashBase = hash.split('?')[0]
    if (ROUTE_MAP[hashBase]) {
      return ROUTE_MAP[hashBase]
    }

    // 未匹配到任何路由，返回默认路由
    return DEFAULT_ROUTE
  }

  /**
   * 执行页面切换
   * 1. 移除所有 .page 元素的 active 类
   * 2. 为目标页面添加 active 类
   * 3. 更新底部导航栏的高亮状态
   * @param {string} routeName - 目标路由名称
   */
  const switchPage = (routeName) => {
    const logger = getLogger()

    // ---- 切换页面显示 ----
    const pages = document.querySelectorAll('.page')
    pages.forEach((page) => {
      page.classList.remove('active')
    })

    // 查找目标页面元素（通过 data-page 属性匹配）
    const targetPage = document.querySelector(`.page[data-page="${routeName}"]`)
    if (targetPage) {
      targetPage.classList.add('active')
      logger && logger.debug('Router', `页面已切换: ${routeName}`)
    } else {
      logger && logger.warn('Router', `未找到页面元素: data-page="${routeName}"`)
    }

    // ---- 更新底部导航栏高亮状态 ----
    const navItems = document.querySelectorAll('.bottom-nav-item, .nav-item')
    navItems.forEach((item) => {
      item.classList.remove('active')
    })

    // 查找对应的导航项（通过 data-route 属性匹配）
    const targetNav = document.querySelector(`.bottom-nav-item[data-route="${routeName}"], .nav-item[data-route="${routeName}"]`)
    if (targetNav) {
      targetNav.classList.add('active')
    }
  }

  /**
   * 通知所有路由变更监听器
   * @param {string} routeName - 新的路由名称
   */
  const notifyListeners = (routeName) => {
    listeners.forEach((callback) => {
      try {
        callback(routeName)
      } catch (err) {
        const logger = getLogger()
        logger && logger.error('Router', '路由回调执行出错', err.message)
      }
    })
  }

  /**
   * 处理 hashchange 事件的内部方法
   */
  const handleHashChange = () => {
    const routeName = parseRoute()
    const logger = getLogger()
    logger && logger.info('Router', `路由变更: ${routeName}`)

    switchPage(routeName)
    notifyListeners(routeName)
  }

  // ==================== Router 单例对象 ====================
  const Router = {
    /**
     * 初始化路由器
     * - 监听 hashchange 事件
     * - 根据当前 hash 导航到对应页面
     * - 重复调用时不会重复绑定事件
     */
    init: () => {
      const logger = getLogger()

      if (initialized) {
        logger && logger.warn('Router', '路由器已初始化，跳过重复初始化')
        return
      }

      // 监听浏览器 hash 变化（包括前进/后退按钮）
      window.addEventListener('hashchange', handleHashChange)

      // 绑定底部导航点击事件
      const navItems = document.querySelectorAll('.bottom-nav .nav-item')
      navItems.forEach((item) => {
        item.addEventListener('click', () => {
          const route = item.dataset.route
          if (route) {
            Router.navigate(route)
          }
        })
      })

      // 初始化时导航到当前 hash 对应的页面
      const currentHash = window.location.hash
      if (!currentHash || currentHash === '#' || currentHash === '#/') {
        // 无 hash 时设置为默认路由
        window.location.hash = DEFAULT_HASH
      } else {
        // 已有 hash，直接切换到对应页面
        handleHashChange()
      }

      initialized = true
      logger && logger.info('Router', '路由器初始化完成')
    },

    /**
     * 导航到指定路径
     * @param {string} path - 目标路径（如 'home', 'result', '#/history' 等）
     *   - 传入路由名称时自动补全为 #/name 格式
     *   - 传入完整 hash 时直接使用
     */
    navigate: (path) => {
      const logger = getLogger()

      // 如果传入的是路由名称（不含 #），自动补全为 hash 格式
      let hash = path
      if (!path.startsWith('#')) {
        hash = `#/${path}`
      }

      logger && logger.debug('Router', `导航到: ${hash}`)

      // 设置 hash（会触发 hashchange 事件）
      // 同时手动调用 handleHashChange 作为兜底，确保页面切换
      window.location.hash = hash
      handleHashChange()
    },

    /**
     * 获取当前路由名称
     * @returns {string} 当前路由名称（如 'home', 'result' 等）
     */
    getCurrentRoute: () => {
      return parseRoute()
    },

    /**
     * 注册路由变更监听回调
     * 每次路由切换时（包括浏览器前进/后退），所有已注册的回调都会被调用
     * @param {function(string)} callback - 回调函数，接收路由名称作为参数
     * @returns {function} 取消监听的函数（用于移除回调）
     */
    onRouteChange: (callback) => {
      if (typeof callback !== 'function') {
        const logger = getLogger()
        logger && logger.error('Router', 'onRouteChange 回调必须是函数')
        return () => {}
      }

      listeners.push(callback)

      // 返回取消监听的函数，方便调用方移除回调
      return () => {
        const index = listeners.indexOf(callback)
        if (index > -1) {
          listeners.splice(index, 1)
        }
      }
    },

    /**
     * 返回上一页（等同于浏览器后退）
     */
    back: () => {
      const logger = getLogger()
      logger && logger.debug('Router', '执行后退操作')
      window.history.back()
    },
  }

  // ==================== 导出为全局单例 ====================
  window.Router = Router
})()
