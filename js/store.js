/**
 * store.js - 懂非懂 (DongFeiDong) 本地存储管理模块
 *
 * 基于 IIFE 单例模式，封装 localStorage 操作，提供带命名空间前缀 (dfd_)
 * 的数据存取接口。包含查询历史、收藏、反馈、每日辟谣、热词等业务数据的
 * 读写方法，支持存储配额溢出时自动清理，所有操作通过 Logger 记录。
 *
 * 依赖: window.Logger (logger.js)
 * 导出: window.Store
 */

;(function () {
  'use strict'

  // ==================== 常量定义 ====================

  /** 存储键名前缀，避免与其他应用冲突 */
  const PREFIX = 'dfd_'

  /** 预定义的存储键名 */
  const KEYS = Object.freeze({
    HISTORY: `${PREFIX}history`,       // 查询历史数组
    FAVORITES: `${PREFIX}favorites`,   // 收藏的结果 ID 数组
    FEEDBACK: `${PREFIX}feedback`,     // 反馈记录数组
    DAILY: `${PREFIX}daily`,           // 每日辟谣信息 { lastDailyDate, lastDailyId }
    HOT_KEYWORDS: `${PREFIX}hot_keywords`, // 热门关键词数组
    LAST_INPUT: `${PREFIX}last_input`, // 上次输入 { text, type }
  })

  /** 查询历史最大保留条数 */
  const MAX_HISTORY_ITEMS = 50

  // ==================== 内部工具方法 ====================

  /**
   * 获取 Logger 引用（兼容 Logger 尚未加载的情况）
   * @returns {object|null}
   */
  const getLogger = () => window.Logger || null

  /**
   * 计算当前所有 dfd_ 前缀键占用的存储空间（单位：KB）
   * @returns {number}
   */
  const calcStorageUsed = () => {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(PREFIX)) {
        const value = localStorage.getItem(key)
        if (value) {
          // 每个字符按 2 字节（UTF-16）计算
          total += (key.length + value.length) * 2
        }
      }
    }
    return parseFloat((total / 1024).toFixed(2))
  }

  /**
   * 自动清理策略：当存储配额溢出时，移除最旧的查询历史记录以释放空间
   * @returns {boolean} 是否成功清理
   */
  const autoCleanup = () => {
    const logger = getLogger()
    logger && logger.warn('Store', '存储配额溢出，执行自动清理')

    try {
      const historyData = localStorage.getItem(KEYS.HISTORY)
      if (historyData) {
        const history = JSON.parse(historyData)
        if (Array.isArray(history) && history.length > 0) {
          // 移除最旧的 10 条历史记录
          const trimmed = history.slice(0, Math.max(0, history.length - 10))
          localStorage.setItem(KEYS.HISTORY, JSON.stringify(trimmed))
          logger && logger.info('Store', `自动清理完成，移除了 ${history.length - trimmed.length} 条历史记录`)
          return true
        }
      }
    } catch (err) {
      logger && logger.error('Store', '自动清理失败', err.message)
    }

    return false
  }

  // ==================== Store 单例对象 ====================
  const Store = {
    /**
     * 从 localStorage 读取并解析 JSON 数据
     * @param {string} key - 存储键名（不含前缀时自动补全）
     * @returns {*} 解析后的数据，出错时返回 null
     */
    get: (key) => {
      const logger = getLogger()
      const fullKey = key.startsWith(PREFIX) ? key : `${PREFIX}${key}`

      try {
        const raw = localStorage.getItem(fullKey)
        if (raw === null) {
          logger && logger.debug('Store', `读取 ${fullKey}: 键不存在，返回 null`)
          return null
        }
        const parsed = JSON.parse(raw)
        logger && logger.debug('Store', `读取 ${fullKey} 成功`)
        return parsed
      } catch (err) {
        logger && logger.error('Store', `读取 ${fullKey} 失败`, err.message)
        return null
      }
    },

    /**
     * 将数据序列化为 JSON 并写入 localStorage
     * 遇到 QuotaExceededError 时自动清理并重试
     * @param {string} key - 存储键名（不含前缀时自动补全）
     * @param {*} value - 要存储的值（必须可 JSON 序列化）
     * @returns {boolean} 是否写入成功
     */
    set: (key, value) => {
      const logger = getLogger()
      const fullKey = key.startsWith(PREFIX) ? key : `${PREFIX}${key}`

      try {
        const serialized = JSON.stringify(value)
        localStorage.setItem(fullKey, serialized)
        logger && logger.debug('Store', `写入 ${fullKey} 成功`)
        return true
      } catch (err) {
        // 处理存储配额溢出
        if (err.name === 'QuotaExceededError' || err.code === 22) {
          logger && logger.warn('Store', `写入 ${fullKey} 时存储配额溢出，尝试自动清理`)
          if (autoCleanup()) {
            // 清理后重试一次
            try {
              const serialized = JSON.stringify(value)
              localStorage.setItem(fullKey, serialized)
              logger && logger.info('Store', `重试写入 ${fullKey} 成功`)
              return true
            } catch (retryErr) {
              logger && logger.error('Store', `重试写入 ${fullKey} 仍然失败`, retryErr.message)
              return false
            }
          }
        }

        logger && logger.error('Store', `写入 ${fullKey} 失败`, err.message)
        return false
      }
    },

    /**
     * 从 localStorage 中删除指定键
     * @param {string} key - 存储键名（不含前缀时自动补全）
     */
    remove: (key) => {
      const logger = getLogger()
      const fullKey = key.startsWith(PREFIX) ? key : `${PREFIX}${key}`

      try {
        localStorage.removeItem(fullKey)
        logger && logger.debug('Store', `已删除 ${fullKey}`)
      } catch (err) {
        logger && logger.error('Store', `删除 ${fullKey} 失败`, err.message)
      }
    },

    /**
     * 清除存储数据
     * @param {string} [key] - 指定键名时仅清除该键；不传则清除所有 dfd_ 前缀的键
     */
    clear: (key) => {
      const logger = getLogger()

      try {
        if (key) {
          // 清除指定键
          const fullKey = key.startsWith(PREFIX) ? key : `${PREFIX}${key}`
          localStorage.removeItem(fullKey)
          logger && logger.info('Store', `已清除 ${fullKey}`)
        } else {
          // 清除所有 dfd_ 前缀的键
          const keysToRemove = []
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith(PREFIX)) {
              keysToRemove.push(k)
            }
          }
          keysToRemove.forEach((k) => localStorage.removeItem(k))
          logger && logger.info('Store', `已清除所有 dfd_ 数据，共 ${keysToRemove.length} 个键`)
        }
      } catch (err) {
        logger && logger.error('Store', '清除存储失败', err.message)
      }
    },

    // ==================== 查询历史相关 ====================

    /**
     * 获取查询历史列表
     * @returns {Array} 历史记录数组
     */
    getHistory: () => {
      return Store.get(KEYS.HISTORY) || []
    },

    /**
     * 添加一条查询历史记录（插入到数组头部）
     * 自动限制最大条数，超出时移除最旧的记录
     * @param {object} item - 历史记录项
     * @returns {boolean} 是否添加成功
     */
    addHistory: (item) => {
      const logger = getLogger()
      try {
        const history = Store.getHistory()
        // 将新记录插入到数组头部
        history.unshift(item)
        // 保留最多 MAX_HISTORY_ITEMS 条
        if (history.length > MAX_HISTORY_ITEMS) {
          history.length = MAX_HISTORY_ITEMS
        }
        const success = Store.set(KEYS.HISTORY, history)
        if (success) {
          logger && logger.debug('Store', '添加历史记录成功')
        }
        return success
      } catch (err) {
        logger && logger.error('Store', '添加历史记录失败', err.message)
        return false
      }
    },

    // ==================== 收藏相关 ====================

    /**
     * 获取收藏列表
     * @returns {Array<string>} 收藏的结果 ID 数组
     */
    getFavorites: () => {
      return Store.get(KEYS.FAVORITES) || []
    },

    /**
     * 切换收藏状态（已收藏则取消，未收藏则添加）
     * @param {string} id - 结果 ID
     * @returns {boolean} 操作后的收藏状态（true=已收藏）
     */
    toggleFavorite: (id) => {
      const logger = getLogger()
      try {
        const favorites = Store.getFavorites()
        const index = favorites.indexOf(id)

        if (index > -1) {
          // 已收藏，取消收藏
          favorites.splice(index, 1)
          logger && logger.info('Store', `取消收藏: ${id}`)
        } else {
          // 未收藏，添加收藏
          favorites.push(id)
          logger && logger.info('Store', `添加收藏: ${id}`)
        }

        Store.set(KEYS.FAVORITES, favorites)
        return index === -1 // 返回操作后的状态
      } catch (err) {
        logger && logger.error('Store', '切换收藏失败', err.message)
        return false
      }
    },

    /**
     * 检查指定 ID 是否已被收藏
     * @param {string} id - 结果 ID
     * @returns {boolean}
     */
    isFavorited: (id) => {
      const favorites = Store.getFavorites()
      return favorites.includes(id)
    },

    // ==================== 反馈相关 ====================

    /**
     * 添加一条反馈记录
     * @param {object} record - 反馈记录（应包含 resultId, type 等字段）
     * @returns {boolean}
     */
    addFeedback: (record) => {
      const logger = getLogger()
      try {
        const feedback = Store.get(KEYS.FEEDBACK) || []
        feedback.push(record)
        const success = Store.set(KEYS.FEEDBACK, feedback)
        if (success) {
          logger && logger.info('Store', '添加反馈记录成功', record)
        }
        return success
      } catch (err) {
        logger && logger.error('Store', '添加反馈记录失败', err.message)
        return false
      }
    },

    /**
     * 检查是否已存在相同的反馈记录（去重判断）
     * @param {string} resultId - 结果 ID
     * @param {string} type - 反馈类型
     * @returns {boolean}
     */
    hasFeedback: (resultId, type) => {
      const feedback = Store.get(KEYS.FEEDBACK) || []
      return feedback.some((item) => item.resultId === resultId && item.type === type)
    },

    // ==================== 每日辟谣相关 ====================

    /**
     * 获取每日辟谣信息
     * @returns {object|null} { lastDailyDate, lastDailyId } 或 null
     */
    getDaily: () => {
      return Store.get(KEYS.DAILY)
    },

    /**
     * 设置每日辟谣信息
     * @param {string} date - 日期字符串
     * @param {string} id - 辟谣结果 ID
     * @returns {boolean}
     */
    setDaily: (date, id) => {
      const logger = getLogger()
      const success = Store.set(KEYS.DAILY, { lastDailyDate: date, lastDailyId: id })
      if (success) {
        logger && logger.info('Store', '设置每日辟谣', { date, id })
      }
      return success
    },

    // ==================== 热门关键词相关 ====================

    /**
     * 获取热门关键词列表
     * @returns {Array<string>}
     */
    getHotKeywords: () => {
      return Store.get(KEYS.HOT_KEYWORDS) || []
    },

    // ==================== 上次输入相关 ====================

    /**
     * 获取上次输入的内容
     * @returns {object|null} { text, type } 或 null
     */
    getLastInput: () => {
      return Store.get(KEYS.LAST_INPUT)
    },

    /**
     * 保存本次输入的内容
     * @param {string} text - 输入文本
     * @param {string} type - 输入类型（如 'text', 'image'）
     * @returns {boolean}
     */
    setLastInput: (text, type) => {
      const logger = getLogger()
      const success = Store.set(KEYS.LAST_INPUT, { text, type })
      if (success) {
        logger && logger.debug('Store', '保存上次输入', { text, type })
      }
      return success
    },

  // ==================== 使用统计 ====================

    /**
     * 获取当前存储使用统计信息
     * @returns {{ historyCount: number, favoritesCount: number, feedbackCount: number, storageUsed: number }}
     */
    getUsage: () => {
      const logger = getLogger()
      try {
        const usage = {
          historyCount: Store.getHistory().length,
          favoritesCount: Store.getFavorites().length,
          feedbackCount: (Store.get(KEYS.FEEDBACK) || []).length,
          storageUsed: calcStorageUsed(),
        }
        logger && logger.debug('Store', '获取使用统计', usage)
        return usage
      } catch (err) {
        logger && logger.error('Store', '获取使用统计失败', err.message)
        return {
          historyCount: 0,
          favoritesCount: 0,
          feedbackCount: 0,
          storageUsed: 0,
        }
      }
    },

    // ==================== 存储可用性检测 ====================

    /**
     * 检测 localStorage 是否可用
     */
    checkAvailability: () => {
      const logger = getLogger()
      try {
        const testKey = `${PREFIX}_test_availability`
        localStorage.setItem(testKey, '1')
        localStorage.removeItem(testKey)
        logger && logger.info('Store', 'localStorage 可用')
        return true
      } catch (err) {
        logger && logger.warn('Store', 'localStorage 不可用', err.message)
        return false
      }
    },

    /**
     * 获取存储可用性状态
     * @returns {boolean}
     */
    isAvailable: () => {
      return Store.checkAvailability()
    },
  }

  // ==================== 导出为全局单例 ====================
  window.Store = Store
})()
