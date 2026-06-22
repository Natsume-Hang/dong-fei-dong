/**
 * logger.js - 懂非懂 (DongFeiDong) 日志模块
 *
 * 基于 IIFE 单例模式，提供四级日志功能（DEBUG / INFO / WARN / ERROR）。
 * 开发环境默认 DEBUG 级别，生产环境默认 INFO 级别。
 * 支持彩色控制台输出、模块标识、上下文对象以及内存日志历史查询。
 *
 * 导出: window.Logger
 */

;(function () {
  'use strict'

  // ==================== 日志级别定义 ====================
  const LEVELS = Object.freeze({
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
  })

  // 级别名称映射，用于格式化输出
  const LEVEL_NAMES = Object.freeze({
    [LEVELS.DEBUG]: 'DEBUG',
    [LEVELS.INFO]: 'INFO',
    [LEVELS.WARN]: 'WARN',
    [LEVELS.ERROR]: 'ERROR',
  })

  // 控制台颜色映射（CSS 样式）
  const LEVEL_COLORS = Object.freeze({
    [LEVELS.DEBUG]: 'color: gray',
    [LEVELS.INFO]: 'color: blue',
    [LEVELS.WARN]: 'color: orange',
    [LEVELS.ERROR]: 'color: red',
  })

  // ==================== 环境检测 ====================
  /**
   * 判断当前是否为开发环境
   * 通过 hostname 判断：localhost 或 127.0.0.1 视为开发环境
   * @returns {boolean}
   */
  const isDevelopment = () => {
    const hostname = window.location.hostname || ''
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === ''
  }

  // ==================== 日志历史（内存中保留最近 100 条） ====================
  const MAX_HISTORY = 100
  const history = []

  // ==================== 核心日志方法 ====================
  /**
   * 格式化日志输出字符串
   * 格式: [TIMESTAMP] [LEVEL] [MODULE] message | context
   * @param {number} level - 日志级别
   * @param {string} module - 模块标识
   * @param {string} message - 日志消息
   * @param {*} [context] - 可选的上下文数据
   * @returns {string}
   */
  const formatMessage = (level, module, message, context) => {
    const timestamp = new Date().toISOString()
    const levelName = LEVEL_NAMES[level]
    let formatted = `[${timestamp}] [${levelName}] [${module}] ${message}`

    // 如果存在上下文数据，将其序列化后追加到消息末尾
    if (context !== undefined && context !== null) {
      try {
        const contextStr = typeof context === 'string' ? context : JSON.stringify(context)
        formatted += ` | ${contextStr}`
      } catch {
        formatted += ' | [无法序列化的上下文]'
      }
    }

    return formatted
  }

  /**
   * 写入日志的核心方法
   * - 根据当前最低级别决定是否输出
   * - 使用 console 对应方法输出（带颜色）
   * - 将日志存入内存历史
   * @param {number} level - 日志级别
   * @param {string} module - 模块标识
   * @param {string} message - 日志消息
   * @param {*} [context] - 可选的上下文数据
   */
  const write = (level, module, message, context) => {
    // 低于最低级别的日志直接忽略
    if (level < Logger._minLevel) return

    const formatted = formatMessage(level, module, message, context)
    const color = LEVEL_COLORS[level]

    // 根据级别选择对应的 console 方法
    switch (level) {
      case LEVELS.DEBUG:
        console.log(`%c${formatted}`, color)
        break
      case LEVELS.INFO:
        console.info(`%c${formatted}`, color)
        break
      case LEVELS.WARN:
        console.warn(`%c${formatted}`, color)
        break
      case LEVELS.ERROR:
        console.error(`%c${formatted}`, color)
        break
      default:
        console.log(`%c${formatted}`, color)
    }

    // 存入内存历史，超过上限时移除最旧的记录
    history.push({ level, module, message, context, timestamp: new Date().toISOString() })
    if (history.length > MAX_HISTORY) {
      history.shift()
    }
  }

  // ==================== Logger 单例对象 ====================
  const Logger = {
    /** 日志级别常量，供外部判断使用 */
    LEVELS,

    /** 当前最低日志级别（内部属性） */
    _minLevel: isDevelopment() ? LEVELS.DEBUG : LEVELS.INFO,

    /**
     * 输出 DEBUG 级别日志
     * @param {string} module - 模块标识
     * @param {string} message - 日志消息
     * @param {*} [context] - 可选上下文
     */
    debug: (module, message, context) => {
      write(LEVELS.DEBUG, module, message, context)
    },

    /**
     * 输出 INFO 级别日志
     * @param {string} module - 模块标识
     * @param {string} message - 日志消息
     * @param {*} [context] - 可选上下文
     */
    info: (module, message, context) => {
      write(LEVELS.INFO, module, message, context)
    },

    /**
     * 输出 WARN 级别日志
     * @param {string} module - 模块标识
     * @param {string} message - 日志消息
     * @param {*} [context] - 可选上下文
     */
    warn: (module, message, context) => {
      write(LEVELS.WARN, module, message, context)
    },

    /**
     * 输出 ERROR 级别日志
     * @param {string} module - 模块标识
     * @param {string} message - 日志消息
     * @param {*} [context] - 可选上下文
     */
    error: (module, message, context) => {
      write(LEVELS.ERROR, module, message, context)
    },

    /**
     * 获取内存中的日志历史记录（最近 100 条）
     * 主要用于调试排查
     * @returns {Array<{level: number, module: string, message: string, context: *, timestamp: string}>}
     */
    getHistory: () => {
      return [...history]
    },

    /**
     * 设置最低日志级别（供调试控制台使用）
     * @param {number} level - 日志级别（0=DEBUG, 1=INFO, 2=WARN, 3=ERROR）
     */
    _setMinLevel: (level) => {
      if (typeof level !== 'number' || level < LEVELS.DEBUG || level > LEVELS.ERROR) {
        console.warn(`[Logger] 无效的日志级别: ${level}，有效范围为 0-3`)
        return
      }
      Logger._minLevel = level
      console.log(`[Logger] 最低日志级别已设置为: ${LEVEL_NAMES[level]} (${level})`)
    },
  }

  // ==================== 导出为全局单例 ====================
  window.Logger = Logger
})()
