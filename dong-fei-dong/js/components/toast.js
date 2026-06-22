/**
 * toast.js - Toast 通知系统
 * 提供轻量级的消息提示功能，支持多种类型和预设消息
 * 动态创建DOM元素，无需在HTML中预先放置容器
 */
;(function () {
  'use strict'

  // ========== 样式定义 ==========
  const STYLES = `
    .toast-container {
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 300;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      max-width: 90vw;
    }
    .toast-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.5;
      color: #fff;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      opacity: 0;
      transform: translateY(-20px);
      animation: toast-in 0.3s ease forwards;
      white-space: nowrap;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .toast-item.toast-out {
      animation: toast-out 0.3s ease forwards;
    }
    .toast-icon {
      flex-shrink: 0;
      width: 18px;
      height: 18px;
      line-height: 18px;
      text-align: center;
      font-size: 14px;
    }
    .toast-message {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* 类型颜色 */
    .toast-success { background-color: #52c41a; }
    .toast-error { background-color: #ff4d4f; }
    .toast-warning { background-color: #faad14; color: #5c3d00; }
    .toast-info { background-color: #1890ff; }
    /* 动画 */
    @keyframes toast-in {
      from { opacity: 0; transform: translateY(-20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes toast-out {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(-20px); }
    }
  `

  // ========== 图标映射 ==========
  const ICONS = {
    success: '\u2713',   // ✓
    error: '\u2717',     // ✗
    warning: '\u26A0',   // ⚠
    info: '\u2139'       // ℹ
  }

  // ========== 预设消息 ==========
  const PRESETS = {
    T1:  { message: '解读完成', type: 'success' },
    T2:  { message: '已添加到收藏', type: 'success' },
    T3:  { message: '已取消收藏', type: 'info' },
    T4:  { message: '反馈已提交，感谢你的帮助', type: 'success' },
    T5:  { message: '已提交，我们会尽快核实', type: 'success' },
    T6:  { message: '网络连接异常，请检查网络', type: 'error' },
    T7:  { message: '当前仅支持简体中文内容', type: 'warning' },
    T8:  { message: '输入内容至少需要10个字符', type: 'warning' },
    T9:  { message: '请求过于频繁，请稍后再试', type: 'warning' },
    T10: { message: '服务暂时不可用，请稍后重试', type: 'error' }
  }

  // ========== 状态管理 ==========
  const MAX_VISIBLE = 3   // 最多同时显示3个toast
  let container = null     // 容器DOM元素
  let activeToasts = []    // 当前活跃的toast列表

  /**
   * 初始化 - 创建样式和容器元素
   */
  function init() {
    // 注入样式
    if (!document.getElementById('toast-styles')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'toast-styles'
      styleEl.textContent = STYLES
      document.head.appendChild(styleEl)
    }

    // 创建容器
    if (!container) {
      container = document.createElement('div')
      container.className = 'toast-container'
      document.body.appendChild(container)
    }
  }

  /**
   * 移除多余的toast，保持不超过最大显示数量
   */
  function trimToasts() {
    while (activeToasts.length > MAX_VISIBLE) {
      const oldest = activeToasts.shift()
      hide(oldest)
    }
  }

  /**
   * 显示Toast通知
   * @param {string} message - 通知消息内容
   * @param {string} type - 通知类型：success | error | warning | info，默认info
   * @param {number} duration - 自动关闭时间（毫秒），默认3000ms，0表示不自动关闭
   * @returns {HTMLElement} toast元素
   */
  function show(message, type = 'info', duration = 3000) {
    init()

    // 创建toast元素
    const toastEl = document.createElement('div')
    toastEl.className = `toast-item toast-${type}`

    // 图标
    const iconEl = document.createElement('span')
    iconEl.className = 'toast-icon'
    iconEl.textContent = ICONS[type] || ICONS.info

    // 消息内容
    const msgEl = document.createElement('span')
    msgEl.className = 'toast-message'
    msgEl.textContent = message

    toastEl.appendChild(iconEl)
    toastEl.appendChild(msgEl)
    container.appendChild(toastEl)

    // 加入活跃列表
    activeToasts.push(toastEl)
    trimToasts()

    // 自动关闭定时器
    let timer = null
    if (duration > 0) {
      timer = setTimeout(() => {
        hide(toastEl)
      }, duration)
    }

    // 存储定时器引用，手动关闭时清除
    toastEl._toastTimer = timer

    return toastEl
  }

  /**
   * 手动隐藏Toast
   * @param {HTMLElement} toastElement - 要隐藏的toast元素
   */
  function hide(toastElement) {
    if (!toastElement) return

    // 清除自动关闭定时器
    if (toastElement._toastTimer) {
      clearTimeout(toastElement._toastTimer)
      toastElement._toastTimer = null
    }

    // 添加退出动画
    toastElement.classList.add('toast-out')

    // 动画结束后移除DOM
    toastElement.addEventListener('animationend', () => {
      if (toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement)
      }
      // 从活跃列表中移除
      const index = activeToasts.indexOf(toastElement)
      if (index > -1) {
        activeToasts.splice(index, 1)
      }
    }, { once: true })

    // 兜底：如果动画事件未触发，300ms后强制移除
    setTimeout(() => {
      if (toastElement.parentNode) {
        toastElement.parentNode.removeChild(toastElement)
      }
    }, 350)
  }

  /**
   * 显示预设Toast消息
   * @param {string} presetKey - 预设键名（T1~T10）
   * @returns {HTMLElement} toast元素
   */
  function showPreset(presetKey) {
    const preset = PRESETS[presetKey]
    if (!preset) {
      console.warn(`[Toast] 未知的预设键: ${presetKey}`)
      return show('未知提示', 'info')
    }
    return show(preset.message, preset.type)
  }

  // ========== 导出 ==========
  const Toast = {
    show,
    hide,
    showPreset,
    // 暴露预设常量供外部引用
    PRESETS
  }

  window.Toast = Toast
})()
