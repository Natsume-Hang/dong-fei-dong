/**
 * lang-detect.js - 中文语言检测模块
 * 提供文本语言判断、输入验证等功能
 * 依赖：helpers.js（需先加载）
 */
;(function () {
  'use strict'

  const LangDetect = {}

  // 配置常量
  const CONFIG = {
    MIN_LENGTH: 10,       // 最小输入长度
    MAX_LENGTH: 500,      // 最大输入长度
    CJK_THRESHOLD: 0.5,   // CJK字符占比阈值（50%）
    CJK_MIN_CHARS: 10     // 最少需要的CJK字符数
  }

  // CJK正则：匹配中日韩统一汉字（基本区 + 扩展A区）
  const CJK_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf]/g

  /**
   * 判断文本是否包含有意义的中文内容
   * 条件：至少10个字符，且CJK字符占比 >= 50%
   * @param {string} text - 待检测文本
   * @returns {boolean} 是否为有效中文内容
   */
  LangDetect.isChinese = function (text) {
    if (!text || typeof text !== 'string') return false

    const trimmed = text.trim()
    if (trimmed.length < CONFIG.MIN_LENGTH) return false

    const cjkMatches = trimmed.match(CJK_REGEX)
    const chineseCount = cjkMatches ? cjkMatches.length : 0
    const chineseRatio = chineseCount / trimmed.length

    return chineseRatio >= CONFIG.CJK_THRESHOLD
  }

  /**
   * 获取文本的语言提示
   * @param {string} text - 待检测文本
   * @returns {'chinese'|'mixed'|'non-chinese'} 语言类型
   *   - chinese: 中文文本（CJK占比 >= 80%）
   *   - mixed: 中英混合文本（CJK占比 50%~80%）
   *   - non-chinese: 非中文文本（CJK占比 < 50%）
   */
  LangDetect.getLanguageHint = function (text) {
    if (!text || typeof text !== 'string') return 'non-chinese'

    const trimmed = text.trim()
    if (trimmed.length === 0) return 'non-chinese'

    const cjkMatches = trimmed.match(CJK_REGEX)
    const chineseCount = cjkMatches ? cjkMatches.length : 0
    const chineseRatio = chineseCount / trimmed.length

    if (chineseRatio >= 0.8) return 'chinese'
    if (chineseRatio >= CONFIG.CJK_THRESHOLD) return 'mixed'
    return 'non-chinese'
  }

  /**
   * 验证用户输入是否符合要求
   * @param {string} text - 用户输入的文本
   * @returns {{ valid: boolean, reason: string|null }} 验证结果
   *   - valid: 是否通过验证
   *   - reason: 未通过时的原因说明（中文提示）
   */
  LangDetect.validateInput = function (text) {
    // 空值检查
    if (!text || typeof text !== 'string') {
      return { valid: false, reason: '请输入文本内容' }
    }

    const trimmed = text.trim()

    // 空内容检查
    if (trimmed.length === 0) {
      return { valid: false, reason: '请输入文本内容' }
    }

    // 最小长度检查
    if (trimmed.length < CONFIG.MIN_LENGTH) {
      return { valid: false, reason: '输入内容至少需要10个字符' }
    }

    // 最大长度检查
    if (trimmed.length > CONFIG.MAX_LENGTH) {
      return { valid: false, reason: '输入内容不能超过500个字符' }
    }

    // 中文内容检查
    const cjkMatches = trimmed.match(CJK_REGEX)
    const chineseCount = cjkMatches ? cjkMatches.length : 0
    const chineseRatio = chineseCount / trimmed.length

    if (chineseRatio < CONFIG.CJK_THRESHOLD) {
      return { valid: false, reason: '当前仅支持简体中文内容' }
    }

    // 验证通过
    return { valid: true, reason: null }
  }

  // 挂载到全局
  window.LangDetect = LangDetect
})()
