/**
 * history.js - 懂非懂 (DongFeiDong) 历史记录页模块
 *
 * 基于 IIFE + PageObject 模式，负责历史记录列表的展示与交互：
 * 1. 从 Store 加载历史记录并渲染列表
 * 2. 点击条目跳转到结果页（使用缓存数据或重新解读）
 * 3. 清空全部（带确认弹窗 M3）
 * 4. 长按删除单条记录
 *
 * 依赖: window.Logger, window.Store, window.Router, window.Toast, window.Modal
 *       window.DFDState
 * 导出: window.DFDPages.history
 */

;(function () {
  'use strict'

  // ==================== PageObject 基类 ====================

  class PageObject {
    constructor(containerSelector) {
      this.container = document.querySelector(containerSelector)
      if (!this.container) {
        console.warn(`[PO] 页面容器未找到: ${containerSelector}`)
      }
    }
    $(selector) { return this.container ? this.container.querySelector(selector) : null }
    $$(selector) { return this.container ? this.container.querySelectorAll(selector) : null }
    onShow() {}
    onHide() {}
  }

  // ==================== 常量定义 ====================

  /** 文本截断长度 */
  const TRUNCATE_LENGTH = 30

  /** 长按触发时间阈值（毫秒） */
  const LONG_PRESS_DURATION = 800

  /** Modal 确认弹窗编号 */
  const MODAL_CLEAR_HISTORY = 'M3'

  // ==================== HistoryPage 类 ====================

  class HistoryPage extends PageObject {
    constructor() {
      super('#page-history')

      // 缓存 DOM 元素引用
      this.historyList = this.$('#history-list')
      this.historyEmpty = this.$('#history-empty')
      this.btnClearHistory = this.$('#btn-clear-history')
      this.filterContainer = this.$('#filter-chips')
      this.currentFilter = '全部'

      // 长按相关状态
      this._longPressTimer = null
      this._longPressTarget = null

      // 绑定事件
      this._bindEvents()
    }

    // ---- 生命周期 ----

    /**
     * 页面显示时：加载历史记录并渲染
     */
    onShow() {
      const logger = window.Logger
      logger && logger.info('HistoryPage', '页面显示')

      this._renderFilterChips()
      this._loadAndRender()
    }

    /**
     * 页面隐藏时的清理逻辑
     */
    onHide() {
      const logger = window.Logger
      logger && logger.debug('HistoryPage', '页面隐藏')

      // 清除可能残留的长按定时器
      this._clearLongPressTimer()
    }

    // ---- 事件绑定 ----

    /**
     * 绑定所有 DOM 事件
     */
    _bindEvents() {
      // 清空全部按钮
      if (this.btnClearHistory) {
        this.btnClearHistory.addEventListener('click', () => {
          this._onClearAllClick()
        })
      }
    }

    // ---- 数据加载与渲染 ----

    /**
     * 渲染类型筛选 chips
     */
    _renderFilterChips() {
      if (!this.filterContainer) return

      const types = ['全部', '歌词', '书摘', '角色名', '典故', '通用']
      this.filterContainer.innerHTML = ''

      types.forEach((type) => {
        const chip = document.createElement('span')
        chip.className = 'type-chip' + (type === this.currentFilter ? ' active' : '')
        chip.textContent = type
        chip.addEventListener('click', () => {
          this.currentFilter = type
          this._renderFilterChips()
          this._loadAndRender()
        })
        this.filterContainer.appendChild(chip)
      })
    }

    /**
     * 从 Store 加载历史记录并渲染列表
     */
    _loadAndRender() {
      const store = window.Store
      const logger = window.Logger

      if (!store || !this.historyList) return

      try {
        const history = store.getHistory()
        logger && logger.debug('HistoryPage', `加载历史记录: ${history.length} 条`)

        // 按类型筛选
        let items = history
        if (this.currentFilter !== '全部') {
          items = items.filter(item => item.inputType === this.currentFilter)
        }

        // 清空列表
        this.historyList.innerHTML = ''

        if (history.length === 0) {
          // 显示空状态插图
          if (this.historyEmpty) {
            var illustrations = window.Illustrations
            this.historyEmpty.innerHTML = illustrations
              ? illustrations.empty('暂无历史记录，去解读一些有趣的典故吧')
              : '<p>暂无历史记录</p><p class="empty-hint">去首页解读一段文本吧</p>'
            this.historyEmpty.style.display = ''
          }
          return
        }

        // 隐藏空状态
        if (this.historyEmpty) this.historyEmpty.style.display = 'none'

        // 渲染每条记录
        items.forEach((item) => {
          const el = this._createHistoryItem(item)
          if (el) {
            this.historyList.appendChild(el)
          }
        })

      } catch (err) {
        logger && logger.error('HistoryPage', '加载历史记录失败', err.message)
        if (this.historyEmpty) {
          var illustrations = window.Illustrations
          this.historyEmpty.innerHTML = illustrations
            ? illustrations.empty('加载历史记录失败，请稍后重试')
            : '<p>暂无历史记录</p><p class="empty-hint">去首页解读一段文本吧</p>'
          this.historyEmpty.style.display = ''
        }
      }
    }

    /**
     * 创建单条历史记录 DOM 元素
     * @param {object} item - 历史记录项
     * @returns {HTMLElement}
     */
    _createHistoryItem(item) {
      const logger = window.Logger

      try {
        const el = document.createElement('div')
        el.className = 'history-item'
        el.dataset.id = item.id || ''

        // 截断输入文本
        const truncatedText = (item.inputText || '').length > TRUNCATE_LENGTH
          ? (item.inputText || '').slice(0, TRUNCATE_LENGTH) + '...'
          : (item.inputText || '')

        // 类型标签
        const typeTag = item.inputType || '通用'

        // 可信度标签
        const credibility = item.credibility || '中等'

        // 时间戳格式化
        const timeStr = this._formatTimestamp(item.timestamp)

        // 构建内容
        el.innerHTML = `
          <div class="history-item-content">
            <p class="history-item-text">${this._escapeHtml(truncatedText)}</p>
            <div class="history-item-meta">
              <span class="history-item-type">${this._escapeHtml(typeTag)}</span>
              <span class="history-item-credibility">${this._escapeHtml(credibility)}</span>
              <span class="history-item-time">${this._escapeHtml(timeStr)}</span>
            </div>
          </div>
          <div class="history-item-delete" style="display:none">
            <button class="btn btn-danger btn-sm btn-delete-item">删除</button>
          </div>
        `

        // 点击跳转到结果页
        el.addEventListener('click', (e) => {
          // 如果点击的是删除按钮，不跳转
          if (e.target.closest('.btn-delete-item')) return
          this._onItemClick(item)
        })

        // 长按显示删除选项
        el.addEventListener('touchstart', (e) => {
          this._startLongPress(el, e)
        }, { passive: true })

        el.addEventListener('touchend', () => {
          this._clearLongPressTimer()
        })

        el.addEventListener('touchmove', () => {
          this._clearLongPressTimer()
        })

        // 桌面端长按（mousedown + mouseup）
        el.addEventListener('mousedown', (e) => {
          this._startLongPress(el, e)
        })

        el.addEventListener('mouseup', () => {
          this._clearLongPressTimer()
        })

        el.addEventListener('mouseleave', () => {
          this._clearLongPressTimer()
        })

        // 删除按钮事件
        const deleteBtn = el.querySelector('.btn-delete-item')
        if (deleteBtn) {
          deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this._onDeleteItemClick(item.id, el)
          })
        }

        return el
      } catch (err) {
        logger && logger.error('HistoryPage', '创建历史记录元素失败', err.message)
        return null
      }
    }

    // ---- 交互处理 ----

    /**
     * 历史条目点击回调：跳转到结果页
     * @param {object} item - 历史记录项
     */
    _onItemClick(item) {
      const logger = window.Logger
      logger && logger.info('HistoryPage', '点击历史记录', { id: item.id })

      // 将数据写入临时状态，跳转到结果页
      window.DFDState = window.DFDState || {}
      window.DFDState.inputText = item.inputText || ''
      window.DFDState.inputType = item.inputType || '通用'
      window.DFDState.resultData = item.resultData || null

      window.Router.navigate('result')
    }

    /**
     * 清空全部按钮回调
     */
    _onClearAllClick() {
      const logger = window.Logger
      const modal = window.Modal

      if (modal && typeof modal.showConfirmClearModal === 'function') {
        modal.showConfirmClearModal('历史记录').then((action) => {
          if (action === 'confirm') {
            this._clearAllHistory()
          }
        })
      } else if (modal && typeof modal.show === 'function') {
        // 兼容旧版 Modal 接口
        modal.show({
          title: '确认清空',
          content: '<p class="modal-warning-text">确定要清空所有历史记录吗？此操作不可撤销。</p>',
          confirmText: '清空',
          cancelText: '取消',
          confirmClass: 'modal-btn-danger',
          closable: true,
          onConfirm: () => {
            this._clearAllHistory()
          },
        })
      } else {
        // Modal 不可用时直接执行清空（降级方案）
        logger && logger.warn('HistoryPage', 'Modal 模块不可用，直接执行清空')
        this._clearAllHistory()
      }
    }

    /**
     * 执行清空历史记录
     */
    _clearAllHistory() {
      const store = window.Store
      const logger = window.Logger

      if (store) {
        store.clear('history')
        logger && logger.info('HistoryPage', '历史记录已清空')
      }

      // 重新渲染
      this._loadAndRender()

      // 显示提示
      if (window.Toast) {
        window.Toast.show('历史记录已清空')
      }
    }

    /**
     * 删除单条历史记录
     * @param {string} id - 记录 ID
     * @param {HTMLElement} el - 对应的 DOM 元素
     */
    _onDeleteItemClick(id, el) {
      const store = window.Store
      const logger = window.Logger

      if (!store || !id) return

      try {
          // 从历史数组中移除该条记录，通过 set 写回
          const history = store.getHistory()
          const filtered = history.filter((item) => item.id !== id)
          store.set('history', filtered)

        // 从 DOM 中移除
        if (el && el.parentNode) {
          el.parentNode.removeChild(el)
        }

        // 检查是否需要显示空状态
        const remaining = store.getHistory()
        if (remaining.length === 0 && this.historyEmpty) {
          this.historyEmpty.style.display = ''
        }

        logger && logger.info('HistoryPage', '已删除历史记录', id)

        if (window.Toast) {
          window.Toast.show('已删除')
        }
      } catch (err) {
        logger && logger.error('HistoryPage', '删除历史记录失败', err.message)
      }
    }

    // ---- 长按处理 ----

    /**
     * 开始长按计时
     * @param {HTMLElement} el - 目标元素
     * @param {Event} e - 事件对象
     */
    _startLongPress(el, e) {
      this._clearLongPressTimer()
      this._longPressTarget = el

      this._longPressTimer = setTimeout(() => {
        // 显示删除选项
        const deleteArea = el.querySelector('.history-item-delete')
        if (deleteArea) {
          deleteArea.style.display = ''
        }
        el.classList.add('long-pressed')
        this._longPressTimer = null
      }, LONG_PRESS_DURATION)
    }

    /**
     * 清除长按定时器
     */
    _clearLongPressTimer() {
      if (this._longPressTimer) {
        clearTimeout(this._longPressTimer)
        this._longPressTimer = null
      }
    }

    // ---- 工具方法 ----

    /**
     * 格式化时间戳为可读字符串
     * @param {string} timestamp - ISO 时间字符串
     * @returns {string}
     */
    _formatTimestamp(timestamp) {
      if (!timestamp) return ''
      try {
        const date = new Date(timestamp)
        const now = new Date()
        const diff = now - date

        // 1 分钟内
        if (diff < 60 * 1000) return '刚刚'
        // 1 小时内
        if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))} 分钟前`
        // 24 小时内
        if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
        // 7 天内
        if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))} 天前`

        // 超过 7 天，显示日期
        const month = (date.getMonth() + 1).toString().padStart(2, '0')
        const day = date.getDate().toString().padStart(2, '0')
        return `${month}-${day}`
      } catch {
        return ''
      }
    }

    /**
     * HTML 转义，防止 XSS
     * @param {string} str
     * @returns {string}
     */
    _escapeHtml(str) {
      if (!str) return ''
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }
      return str.replace(/[&<>"']/g, (m) => map[m])
    }
  }

  // ==================== 注册到全局 ====================
  window.DFDPages = window.DFDPages || {}
  window.DFDPages.history = new HistoryPage()
})()
