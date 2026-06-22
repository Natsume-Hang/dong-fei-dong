/**
 * api.js - 懂非懂 (DongFeiDong) AI 解读 API 模块
 *
 * 基于 IIFE 单例模式，封装与 DashScope (通义千问) API 的交互逻辑。
 * 负责构建提示词、发送请求、解析响应及错误处理。
 *
 * 导出: window.AIInterpreter
 */

;(function () {
  'use strict'

  // ==================== 常量配置 ====================
  /** API 请求地址 */
  const API_ENDPOINT = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'

  /** 使用的模型名称 */
  const MODEL = 'qwen-turbo'

  /** 请求超时时间（毫秒） */
  const TIMEOUT_MS = 10_000

  /** 文本字段最大长度限制 */
  const MAX_TITLE_LENGTH = 50
  const MAX_ORIGINAL_TEXT_LENGTH = 500
  const MAX_INTERPRETATION_LENGTH = 300

  /** pop_culture 数组最大条目数 */
  const MAX_POP_CULTURE_ITEMS = 5

  /** 模块标识，用于日志输出 */
  const MODULE = 'AIInterpreter'

  // ==================== 系统提示词模板 ====================
  /**
   * 构建系统提示词
   * 指导 AI 识别典故、成语、诗词引用，并以 JSON 格式返回结构化结果
   * @returns {string} 系统提示词
   */
  const buildSystemPrompt = () => {
    return `你是一位精通中国古典文学、历史典故和流行文化，同时深耕音乐、游戏、动漫等领域的学者。
用户会给你一段中文文本（可能来自歌词、诗词、日常用语、游戏角色等），你需要：

1. 识别文本中包含的典故、成语、诗词、游戏角色引用
2. 解释每个典故的来源、含义和背景故事
3. 以通俗易懂的方式讲解，适合普通读者
4. 如果有流行文化中的引用实例，一并列出

输出格式要求：严格返回 JSON 对象，包含以下字段：
{
  "allusion_title": "典故标题（最长50字）",
  "source": "出处来源（格式：作者·作品）",
  "original_text": "原文引用（最长500字）",
  "interpretation": "白话解释（100~300字）",
  "pop_culture": [
    {
      "work": "引用的作品名称",
      "creator": "创作者",
      "type": "作品类型（novel/film/tv/game/music/anime/other）",
      "usage": "引用场景描述"
    }
  ],
  "confidence": 0.8
}

注意：
- pop_culture 数组最多5条，如果没有则为空数组
- confidence 为0.0到1.0之间的浮点数，表示解读的可信度
- 所有文本内容使用简体中文`
  }

  // ==================== 错误码映射 ====================
  /**
   * HTTP 状态码到错误对象的映射表
   * @type {Record<number, {code: string, message: string}>}
   */
  const HTTP_ERROR_MAP = {
    400: { code: 'BAD_REQUEST', message: '请求参数错误，请重试' },
    401: { code: 'UNAUTHORIZED', message: '服务暂时不可用' },
    429: { code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' },
    500: { code: 'INTERNAL_ERROR', message: '服务异常，请稍后重试' },
    503: { code: 'SERVICE_UNAVAILABLE', message: '服务暂时不可用' },
    504: { code: 'GATEWAY_TIMEOUT', message: '解读超时，请重试' },
  }

  // ==================== 响应解析 ====================
  /**
   * 从 AI 响应中提取并验证数据
   * - 解析 choices[0].message.content 中的 JSON
   * - 校验必填字段
   * - 清洗文本字段（去空白、截断超长内容）
   * @param {Object} responseBody - API 原始响应体
   * @returns {Object} 解析后的数据对象
   * @throws {Error} 当响应格式无效或缺少必填字段时抛出异常
   */
  const parseResponse = (responseBody) => {
    const logger = window.Logger

    try {
      // 从响应体中提取 AI 返回的内容字符串
      const content = responseBody?.choices?.[0]?.message?.content
      if (!content) {
        logger.error(MODULE, '响应中缺少 AI 内容字段', { responseBody })
        throw new Error('响应中缺少 AI 内容字段')
      }

      logger.debug(MODULE, 'AI 原始返回内容', content)

      // 解析 JSON（兼容可能被 markdown 代码块包裹的情况）
      let jsonStr = content.trim()
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim()
      }

      const parsed = JSON.parse(jsonStr)

      // 校验必填字段
      const requiredFields = ['allusion_title', 'source', 'interpretation']
      for (const field of requiredFields) {
        if (!parsed[field]) {
          logger.error(MODULE, `缺少必填字段: ${field}`, { parsed })
          throw new Error(`缺少必填字段: ${field}`)
        }
      }

      // 清洗文本字段
      const sanitized = {
        allusion_title: truncate(String(parsed.allusion_title).trim(), MAX_TITLE_LENGTH),
        source: truncate(String(parsed.source || '').trim(), MAX_TITLE_LENGTH),
        original_text: truncate(String(parsed.original_text || '').trim(), MAX_ORIGINAL_TEXT_LENGTH),
        interpretation: truncate(String(parsed.interpretation).trim(), MAX_INTERPRETATION_LENGTH),
        pop_culture: sanitizePopCulture(parsed.pop_culture),
        confidence: clampConfidence(parsed.confidence),
      }

      logger.info(MODULE, '响应解析成功', sanitized)
      return sanitized
    } catch (err) {
      logger.error(MODULE, '响应解析失败', { error: err.message })
      throw err
    }
  }

  /**
   * 截断字符串到指定最大长度
   * @param {string} str - 输入字符串
   * @param {number} maxLength - 最大长度
   * @returns {string}
   */
  const truncate = (str, maxLength) => {
    if (!str) return ''
    return str.length > maxLength ? str.slice(0, maxLength) + '...' : str
  }

  /**
   * 清洗 pop_culture 数组
   * @param {Array} popCulture - 原始流行文化引用数组
   * @returns {Array} 清洗后的数组
   */
  const sanitizePopCulture = (popCulture) => {
    if (!Array.isArray(popCulture)) return []

    return popCulture.slice(0, MAX_POP_CULTURE_ITEMS).map((item) => ({
      work: truncate(String(item.work || '').trim(), 100),
      creator: truncate(String(item.creator || '').trim(), 50),
      type: truncate(String(item.type || 'other').trim(), 20),
      usage: truncate(String(item.usage || '').trim(), 200),
    }))
  }

  /**
   * 将 confidence 值限制在 [0, 1] 范围内
   * @param {*} value - 输入值
   * @returns {number}
   */
  const clampConfidence = (value) => {
    const num = Number(value)
    if (Number.isNaN(num)) return 0.5
    return Math.min(1, Math.max(0, num))
  }

  // ==================== 错误处理 ====================
  /**
   * 根据错误类型生成标准化的错误对象
   * @param {Error} error - 原始错误
   * @returns {{ code: string, message: string }}
   */
  const mapError = (error) => {
    const logger = window.Logger

    // AbortError：请求超时（AbortController 触发）
    if (error.name === 'AbortError') {
      logger.warn(MODULE, '请求超时', { error: error.message })
      return { code: 'TIMEOUT', message: '解读超时，请重试' }
    }

    // TypeError：通常是网络断开（fetch 失败）
    if (error instanceof TypeError) {
      logger.error(MODULE, '网络连接异常', { error: error.message })
      return { code: 'NETWORK_OFFLINE', message: '网络连接异常，请检查网络' }
    }

    // HTTP 错误（response.ok 为 false 时抛出的自定义错误）
    if (error.status) {
      const mapped = HTTP_ERROR_MAP[error.status]
      if (mapped) {
        logger.warn(MODULE, `HTTP ${error.status}: ${mapped.code}`, { message: mapped.message })
        return mapped
      }
    }

    // 其他未知错误
    logger.error(MODULE, '未知错误', { error: error.message })
    return { code: 'UNKNOWN_ERROR', message: '解读失败，请重试' }
  }

  // ==================== 核心请求方法 ====================
  /**
   * 调用 AI 解读接口
   * @param {string} inputText - 用户输入的文本
   * @param {string} inputType - 文本类型描述（如"歌词"、"诗词"等）
   * @param {string} [context=''] - 可选的上下文信息
   * @returns {Promise<{ success: boolean, data: Object|null, error: Object|null }>}
   */
  const interpret = async (inputText, inputType, context = '') => {
    const logger = window.Logger

    // 调试模式：模拟超时
    if (AIInterpreter._mockTimeout) {
      logger.warn(MODULE, '[调试] 模拟超时已启用')
      return { success: false, data: null, error: { code: 'TIMEOUT', message: '解读超时，请重试' } }
    }

    // 调试模式：模拟服务不可用
    if (AIInterpreter._mockUnavailable) {
      logger.warn(MODULE, '[调试] 模拟服务不可用已启用')
      return { success: false, data: null, error: { code: 'SERVICE_UNAVAILABLE', message: '服务暂时不可用' } }
    }

    // 检查 API Key 是否已配置
    const apiKey = window.__DFD_CONFIG__?.apiKey || ''
    if (!apiKey) {
      logger.error(MODULE, 'API Key 未配置')
      return { success: false, data: null, error: { code: 'UNAUTHORIZED', message: '服务暂时不可用' } }
    }

    // 构建用户消息
    let userMessage = `请解释以下【${inputType}】：${inputText}`
    if (context) {
      userMessage += `\n\n补充上下文：${context}`
    }

    logger.info(MODULE, '发送解读请求', { inputType, textLength: inputText.length })

    // 设置 AbortController 超时控制
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      // 构建请求体
      const requestBody = {
        model: MODEL,
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }

      logger.debug(MODULE, '请求体', requestBody)

      // 发送 POST 请求
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      })

      // 清除超时定时器
      clearTimeout(timeoutId)

      // 检查 HTTP 状态码
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`)
        error.status = response.status
        throw error
      }

      // 解析响应体
      const responseBody = await response.json()
      logger.debug(MODULE, '原始响应体', responseBody)

      // 提取并验证数据
      const data = parseResponse(responseBody)

      return { success: true, data, error: null }
    } catch (error) {
      // 确保超时定时器被清除
      clearTimeout(timeoutId)

      // 映射错误并返回
      const errorObj = mapError(error)
      return { success: false, data: null, error: errorObj }
    }
  }

  // ==================== 工具方法 ====================
  /**
   * 检查 API 是否可用（API Key 是否已配置）
   * @returns {boolean}
   */
  const isAvailable = () => {
    const apiKey = window.__DFD_CONFIG__?.apiKey || ''
    const available = apiKey.length > 0
    const logger = window.Logger
    logger.debug(MODULE, `API 可用性检查: ${available}`)
    return available
  }

  /**
   * 设置 API Key（主要用于测试）
   * @param {string} key - API 密钥
   */
  const setApiKey = (key) => {
    if (!window.__DFD_CONFIG__) {
      window.__DFD_CONFIG__ = {}
    }
    window.__DFD_CONFIG__.apiKey = key
    const logger = window.Logger
    logger.info(MODULE, 'API Key 已更新')
  }

  // ==================== AIInterpreter 单例对象 ====================
  const AIInterpreter = {
    /** 核心解读方法 */
    interpret,

    /** 构建系统提示词 */
    buildSystemPrompt,

    /** 解析 AI 响应 */
    parseResponse,

    /** 检查 API 是否可用 */
    isAvailable,

    /** 设置 API Key（测试用） */
    setApiKey,

    /** 调试标志：模拟超时 */
    _mockTimeout: false,

    /** 调试标志：模拟服务不可用 */
    _mockUnavailable: false,
  }

  // ==================== 导出为全局单例 ====================
  window.AIInterpreter = AIInterpreter
})()
