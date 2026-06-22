/**
 * modal.js - Modal 对话框系统
 * 提供模态弹窗功能，支持自定义内容和预设弹窗
 * 动态创建DOM元素，无需在HTML中预先放置容器
 * 依赖：toast.js（反馈弹窗提交后使用Toast提示）
 */
;(function () {
  'use strict'

  // ========== 样式定义 ==========
  const STYLES = `
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 200;
      background-color: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      animation: modal-overlay-in 0.25s ease forwards;
    }
    .modal-overlay.modal-out {
      animation: modal-overlay-out 0.2s ease forwards;
    }
    .modal-dialog {
      background: #fff;
      border-radius: 12px;
      width: 90%;
      max-width: 420px;
      box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
      overflow: hidden;
      transform: scale(0.9);
      opacity: 0;
      animation: modal-dialog-in 0.25s ease forwards;
    }
    .modal-overlay.modal-out .modal-dialog {
      animation: modal-dialog-out 0.2s ease forwards;
    }
    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
    }
    .modal-close {
      width: 28px;
      height: 28px;
      border: none;
      background: none;
      font-size: 20px;
      color: #999;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.2s;
    }
    .modal-close:hover {
      background-color: #f5f5f5;
      color: #333;
    }
    .modal-body {
      padding: 20px;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      max-height: 60vh;
      overflow-y: auto;
    }
    .modal-body textarea {
      width: 100%;
      min-height: 100px;
      padding: 10px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      font-size: 14px;
      line-height: 1.6;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .modal-body textarea:focus {
      border-color: #1890ff;
    }
    .modal-body textarea::placeholder {
      color: #bfbfbf;
    }
    .modal-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 20px;
      border-top: 1px solid #f0f0f0;
    }
    .modal-btn {
      padding: 8px 20px;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      border: 1px solid #d9d9d9;
      background: #fff;
      color: #333;
      transition: all 0.2s;
    }
    .modal-btn:hover {
      border-color: #1890ff;
      color: #1890ff;
    }
    .modal-btn-primary {
      background: #1890ff;
      border-color: #1890ff;
      color: #fff;
    }
    .modal-btn-primary:hover {
      background: #40a9ff;
      border-color: #40a9ff;
      color: #fff;
    }
    .modal-btn-danger {
      background: #ff4d4f;
      border-color: #ff4d4f;
      color: #fff;
    }
    .modal-btn-danger:hover {
      background: #ff7875;
      border-color: #ff7875;
      color: #fff;
    }
    .modal-warning-text {
      color: #ff4d4f;
      font-weight: 500;
    }
    .modal-preview-area {
      background: #f9f9f9;
      border: 1px solid #e8e8e8;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 12px;
      font-size: 13px;
      line-height: 1.8;
      color: #555;
      word-break: break-all;
    }
    /* 动画 */
    @keyframes modal-overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes modal-overlay-out {
      from { opacity: 1; }
      to { opacity: 0; }
    }
    @keyframes modal-dialog-in {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes modal-dialog-out {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.9); }
    }
  `

  // ========== 状态管理 ==========
  let overlay = null       // 遮罩层DOM
  let currentResolve = null // 当前Promise的resolve函数
  let isShowing = false     // 是否正在显示

  /**
   * 初始化 - 注入样式
   */
  function init() {
    if (!document.getElementById('modal-styles')) {
      const styleEl = document.createElement('style')
      styleEl.id = 'modal-styles'
      styleEl.textContent = STYLES
      document.head.appendChild(styleEl)
    }
  }

  /**
   * 显示Modal对话框
   * @param {Object} options - 配置选项
   * @param {string} options.title - 标题
   * @param {string} options.content - 内容（支持HTML字符串）
   * @param {string} [options.confirmText='确定'] - 确认按钮文字
   * @param {string} [options.cancelText='取消'] - 取消按钮文字
   * @param {Function} [options.onConfirm] - 确认回调
   * @param {Function} [options.onCancel] - 取消回调
   * @param {boolean} [options.closable=true] - 是否可通过点击遮罩或ESC关闭
   * @returns {Promise<'confirm'|'cancel'>} 用户操作结果
   */
  function show(options = {}) {
    const {
      title = '',
      content = '',
      confirmText = '确定',
      cancelText = '取消',
      confirmClass = 'modal-btn-primary',
      onConfirm = null,
      onCancel = null,
      closable = true
    } = options

    // 如果已有弹窗，先关闭
    if (isShowing) {
      hide()
    }

    init()

    // 创建遮罩层
    overlay = document.createElement('div')
    overlay.className = 'modal-overlay'

    // 创建对话框
    const dialog = document.createElement('div')
    dialog.className = 'modal-dialog'

    // --- 头部 ---
    const header = document.createElement('div')
    header.className = 'modal-header'

    const titleEl = document.createElement('span')
    titleEl.textContent = title

    const closeBtn = document.createElement('button')
    closeBtn.className = 'modal-close'
    closeBtn.innerHTML = '&times;'
    closeBtn.addEventListener('click', () => {
      close('cancel', onCancel)
    })

    header.appendChild(titleEl)
    header.appendChild(closeBtn)

    // --- 内容区 ---
    const body = document.createElement('div')
    body.className = 'modal-body'
    body.innerHTML = content

    // --- 底部按钮 ---
    const footer = document.createElement('div')
    footer.className = 'modal-footer'

    const cancelBtn = document.createElement('button')
    cancelBtn.className = 'modal-btn'
    cancelBtn.textContent = cancelText
    cancelBtn.addEventListener('click', () => {
      close('cancel', onCancel)
    })

    const confirmBtn = document.createElement('button')
    confirmBtn.className = `modal-btn ${confirmClass}`
    confirmBtn.textContent = confirmText
    confirmBtn.addEventListener('click', () => {
      close('confirm', onConfirm)
    })

    footer.appendChild(cancelBtn)
    footer.appendChild(confirmBtn)

    // --- 组装 ---
    dialog.appendChild(header)
    dialog.appendChild(body)
    dialog.appendChild(footer)
    overlay.appendChild(dialog)

    // 点击遮罩关闭
    if (closable) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          close('cancel', onCancel)
        }
      })
    }

    // ESC键关闭
    const escHandler = (e) => {
      if (e.key === 'Escape' && isShowing) {
        close('cancel', onCancel)
      }
    }
    document.addEventListener('keydown', escHandler)
    overlay._escHandler = escHandler

    // 添加到页面
    document.body.appendChild(overlay)
    isShowing = true

    // 返回Promise
    return new Promise((resolve) => {
      currentResolve = resolve
    })
  }

  /**
   * 关闭Modal并触发回调
   * @param {'confirm'|'cancel'} action - 用户操作
   * @param {Function} callback - 对应的回调函数
   */
  function close(action, callback) {
    if (!overlay || !isShowing) return

    // 执行回调，如果返回 false 则阻止关闭
    if (typeof callback === 'function') {
      const result = callback()
      if (result === false) return
    }

    // 移除ESC监听
    if (overlay._escHandler) {
      document.removeEventListener('keydown', overlay._escHandler)
    }

    // 播放退出动画
    overlay.classList.add('modal-out')

    // 动画结束后移除DOM
    const removeOverlay = () => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay)
      }
      overlay = null
      isShowing = false
    }

    overlay.addEventListener('animationend', removeOverlay, { once: true })

    // 兜底移除
    setTimeout(removeOverlay, 250)

    // 解析Promise
    if (currentResolve) {
      currentResolve(action)
      currentResolve = null
    }
  }

  /**
   * 直接关闭当前Modal（无特定action）
   */
  function hide() {
    close('cancel', null)
  }

  // ========== 预设弹窗 ==========

  /**
   * M1 - 反馈弹窗
   * @param {string|number} resultId - 解读结果ID
   * @param {string} feedbackType - 反馈类型
   * @returns {Promise<'confirm'|'cancel'>}
   */
  function showFeedbackModal(resultId, feedbackType) {
    const content = `
      <div>
        <p style="margin-bottom: 12px; color: #666;">请详细描述你的反馈意见：</p>
        <textarea id="modal-feedback-textarea" placeholder="请输入反馈内容..." maxlength="500"></textarea>
        <input type="hidden" id="modal-feedback-id" value="${resultId}">
        <input type="hidden" id="modal-feedback-type" value="${feedbackType}">
      </div>
    `

    return show({
      title: '提交反馈',
      content,
      confirmText: '提交',
      cancelText: '取消',
      closable: true,
      onConfirm: () => {
        const textarea = document.getElementById('modal-feedback-textarea')
        const text = textarea ? textarea.value.trim() : ''
        if (!text) {
          // 反馈内容为空时提示，不关闭弹窗
          if (window.Toast) {
            window.Toast.show('请输入反馈内容', 'warning')
          }
          // 返回 false 阻止关闭（通过阻止默认行为）
          return false
        }
        // 保存反馈到 Store
        if (window.Store && typeof window.Store.addFeedback === 'function') {
          window.Store.addFeedback({
            resultId: resultId,
            type: feedbackType,
            detail: text,
            timestamp: new Date().toISOString(),
          })
        }
        if (window.Toast) {
          window.Toast.showPreset('T4')
        }
      }
    })
  }

  /**
   * M2 - 分享弹窗
   * @param {Object} resultData - 解读结果数据
   * @param {string} resultData.original_text - 原始文本
   * @param {string} resultData.interpretation - 解读内容
   * @returns {Promise<'confirm'|'cancel'>}
   */
  function showShareModal(resultData) {
    const safeText = (resultData && resultData.original_text) ? resultData.original_text : ''
    const safeInterpretation = (resultData && resultData.interpretation) ? resultData.interpretation : ''

    const content = `
      <div>
        <div class="modal-preview-area">
          <div style="margin-bottom: 8px;">
            <strong style="color: #1890ff;">原文：</strong>
            <span>${safeText}</span>
          </div>
          <div>
            <strong style="color: #1890ff;">懂非懂解读：</strong>
            <span>${safeInterpretation}</span>
          </div>
        </div>
      </div>
    `

    // 自定义底部按钮：保存图片 + 复制文本
    return show({
      title: '分享知识卡片',
      content,
      confirmText: '复制文本',
      cancelText: '取消',
      closable: true,
      onConfirm: () => {
        // 复制到剪贴板
        const copyText = `【懂非懂】\n原文：${safeText}\n解读：${safeInterpretation}`
        if (navigator.clipboard) {
          navigator.clipboard.writeText(copyText).then(() => {
            if (window.Toast) {
              window.Toast.show('已复制到剪贴板', 'success')
            }
          }).catch(() => {
            fallbackCopy(copyText)
          })
        } else {
          fallbackCopy(copyText)
        }
      }
    }).then((action) => {
      // 如果用户点击了取消，不做额外操作
      return action
    })
  }

  /**
   * 复制文本的降级方案（兼容旧浏览器）
   * @param {string} text - 要复制的文本
   */
  function fallbackCopy(text) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      document.execCommand('copy')
      if (window.Toast) {
        window.Toast.show('已复制到剪贴板', 'success')
      }
    } catch (e) {
      if (window.Toast) {
        window.Toast.show('复制失败，请手动复制', 'error')
      }
    }
    document.body.removeChild(textarea)
  }

  /**
   * M3 - 确认清空弹窗
   * @param {string} itemType - 要清空的项目类型（如 '收藏'、'历史'）
   * @returns {Promise<'confirm'|'cancel'>}
   */
  function showConfirmClearModal(itemType) {
    const content = `
      <div>
        <p class="modal-warning-text">此操作不可撤销，确定要清空所有${itemType}吗？</p>
      </div>
    `

    return show({
      title: '确认清空',
      content,
      confirmText: '清空',
      cancelText: '取消',
      confirmClass: 'modal-btn-danger',
      closable: true,
      onConfirm: () => {
        // TODO: 调用清空API
        if (window.Toast) {
          window.Toast.show(`已清空所有${itemType}`, 'success')
        }
      }
    })
  }

  // ========== 导出 ==========
  const Modal = {
    show,
    hide,
    showFeedbackModal,
    showShareModal,
    showConfirmClearModal
  }

  window.Modal = Modal
})()
