/**
 * SeedDB - 典故种子数据库模块
 * 负责加载、索引和检索 seed.json 中的典故数据
 * 采用 IIFE 单例模式，挂载到 window.SeedDB
 */
;(function (global) {
  'use strict'

  // ============================================================
  // 内部状态
  // ============================================================

  /** @type {Array<Object>} 所有典故记录 */
  let _data = []

  /** @type {boolean} 数据是否已加载 */
  let _loaded = false

  /** @type {Map<string, Object>} ID -> 记录的快速查找索引 */
  let _index = new Map()

  /** @type {Map<string, number[]>} 关键词 -> 匹配记录索引数组 */
  let _keywordIndex = new Map()

  // ============================================================
  // 内部工具函数
  // ============================================================

  /**
   * 获取 Logger 实例（兼容外部 Logger 模块）
   * 如果 window.Logger 不存在则使用轻量级 console 替代
   * @returns {{ info: Function, warn: Function, error: Function }}
   */
  function _getLogger() {
    if (global.Logger && typeof global.Logger.info === 'function') {
      return global.Logger
    }
    // 轻量级 fallback logger
    return {
      info: (...args) => console.log('[SeedDB:INFO]', ...args),
      warn: (...args) => console.warn('[SeedDB:WARN]', ...args),
      error: (...args) => console.error('[SeedDB:ERROR]', ...args),
    }
  }

  /**
   * 构建索引
   * 遍历所有记录，建立 ID 索引和关键词倒排索引
   */
  function _buildIndexes() {
    const logger = _getLogger()
    _index.clear()
    _keywordIndex.clear()

    _data.forEach((record, idx) => {
      // ID 索引
      _index.set(record.id, record)

      // 关键词倒排索引
      if (Array.isArray(record.keywords)) {
        record.keywords.forEach((keyword) => {
          const key = keyword.toLowerCase()
          if (!_keywordIndex.has(key)) {
            _keywordIndex.set(key, [])
          }
          _keywordIndex.get(key).push(idx)
        })
      }
    })

    logger.info(`索引构建完成：ID索引 ${_index.size} 条，关键词索引 ${_keywordIndex.size} 条`)
  }

  /**
   * 预处理输入文本：去除首尾空白并转小写
   * @param {string} text - 原始输入文本
   * @returns {string} 处理后的文本
   */
  function _preprocess(text) {
    if (typeof text !== 'string') return ''
    return text.trim().toLowerCase()
  }

  // ============================================================
  // SeedDB 对象定义
  // ============================================================

  const SeedDB = {
    /**
     * 加载种子数据
     * 使用懒加载策略，仅在首次调用时执行 fetch
     * @param {string} [url='data/seed.json'] - 种子数据文件的 URL
     * @returns {Promise<{success: boolean, data: number|null, error: string|null}>}
     */
    async load(url = 'data/seed.json') {
      const logger = _getLogger()

      // 懒加载：已加载则直接返回
      if (_loaded) {
        logger.info('数据已加载，跳过重复加载')
        return { success: true, data: _data.length, error: null }
      }

      try {
        logger.info(`正在加载种子数据：${url}`)

        // 发起 fetch 请求
        const response = await fetch(url)

        if (!response.ok) {
          const errMsg = `SEED_FILE_ERROR: HTTP ${response.status} ${response.statusText}`
          logger.error(errMsg)
          return { success: false, data: null, error: errMsg }
        }

        // 解析 JSON
        let parsed
        try {
          parsed = await response.json()
        } catch (parseErr) {
          const errMsg = `SEED_PARSE_ERROR: ${parseErr.message}`
          logger.error(errMsg)
          return { success: false, data: null, error: errMsg }
        }

        // 校验数据格式
        if (!Array.isArray(parsed)) {
          const errMsg = 'SEED_PARSE_ERROR: 数据格式错误，期望数组'
          logger.error(errMsg)
          return { success: false, data: null, error: errMsg }
        }

        // 存储数据
        _data = parsed
        _loaded = true

        // 构建索引
        _buildIndexes()

        logger.info(`种子数据加载成功，共 ${_data.length} 条记录`)
        return { success: true, data: _data.length, error: null }
      } catch (err) {
        // 处理 fetch 网络错误等异常
        const errMsg = `SEED_FILE_ERROR: ${err.message || '未知网络错误'}`
        logger.error(errMsg)
        return { success: false, data: null, error: errMsg }
      }
    },

    /**
     * 搜索典故
     * 通过关键词子串匹配进行搜索，按匹配得分降序排列
     * @param {string} inputText - 用户输入的搜索文本
     * @param {string} [inputType] - 可选的输入类型过滤（歌词|书摘|角色名|典故|通用）
     * @returns {{success: boolean, data: {primary: Object|null, related: Object[]}, error: string|null}}
     */
    search(inputText, inputType) {
      const logger = _getLogger()

      // 未加载时自动尝试加载
      if (!_loaded) {
        logger.warn('数据未加载，尝试同步加载种子数据')
        // search 是同步方法，无法 await load()
        // 但 load() 内部是 fetch + parse，这里标记需要加载
        // 实际应在调用 search 前由调用方确保 load() 已完成
        // 作为兜底：尝试同步加载（仅当 data/seed.json 已被浏览器缓存时可能成功）
        try {
          const xhr = new XMLHttpRequest()
          xhr.open('GET', 'data/seed.json', false) // 同步请求
          xhr.send()
          if (xhr.status === 200) {
            const parsed = JSON.parse(xhr.responseText)
            if (Array.isArray(parsed) && parsed.length > 0) {
              _data = parsed
              _loaded = true
              _buildIndexes()
              logger.info(`同步加载种子数据成功，共 ${_data.length} 条记录`)
            }
          }
        } catch (syncErr) {
          logger.warn('同步加载种子数据失败', syncErr.message)
          return { success: true, data: { primary: null, related: [] }, error: null }
        }
      }

      if (!_loaded || _data.length === 0) {
        logger.warn('数据未加载，无法执行搜索')
        return { success: true, data: { primary: null, related: [] }, error: null }
      }

      const processedInput = _preprocess(inputText)

      if (!processedInput) {
        logger.warn('搜索输入为空')
        return { success: true, data: { primary: null, related: [] }, error: null }
      }

      logger.info(`搜索：输入="${inputText}"，类型=${inputType || '不限'}`)

      // 计算每条记录的匹配得分
      const scored = []

      // 计算输入文本与关键词的匹配度（基于公共子串长度占比）
      function _calcMatchScore(input, keyword) {
        // 快速排除：keyword 比输入长很多时不太可能是精确匹配
        if (keyword.length > input.length * 2) return 0
        // 快速排除：keyword 或 input 太短（单字）时避免误匹配
        if (keyword.length < 2 && input.length > 2) return 0

        // 方式1：输入包含关键词（如输入"但愿人长久"包含关键词"但愿人长久"）
        if (input.includes(keyword)) {
          // 关键词越长、占输入比例越高，得分越高
          return 1 + (keyword.length / input.length)
        }
        // 方式2：关键词包含输入（如输入"故乡"包含在关键词"鲁迅故乡"中）
        if (keyword.includes(input)) {
          return 1 + (input.length / keyword.length)
        }
        return 0
      }

      _data.forEach((record, idx) => {
        let score = 0

        // 遍历记录的关键词，使用基于长度占比的匹配评分
        if (Array.isArray(record.keywords)) {
          record.keywords.forEach((keyword) => {
            const lowerKeyword = keyword.toLowerCase()
            score += _calcMatchScore(processedInput, lowerKeyword)
          })
        }

        // 同时检查标题和摘要是否包含输入文本
        const titleLower = (record.title || '').toLowerCase()
        const summaryLower = (record.summary || '').toLowerCase()
        if (titleLower.includes(processedInput)) {
          score += 2 // 标题匹配权重更高
        }
        if (summaryLower.includes(processedInput)) {
          score += 1
        }

        // 如果指定了 inputType，匹配的记录获得加分
        if (inputType && record.input_type === inputType) {
          score += 3
        }

        // 只有当关键词匹配得分 >= 1 时才视为有效匹配
        // （避免单字误匹配导致的虚假结果）
        const keywordScore = score - (inputType && record.input_type === inputType ? 3 : 0)
        if (keywordScore >= 1) {
          scored.push({ idx, score, record })
        }
      })

      // 按得分降序排列
      scored.sort((a, b) => b.score - a.score)

      // 提取结果
      const primary = scored.length > 0 ? scored[0].record : null
      const related = scored.slice(1, 4).map((item) => item.record)

      logger.info(
        `搜索完成：找到 ${scored.length} 条匹配，主结果=${primary ? primary.id : '无'}`
      )

      return { success: true, data: { primary, related }, error: null }
    },

    /**
     * 根据 ID 获取单条记录
     * @param {string} id - 典故记录 ID（如 "lyric-001"）
     * @returns {Object|null} 匹配的记录，未找到返回 null
     */
    getById(id) {
      const logger = _getLogger()

      if (!_loaded) {
        logger.warn('数据未加载，无法执行 getById')
        return null
      }

      const record = _index.get(id) || null

      if (record) {
        logger.info(`getById：找到记录 ${id}`)
      } else {
        logger.warn(`getById：未找到记录 ${id}`)
      }

      return record
    },

    /**
     * 根据输入类型获取所有匹配记录
     * @param {string} inputType - 输入类型（歌词|书摘|角色名|典故|通用）
     * @returns {Object[]} 匹配的记录数组
     */
    getByType(inputType) {
      const logger = _getLogger()

      if (!_loaded) {
        logger.warn('数据未加载，无法执行 getByType')
        return []
      }

      const results = _data.filter((record) => record.input_type === inputType)

      logger.info(`getByType：类型="${inputType}"，找到 ${results.length} 条记录`)

      return results
    },

    /**
     * 根据分类获取所有匹配记录
     * @param {string} category - 分类名称（lyric|poetry|historical|misconception）
     * @returns {Object[]} 匹配的记录数组
     */
    getByCategory(category) {
      const logger = _getLogger()

      if (!_loaded) {
        logger.warn('数据未加载，无法执行 getByCategory')
        return []
      }

      const results = _data.filter((record) => record.category === category)

      logger.info(`getByCategory：分类="${category}"，找到 ${results.length} 条记录`)

      return results
    },

    /**
     * 获取随机记录（用于每日辟谣等功能）
     * @param {number} [count=1] - 需要获取的随机记录数量
     * @returns {Object[]} 随机记录数组
     */
    getRandom(count = 1) {
      const logger = _getLogger()

      if (!_loaded || _data.length === 0) {
        logger.warn('数据未加载，无法执行 getRandom')
        return []
      }

      const safeCount = Math.min(Math.max(1, Math.floor(count)), _data.length)

      // Fisher-Yates 洗牌算法取前 N 条
      const shuffled = [..._data]
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
      }

      const results = shuffled.slice(0, safeCount)

      logger.info(`getRandom：获取 ${safeCount} 条随机记录`)

      return results
    },

    /**
     * 获取所有已加载的记录
     * @returns {Object[]} 所有记录数组
     */
    getAll() {
      const logger = _getLogger()

      if (!_loaded) {
        logger.warn('数据未加载，getAll 返回空数组')
        return []
      }

      logger.info(`getAll：返回全部 ${_data.length} 条记录`)

      return [..._data]
    },

    /**
     * 获取已加载记录的总数
     * @returns {number} 记录总数
     */
    getCount() {
      return _data.length
    },

    /**
     * 检查数据是否已加载
     * @returns {boolean} 是否已加载
     */
    isLoaded() {
      return _loaded
    },
  }

  // ============================================================
  // 导出为全局单例
  // ============================================================

  // 冻结对象防止意外修改
  Object.freeze(SeedDB)

  // 挂载到 window
  global.SeedDB = SeedDB

  _getLogger().info('SeedDB 模块已初始化')
})(typeof window !== 'undefined' ? window : this)
