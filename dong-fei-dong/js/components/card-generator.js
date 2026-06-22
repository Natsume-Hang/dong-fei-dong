/**
 * card-generator.js - 懂非懂 (DongFeiDong) 知识卡片生成器
 *
 * 基于 IIFE 单例模式，将 AI 解读结果生成为可分享的知识卡片图片。
 * 优先使用 html2canvas 截图为 PNG 图片下载，降级为纯文本复制到剪贴板。
 *
 * 功能：
 *   - generateCard(resultData)  : 根据解读数据生成卡片 DOM 元素（离屏）
 *   - captureAsImage(cardEl)   : 使用 html2canvas 将卡片 DOM 截图为图片
 *   - captureAsText(resultData) : 生成纯文本摘要用于剪贴板复制
 *   - share(resultData)        : 主入口，依次尝试图片导出 → 文本复制
 *
 * 依赖：
 *   - window.Logger   (日志)
 *   - window.Modal    (分享弹窗，可选)
 *   - window.Toast    (消息提示)
 *   - window.Helpers  (工具函数：generateId, truncateText, escapeHtml)
 *   - html2canvas CDN (可选，加载失败时自动降级)
 *
 * 导出: window.CardGenerator
 */

;(function () {
  'use strict'

  // ==================== 常量定义 ====================

  /** 模块标识，用于日志输出 */
  var MODULE = 'CardGenerator'

  /** html2canvas CDN 地址 */
  var HTML2CANVAS_CDN = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'

  /** 卡片样式常量 */
  var CARD = Object.freeze({
    WIDTH: 375,
    PADDING: 24,
    BACKGROUND: '#F7F5F0',
    ACCENT: '#B85C38',
    INK: '#2C2A26',
    MUTED: '#8A857C',
    RULE: '#D4CFC6',
    BORDER_RADIUS: 12,
    FONT_FAMILY: "'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif",
    FONT_SERIF: "'Noto Serif SC', 'STSong', 'Songti SC', serif",
  })

  /** 可信度等级对应的颜色与标签 */
  var CREDIBILITY_MAP = Object.freeze({
    '高': { color: '#27AE60', label: '高可信度' },
    '中等': { color: '#E67E22', label: '中等可信度' },
    '低': { color: '#C0392B', label: '仅供参考' },
  })

  // ==================== 依赖引用 ====================

  var logger = window.Logger || null
  var modal = window.Modal || null
  var toast = window.Toast || null
  var helpers = window.Helpers || {}

  var generateId = helpers.generateId || function () { return 'card_' + Date.now() }
  var truncateText = helpers.truncateText || function (text, max) { return text ? text.substring(0, max) : '' }
  var escapeHtml = helpers.escapeHtml || function (str) { return str || '' }

  // ==================== 内部工具函数 ====================

  /**
   * 获取当前日期字符串（YYYY-MM-DD 格式）
   * @returns {string}
   */
  function getDateString() {
    var now = new Date()
    var y = now.getFullYear()
    var m = String(now.getMonth() + 1).padStart(2, '0')
    var d = String(now.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  }

  /**
   * 获取可信度配置
   * @param {string} credibility - 可信度等级（高/中等/低）
   * @returns {{ color: string, label: string }}
   */
  function getCredibilityConfig(credibility) {
    return CREDIBILITY_MAP[credibility] || CREDIBILITY_MAP['低']
  }

  /**
   * 动态加载 html2canvas 脚本
   * 如果全局已存在 html2canvas，直接返回
   * @returns {Promise<boolean>} 是否加载成功
   */
  function loadHtml2Canvas() {
    // 已加载，直接返回
    if (typeof window.html2canvas === 'function') {
      return Promise.resolve(true)
    }

    return new Promise(function (resolve) {
      var script = document.createElement('script')
      script.src = HTML2CANVAS_CDN
      script.async = true
      script.onload = function () {
        if (typeof window.html2canvas === 'function') {
          logger && logger.info(MODULE, 'html2canvas 加载成功')
          resolve(true)
        } else {
          logger && logger.warn(MODULE, 'html2canvas 脚本加载后全局对象不可用')
          resolve(false)
        }
      }
      script.onerror = function () {
        logger && logger.warn(MODULE, 'html2canvas CDN 加载失败，将降级为文本复制')
        resolve(false)
      }
      document.head.appendChild(script)
    })
  }

  /**
   * 将文本复制到剪贴板（含降级方案）
   * @param {string} text - 要复制的文本
   * @returns {Promise<boolean>} 是否复制成功
   */
  function copyToClipboard(text) {
    // 优先使用 Clipboard API
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text)
        .then(function () { return true })
        .catch(function () {
          return fallbackCopy(text)
        })
    }
    return Promise.resolve(fallbackCopy(text))
  }

  /**
   * 降级复制方案（兼容旧浏览器）
   * @param {string} text - 要复制的文本
   * @returns {boolean} 是否成功
   */
  function fallbackCopy(text) {
    var textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)
    textarea.select()
    var success = false
    try {
      success = document.execCommand('copy')
    } catch (e) {
      success = false
    }
    document.body.removeChild(textarea)
    return success
  }

  /**
   * 触发浏览器下载
   * @param {string} dataUrl - 图片的 data URL
   * @param {string} filename - 文件名
   */
  function triggerDownload(dataUrl, filename) {
    var link = document.createElement('a')
    link.href = dataUrl
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    // 延迟移除，确保下载触发
    setTimeout(function () {
      document.body.removeChild(link)
    }, 100)
  }

  // ==================== 核心方法 ====================

  /**
   * 生成知识卡片 DOM 元素（离屏）
   * 使用纯内联样式，确保 html2canvas 截图时样式完整
   *
   * @param {Object} resultData - 解读结果数据
   * @param {string} resultData.allusion_title - 典故标题
   * @param {string} resultData.source - 出处信息
   * @param {string} resultData.original_text - 原文内容
   * @param {string} resultData.interpretation - 解读内容
   * @param {string} resultData.credibility - 可信度（高/中等/低）
   * @returns {HTMLElement} 卡片 DOM 元素
   */
  function generateCard(resultData) {
    logger && logger.debug(MODULE, '开始生成知识卡片', resultData)

    var cardId = generateId('card_')
    var title = escapeHtml(resultData.allusion_title || '未知典故')
    var source = escapeHtml(resultData.source || '出处不详')
    var originalText = escapeHtml(truncateText(resultData.original_text || '', 100))
    var interpretation = escapeHtml(truncateText(resultData.interpretation || '', 200))
    var credibility = resultData.credibility || '低'
    var credConfig = getCredibilityConfig(credibility)
    var dateStr = getDateString()

    // ---- 创建卡片容器 ----
    var card = document.createElement('div')
    card.id = cardId
    card.style.cssText = [
      'width: ' + CARD.WIDTH + 'px',
      'background: ' + CARD.BACKGROUND,
      'border-radius: ' + CARD.BORDER_RADIUS + 'px',
      'padding: ' + CARD.PADDING + 'px',
      'box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.06)',
      'font-family: ' + CARD.FONT_FAMILY,
      'color: ' + CARD.INK,
      'box-sizing: border-box',
      'position: absolute',
      'left: -9999px',
      'top: 0',
      'overflow: hidden',
    ].join('; ')

    // ---- 品牌头部 ----
    var header = document.createElement('div')
    header.style.cssText = [
      'text-align: center',
      'margin-bottom: 16px',
      'padding-bottom: 12px',
      'border-bottom: 1px solid ' + CARD.RULE,
    ].join('; ')

    var brandTitle = document.createElement('div')
    brandTitle.style.cssText = [
      'font-size: 22px',
      'font-weight: 700',
      'color: ' + CARD.ACCENT,
      'letter-spacing: 4px',
      'margin-bottom: 4px',
    ].join('; ')
    brandTitle.textContent = '懂非懂'

    var brandTagline = document.createElement('div')
    brandTagline.style.cssText = [
      'font-size: 11px',
      'color: ' + CARD.MUTED,
      'letter-spacing: 1px',
    ].join('; ')
    brandTagline.textContent = 'AI 典故解读助手'

    header.appendChild(brandTitle)
    header.appendChild(brandTagline)

    // ---- 典故标题 ----
    var titleEl = document.createElement('div')
    titleEl.style.cssText = [
      'font-size: 20px',
      'font-weight: 600',
      'color: ' + CARD.INK,
      'margin-bottom: 8px',
      'line-height: 1.4',
    ].join('; ')
    titleEl.textContent = title

    // ---- 出处信息 ----
    var sourceEl = document.createElement('div')
    sourceEl.style.cssText = [
      'font-size: 12px',
      'color: ' + CARD.MUTED,
      'margin-bottom: 12px',
    ].join('; ')
    sourceEl.textContent = '出处：' + source

    // ---- 分隔线 ----
    var divider1 = document.createElement('div')
    divider1.style.cssText = [
      'height: 1px',
      'background: ' + CARD.RULE,
      'margin-bottom: 12px',
    ].join('; ')

    // ---- 原文引用 ----
    var originalSection = document.createElement('div')
    originalSection.style.cssText = [
      'margin-bottom: 12px',
    ].join('; ')

    var originalLabel = document.createElement('div')
    originalLabel.style.cssText = [
      'font-size: 11px',
      'font-weight: 600',
      'color: ' + CARD.ACCENT,
      'margin-bottom: 4px',
      'letter-spacing: 1px',
    ].join('; ')
    originalLabel.textContent = '原文'

    var originalContent = document.createElement('div')
    originalContent.style.cssText = [
      'font-size: 14px',
      'line-height: 1.8',
      'color: ' + CARD.INK,
      'font-family: ' + CARD.FONT_SERIF,
      'padding: 8px 12px',
      'background: rgba(184, 92, 56, 0.06)',
      'border-left: 3px solid ' + CARD.ACCENT,
      'border-radius: 0 4px 4px 0',
    ].join('; ')
    originalContent.textContent = originalText

    originalSection.appendChild(originalLabel)
    originalSection.appendChild(originalContent)

    // ---- 解读内容 ----
    var interpSection = document.createElement('div')
    interpSection.style.cssText = [
      'margin-bottom: 12px',
    ].join('; ')

    var interpLabel = document.createElement('div')
    interpLabel.style.cssText = [
      'font-size: 11px',
      'font-weight: 600',
      'color: ' + CARD.ACCENT,
      'margin-bottom: 4px',
      'letter-spacing: 1px',
    ].join('; ')
    interpLabel.textContent = '解读'

    var interpContent = document.createElement('div')
    interpContent.style.cssText = [
      'font-size: 14px',
      'line-height: 1.8',
      'color: ' + CARD.INK,
    ].join('; ')
    interpContent.textContent = interpretation

    interpSection.appendChild(interpLabel)
    interpSection.appendChild(interpContent)

    // ---- 可信度标签 ----
    var badge = document.createElement('div')
    badge.style.cssText = [
      'display: inline-block',
      'padding: 3px 10px',
      'border-radius: 10px',
      'font-size: 11px',
      'font-weight: 500',
      'color: #fff',
      'background: ' + credConfig.color,
      'margin-bottom: 12px',
    ].join('; ')
    badge.textContent = credConfig.label

    // ---- 分隔线 ----
    var divider2 = document.createElement('div')
    divider2.style.cssText = [
      'height: 1px',
      'background: ' + CARD.RULE,
      'margin-bottom: 10px',
    ].join('; ')

    // ---- 底部 ----
    var footer = document.createElement('div')
    footer.style.cssText = [
      'display: flex',
      'justify-content: space-between',
      'align-items: center',
      'font-size: 10px',
      'color: ' + CARD.MUTED,
    ].join('; ')

    var footerDate = document.createElement('span')
    footerDate.textContent = dateStr

    var footerBrand = document.createElement('span')
    footerBrand.textContent = '懂非懂 · 你好像懂了，又好像没懂'

    footer.appendChild(footerDate)
    footer.appendChild(footerBrand)

    // ---- 组装卡片 ----
    card.appendChild(header)
    card.appendChild(titleEl)
    card.appendChild(sourceEl)
    card.appendChild(divider1)
    card.appendChild(originalSection)
    card.appendChild(interpSection)
    card.appendChild(badge)
    card.appendChild(divider2)
    card.appendChild(footer)

    logger && logger.info(MODULE, '知识卡片 DOM 已生成', { cardId: cardId })
    return card
  }

  /**
   * 使用 html2canvas 将卡片 DOM 截图为图片并下载
   * 如果 html2canvas 不可用，返回 null 表示截图失败
   *
   * @param {HTMLElement} cardElement - 卡片 DOM 元素
   * @param {string} allusionTitle - 典故标题（用于文件名）
   * @returns {Promise<string|null>} 成功返回 data URL，失败返回 null
   */
  function captureAsImage(cardElement, allusionTitle) {
    logger && logger.debug(MODULE, '尝试截图为图片')

    return loadHtml2Canvas().then(function (loaded) {
      if (!loaded) {
        logger && logger.warn(MODULE, 'html2canvas 不可用，截图失败')
        return null
      }

      return window.html2canvas(cardElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: CARD.BACKGROUND,
        logging: false,
      }).then(function (canvas) {
        var dataUrl = canvas.toDataURL('image/png')
        var safeTitle = (allusionTitle || '未知').replace(/[\\/:*?"<>|]/g, '_')
        var filename = '懂非懂_' + safeTitle + '_' + getDateString() + '.png'
        triggerDownload(dataUrl, filename)
        logger && logger.info(MODULE, '卡片图片已下载', { filename: filename })
        return dataUrl
      }).catch(function (err) {
        logger && logger.warn(MODULE, 'html2canvas 截图异常', err)
        return null
      })
    })
  }

  /**
   * 生成纯文本摘要用于剪贴板复制
   *
   * @param {Object} resultData - 解读结果数据
   * @returns {string} 格式化的纯文本摘要
   */
  function captureAsText(resultData) {
    logger && logger.debug(MODULE, '生成纯文本摘要')

    var title = resultData.allusion_title || '未知典故'
    var source = resultData.source || '出处不详'
    var originalText = resultData.original_text || ''
    var interpretation = resultData.interpretation || ''

    var lines = []
    lines.push('【标题】' + title)
    lines.push('【出处】' + source)
    lines.push('【原文】' + originalText)
    lines.push('【解读】' + interpretation)
    lines.push('——懂非懂')

    var text = lines.join('\n')
    logger && logger.info(MODULE, '纯文本摘要已生成', { length: text.length })
    return text
  }

  /**
   * 分享入口 - 生成卡片并导出
   * 优先尝试截图下载，失败后降级为文本复制到剪贴板
   *
   * @param {Object} resultData - 解读结果数据
   * @returns {Promise<{method: string, success: boolean}>} 分享结果
   */
  function share(resultData) {
    logger && logger.info(MODULE, '开始分享流程')

    var cardElement = null

    return new Promise(function (resolve) {
      try {
        // 1. 生成卡片 DOM
        cardElement = generateCard(resultData)

        // 2. 添加到页面（离屏）
        document.body.appendChild(cardElement)

        // 3. 尝试截图下载
        var allusionTitle = resultData.allusion_title || '未知典故'

        captureAsImage(cardElement, allusionTitle).then(function (dataUrl) {
          // 清理卡片 DOM
          if (cardElement && cardElement.parentNode) {
            cardElement.parentNode.removeChild(cardElement)
            cardElement = null
          }

          if (dataUrl) {
            // 截图成功
            toast && toast.show('卡片图片已保存', 'success')
            resolve({ method: 'image', success: true })
          } else {
            // 截图失败，降级为文本复制
            fallbackToTextCopy(resultData, resolve)
          }
        }).catch(function (err) {
          // 截图过程异常，清理并降级
          logger && logger.warn(MODULE, '截图流程异常，降级为文本复制', err)
          if (cardElement && cardElement.parentNode) {
            cardElement.parentNode.removeChild(cardElement)
            cardElement = null
          }
          fallbackToTextCopy(resultData, resolve)
        })

      } catch (err) {
        // 整体异常处理
        logger && logger.error(MODULE, '分享流程异常', err)

        // 确保清理 DOM
        if (cardElement && cardElement.parentNode) {
          cardElement.parentNode.removeChild(cardElement)
        }

        toast && toast.show('分享失败，请稍后重试', 'error')
        resolve({ method: 'none', success: false })
      }
    })
  }

  /**
   * 降级方案：复制纯文本到剪贴板
   * @param {Object} resultData - 解读结果数据
   * @param {Function} resolve - Promise resolve 回调
   */
  function fallbackToTextCopy(resultData, resolve) {
    var text = captureAsText(resultData)

    copyToClipboard(text).then(function (success) {
      if (success) {
        toast && toast.show('已复制到剪贴板', 'success')
        resolve({ method: 'text', success: true })
      } else {
        logger && logger.warn(MODULE, '剪贴板复制失败')
        toast && toast.show('复制失败，请手动复制', 'error')
        resolve({ method: 'text', success: false })
      }
    }).catch(function (err) {
      logger && logger.error(MODULE, '剪贴板操作异常', err)
      toast && toast.show('复制失败，请手动复制', 'error')
      resolve({ method: 'text', success: false })
    })
  }

  // ==================== CardGenerator 单例对象 ====================
  var CardGenerator = {
    /** 生成知识卡片 DOM 元素 */
    generateCard: generateCard,

    /** 截图卡片为图片 */
    captureAsImage: captureAsImage,

    /** 生成纯文本摘要 */
    captureAsText: captureAsText,

    /** 分享入口 */
    share: share,
  }

  // ==================== 导出为全局单例 ====================
  window.CardGenerator = CardGenerator
})()
