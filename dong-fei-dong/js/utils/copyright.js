/**
 * copyright.js - 版权合规后处理模块
 * 对AI解读结果进行版权过滤、来源标注等合规处理
 * 依赖：helpers.js（需先加载）
 */
;(function () {
  'use strict'

  const CopyrightFilter = {}

  /**
   * 过滤歌词引用 - 截断歌词至指定长度（约2句）
   * @param {string} text - 歌词文本
   * @param {number} maxLength - 最大保留长度，默认30字符
   * @returns {string} 截断后的歌词
   */
  CopyrightFilter.filterLyric = function (text, maxLength = 30) {
    if (!text || typeof text !== 'string') return ''
    const trimmed = text.trim()
    if (trimmed.length <= maxLength) return trimmed

    // 尝试在标点处截断（优先句号、逗号、分号）
    const punctuation = ['。', '，', '；', '！', '？', '、', '\n']
    let bestCut = maxLength

    for (let i = maxLength; i >= Math.floor(maxLength * 0.5); i--) {
      if (punctuation.includes(trimmed[i])) {
        bestCut = i + 1
        break
      }
    }

    return trimmed.substring(0, bestCut) + '……'
  }

  /**
   * 过滤书摘引用 - 截断书摘至指定长度
   * @param {string} text - 书摘文本
   * @param {number} maxLength - 最大保留长度，默认100字符
   * @returns {string} 截断后的书摘
   */
  CopyrightFilter.filterBookExcerpt = function (text, maxLength = 100) {
    if (!text || typeof text !== 'string') return ''
    const trimmed = text.trim()
    if (trimmed.length <= maxLength) return trimmed

    // 尝试在句号处截断，保持句子完整性
    let bestCut = maxLength
    for (let i = maxLength; i >= Math.floor(maxLength * 0.7); i--) {
      if (trimmed[i] === '。' || trimmed[i] === '；' || trimmed[i] === '\n') {
        bestCut = i + 1
        break
      }
    }

    return trimmed.substring(0, bestCut) + '……'
  }

  /**
   * 添加来源标注 - 在文本末尾追加出处信息
   * @param {string} text - 原始文本
   * @param {string} source - 来源名称（书名、歌曲名等）
   * @returns {string} 添加了来源标注的文本
   */
  CopyrightFilter.addSourceAttribution = function (text, source) {
    if (!text || typeof text !== 'string') return text || ''
    if (!source || typeof source !== 'string') return text

    const attribution = `——出处：《${source}》`

    // 检查是否已包含该来源标注，避免重复添加
    if (text.includes(attribution)) return text
    // 也检查是否已有类似的出处标注
    if (text.includes('——出处：') || text.includes('——出处:')) return text

    return text + '\n' + attribution
  }

  /**
   * 过滤AI输出结果 - 对AI解读结果进行综合版权合规处理
   * @param {Object} result - AI解读结果对象
   *   - result.original_text: 原始输入文本
   *   - result.input_type: 输入类型（'歌词' | '书摘' | '其他'）
   *   - result.source: 来源信息（可选）
   *   - result.interpretation: AI解读内容
   * @returns {Object} 经过合规处理后的结果对象
   */
  CopyrightFilter.filterAIOutput = function (result) {
    if (!result || typeof result !== 'object') return result

    // 创建结果的深拷贝，避免修改原始数据
    const sanitized = window.Helpers ? window.Helpers.deepClone(result) : JSON.parse(JSON.stringify(result))

    // 根据 input_type 对 original_text 进行过滤
    if (sanitized.original_text && sanitized.input_type) {
      switch (sanitized.input_type) {
        case '歌词':
          sanitized.original_text = CopyrightFilter.filterLyric(sanitized.original_text)
          break
        case '书摘':
          sanitized.original_text = CopyrightFilter.filterBookExcerpt(sanitized.original_text)
          break
        default:
          // 其他类型不做截断处理
          break
      }
    }

    // 确保来源标注存在
    if (sanitized.original_text && sanitized.source) {
      sanitized.original_text = CopyrightFilter.addSourceAttribution(
        sanitized.original_text,
        sanitized.source
      )
    }

    return sanitized
  }

  /**
   * 检查文本合规性 - 根据输入类型检查文本是否需要过滤
   * @param {string} text - 待检查文本
   * @param {string} inputType - 输入类型（'歌词' | '书摘' | '其他'）
   * @returns {{ compliant: boolean, filtered: string, reason: string|null }}
   *   - compliant: 是否合规（无需过滤）
   *   - filtered: 过滤后的文本
   *   - reason: 不合规的原因说明
   */
  CopyrightFilter.checkCompliance = function (text, inputType) {
    if (!text || typeof text !== 'string') {
      return { compliant: true, filtered: '', reason: null }
    }

    let filtered = text.trim()
    let reason = null

    switch (inputType) {
      case '歌词': {
        const limit = 30
        if (filtered.length > limit) {
          filtered = CopyrightFilter.filterLyric(filtered, limit)
          reason = '歌词引用超出长度限制，已自动截断'
        }
        break
      }
      case '书摘': {
        const limit = 100
        if (filtered.length > limit) {
          filtered = CopyrightFilter.filterBookExcerpt(filtered, limit)
          reason = '书摘引用超出长度限制，已自动截断'
        }
        break
      }
      default:
        // 其他类型不做特殊处理
        break
    }

    const compliant = (filtered === text.trim())

    return { compliant, filtered, reason }
  }

  // 挂载到全局
  window.CopyrightFilter = CopyrightFilter
})()
