/**
 * credibility.js - 懂非懂 (DongFeiDong) 可信度标签组件
 *
 * 基于 IIFE 单例模式，提供 AI 解读结果的可信度/置信度展示组件。
 * 根据置信度分数自动匹配等级（高/中/低），渲染对应的标签样式。
 *
 * 等级划分：
 *   HIGH   - score >= 0.75 → "高可信度"  (绿色)
 *   MEDIUM - score >= 0.5  → "中等可信度" (橙色)
 *   LOW    - score < 0.5   → "仅供参考"   (红色)
 *
 * 导出: window.CredibilityTag
 */

;(function () {
  'use strict'

  // ==================== 常量定义 ====================

  /** 模块标识，用于日志输出 */
  const MODULE = 'CredibilityTag'

  /** 置信度等级阈值 */
  const THRESHOLDS = Object.freeze({
    HIGH: 0.75,
    MEDIUM: 0.5,
  })

  /** 等级配置表：标签文本、CSS 类名、图标 */
  const LEVEL_CONFIG = Object.freeze({
    high: {
      label: '高可信度',
      cssClass: 'credibility-high',
      icon: '\u2713',   // ✓
    },
    medium: {
      label: '中等可信度',
      cssClass: 'credibility-medium',
      icon: '!',        // !
    },
    low: {
      label: '仅供参考',
      cssClass: 'credibility-low',
      icon: '?',        // ?
    },
  })

  /** DOM 元素的 data 属性名，用于标记已渲染的标签 */
  const DATA_ATTR = 'data-credibility-tag'

  // ==================== 核心方法 ====================

  /**
   * 根据置信度分数获取等级标识
   * @param {number} score - 置信度分数（0.0 ~ 1.0）
   * @returns {'high'|'medium'|'low'}
   */
  const getLevel = (score) => {
    const logger = window.Logger
    const num = Number(score)

    if (Number.isNaN(num) || num < 0 || num > 1) {
      logger.warn(MODULE, `无效的置信度分数: ${score}，默认使用 low`)
      return 'low'
    }

    if (num >= THRESHOLDS.HIGH) return 'high'
    if (num >= THRESHOLDS.MEDIUM) return 'medium'
    return 'low'
  }

  /**
   * 根据置信度分数获取中文标签文本
   * @param {number} score - 置信度分数（0.0 ~ 1.0）
   * @returns {string}
   */
  const getLabel = (score) => {
    const level = getLevel(score)
    return LEVEL_CONFIG[level].label
  }

  /**
   * 根据置信度分数获取 CSS 类名
   * @param {number} score - 置信度分数（0.0 ~ 1.0）
   * @returns {string}
   */
  const getCssClass = (score) => {
    const level = getLevel(score)
    return LEVEL_CONFIG[level].cssClass
  }

  /**
   * 将可信度标签渲染到指定的 DOM 容器中
   * - 创建 span 元素，包含图标和标签文本
   * - 自动应用对应等级的 CSS 类名
   * @param {number} score - 置信度分数（0.0 ~ 1.0）
   * @param {HTMLElement} container - 目标容器元素
   */
  const render = (score, container) => {
    const logger = window.Logger

    if (!container || !(container instanceof HTMLElement)) {
      logger.error(MODULE, 'render: 无效的容器元素', { container })
      return
    }

    const level = getLevel(score)
    const config = LEVEL_CONFIG[level]

    logger.debug(MODULE, `渲染可信度标签: ${config.label} (score=${score})`)

    // 清空容器
    container.innerHTML = ''

    // 创建标签 span 元素
    const tag = document.createElement('span')
    tag.className = `credibility-tag ${config.cssClass}`
    tag.setAttribute(DATA_ATTR, 'true')
    tag.setAttribute('aria-label', config.label)
    tag.setAttribute('role', 'status')

    // 图标部分
    const icon = document.createElement('span')
    icon.className = 'credibility-icon'
    icon.textContent = config.icon
    icon.setAttribute('aria-hidden', 'true')

    // 标签文本部分
    const text = document.createElement('span')
    text.className = 'credibility-label'
    text.textContent = config.label

    // 组装并插入
    tag.appendChild(icon)
    tag.appendChild(text)
    container.appendChild(tag)

    logger.info(MODULE, `可信度标签已渲染: ${config.label}`)
  }

  /**
   * 更新已有的可信度标签元素
   * - 查找容器内的标签 span，更新其类名、图标和文本
   * - 如果未找到已有标签，则调用 render 重新创建
   * @param {HTMLElement} container - 包含标签的容器元素
   * @param {number} score - 新的置信度分数（0.0 ~ 1.0）
   */
  const update = (container, score) => {
    const logger = window.Logger

    if (!container || !(container instanceof HTMLElement)) {
      logger.error(MODULE, 'update: 无效的容器元素', { container })
      return
    }

    // 查找已有的标签元素
    const existingTag = container.querySelector(`[${DATA_ATTR}]`)

    if (!existingTag) {
      logger.warn(MODULE, 'update: 未找到已有标签，将重新渲染')
      render(score, container)
      return
    }

    const level = getLevel(score)
    const config = LEVEL_CONFIG[level]

    logger.debug(MODULE, `更新可信度标签: ${config.label} (score=${score})`)

    // 更新 CSS 类名
    existingTag.className = `credibility-tag ${config.cssClass}`

    // 更新图标
    const iconEl = existingTag.querySelector('.credibility-icon')
    if (iconEl) {
      iconEl.textContent = config.icon
    }

    // 更新文本
    const labelEl = existingTag.querySelector('.credibility-label')
    if (labelEl) {
      labelEl.textContent = config.label
    }

    // 更新 aria-label
    existingTag.setAttribute('aria-label', config.label)

    logger.info(MODULE, `可信度标签已更新: ${config.label}`)
  }

  // ==================== CredibilityTag 单例对象 ====================
  const CredibilityTag = {
    /** 等级阈值常量 */
    THRESHOLDS,

    /** 获取等级标识 */
    getLevel,

    /** 获取中文标签文本 */
    getLabel,

    /** 获取 CSS 类名 */
    getCssClass,

    /** 渲染标签到容器 */
    render,

    /** 更新已有标签 */
    update,
  }

  // ==================== 导出为全局单例 ====================
  window.CredibilityTag = CredibilityTag
})()
