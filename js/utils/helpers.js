/**
 * helpers.js - 通用工具函数库
 * 提供防抖、节流、深拷贝、日期格式化、ID生成等常用工具函数
 */
;(function () {
  'use strict'

  const Helpers = {}

  /**
   * 防抖函数 - 在最后一次调用后等待指定时间再执行
   * @param {Function} fn - 需要防抖的函数
   * @param {number} delay - 延迟时间（毫秒），默认300ms
   * @returns {Function} 防抖后的函数
   */
  Helpers.debounce = function (fn, delay = 300) {
    let timer = null
    return function (...args) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        fn.apply(this, args)
        timer = null
      }, delay)
    }
  }

  /**
   * 节流函数 - 在指定时间内最多执行一次
   * @param {Function} fn - 需要节流的函数
   * @param {number} limit - 间隔时间（毫秒），默认300ms
   * @returns {Function} 节流后的函数
   */
  Helpers.throttle = function (fn, limit = 300) {
    let lastRun = 0
    return function (...args) {
      const now = Date.now()
      if (now - lastRun >= limit) {
        fn.apply(this, args)
        lastRun = now
      }
    }
  }

  /**
   * 深拷贝 - 使用 JSON 序列化/反序列化实现
   * 注意：不支持函数、Symbol、undefined、循环引用等特殊类型
   * @param {*} obj - 需要深拷贝的对象
   * @returns {*} 深拷贝后的对象
   */
  Helpers.deepClone = function (obj) {
    try {
      return JSON.parse(JSON.stringify(obj))
    } catch (e) {
      console.error('[Helpers] deepClone 失败:', e)
      return null
    }
  }

  /**
   * 日期格式化 - 将时间戳格式化为指定格式的字符串
   * @param {number|string|Date} timestamp - 时间戳（毫秒）或日期对象
   * @param {string} format - 格式模板，默认 'YYYY-MM-DD HH:mm'
   *   支持的占位符：YYYY(年), MM(月), DD(日), HH(时), mm(分), ss(秒)
   * @returns {string} 格式化后的日期字符串
   */
  Helpers.formatDate = function (timestamp, format = 'YYYY-MM-DD HH:mm') {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) return ''

    const pad = (n) => String(n).padStart(2, '0')

    const replacements = {
      'YYYY': date.getFullYear(),
      'MM': pad(date.getMonth() + 1),
      'DD': pad(date.getDate()),
      'HH': pad(date.getHours()),
      'mm': pad(date.getMinutes()),
      'ss': pad(date.getSeconds())
    }

    let result = format
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(key, value)
    }
    return result
  }

  /**
   * 生成唯一ID - 基于前缀 + 时间戳 + 随机数
   * @param {string} prefix - ID前缀，默认为空
   * @returns {string} 唯一标识符
   */
  Helpers.generateId = function (prefix = '') {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${prefix}${timestamp}${random}`
  }

  /**
   * 文本截断 - 超过最大长度时添加省略后缀
   * @param {string} text - 原始文本
   * @param {number} maxLength - 最大字符数，默认30
   * @param {string} suffix - 截断后缀，默认 '...'
   * @returns {string} 截断后的文本
   */
  Helpers.truncateText = function (text, maxLength = 30, suffix = '...') {
    if (!text) return ''
    if (text.length <= maxLength) return text
    return text.substring(0, maxLength) + suffix
  }

  /**
   * HTML转义 - 防止XSS攻击
   * 转义字符：<, >, &, ", '
   * @param {string} str - 需要转义的字符串
   * @returns {string} 转义后的安全字符串
   */
  Helpers.escapeHtml = function (str) {
    if (!str) return ''
    const escapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }
    return str.replace(/[&<>"']/g, (char) => escapeMap[char])
  }

  /**
   * 输入净化 - 移除危险字符并修剪空白
   * @param {string} text - 需要净化的文本
   * @returns {string} 净化后的文本
   */
  Helpers.sanitizeInput = function (text) {
    if (!text) return ''
    // 移除HTML标签
    let sanitized = text.replace(/<[^>]*>/g, '')
    // 移除脚本相关内容
    sanitized = sanitized.replace(/javascript:/gi, '')
    sanitized = sanitized.replace(/on\w+\s*=/gi, '')
    // 修剪首尾空白，合并多余空格
    sanitized = sanitized.trim().replace(/\s+/g, ' ')
    return sanitized
  }

  /**
   * 安全JSON解析 - 带回退值的JSON.parse
   * @param {string} str - JSON字符串
   * @param {*} fallback - 解析失败时的回退值，默认null
   * @returns {*} 解析结果或回退值
   */
  Helpers.parseJSON = function (str, fallback = null) {
    if (typeof str !== 'string') return fallback
    try {
      return JSON.parse(str)
    } catch (e) {
      console.warn('[Helpers] parseJSON 解析失败:', e)
      return fallback
    }
  }

  /**
   * 判断文本是否主要为中文（CJK字符占比 >= 50%）
   * @param {string} text - 待检测文本
   * @returns {boolean} 是否为中文文本
   */
  Helpers.isChineseText = function (text) {
    if (!text) return false
    const stats = Helpers.calculateTextStats(text)
    return stats.chineseRatio >= 0.5
  }

  /**
   * 计算文本统计信息
   * @param {string} text - 待统计文本
   * @returns {{ charCount: number, chineseCount: number, chineseRatio: number }}
   */
  Helpers.calculateTextStats = function (text) {
    if (!text) return { charCount: 0, chineseCount: 0, chineseRatio: 0 }

    const charCount = text.length
    // CJK统一汉字范围：\u4e00-\u9fff，扩展A区：\u3400-\u4dbf
    const cjkRegex = /[\u4e00-\u9fff\u3400-\u4dbf]/g
    const chineseMatches = text.match(cjkRegex)
    const chineseCount = chineseMatches ? chineseMatches.length : 0
    const chineseRatio = charCount > 0 ? chineseCount / charCount : 0

    return { charCount, chineseCount, chineseRatio }
  }

  // 挂载到全局
  window.Helpers = Helpers
})()
