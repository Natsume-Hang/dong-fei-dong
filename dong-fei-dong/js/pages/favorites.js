/**
 * favorites.js - 懂非懂 (DongFeiDong) 收藏页模块
 *
 * 基于 IIFE + PageObject 模式，负责收藏列表的展示与交互：
 * 1. 从 Store 加载收藏列表并渲染
 * 2. 点击条目跳转到结果页
 * 3. 清空全部（带确认弹窗）
 * 4. 单条取消收藏（从列表移除）
 *
 * 依赖: window.Logger, window.Store, window.Router, window.Toast, window.Modal
 *       window.DFDState
 * 导出: window.DFDPages.favorites
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

  /** Toast 提示编号 */
  const TOAST_UNFAVORITE = 'T3'

  /** Modal 确认弹窗编号 */
  const MODAL_CLEAR_FAVORITES = 'M3'

  // ==================== FavoritesPage 类 ====================

  class FavoritesPage extends PageObject {
    constructor() {
      super('#page-favorites')

      // 缓存 DOM 元素引用
      this.favoritesList = this.$('#favorites-list')
      this.favoritesEmpty = this.$('#favorites-empty')
      this.btnClearFavorites = this.$('#btn-clear-favorites')
      this.filterContainer = this.$('#filter-chips')
      this.currentFilter = '全部'

      // 绑定事件
      this._bindEvents()
    }

    // ---- 生命周期 ----

    /**
     * 页面显示时：加载收藏列表并渲染
     */
    onShow() {
      const logger = window.Logger
      logger && logger.info('FavoritesPage', '页面显示')

      this._renderFilterChips()
      this._loadAndRender()
    }

    /**
     * 页面隐藏时的清理逻辑
     */
    onHide() {
      const logger = window.Logger
      logger && logger.debug('FavoritesPage', '页面隐藏')
    }

    // ---- 事件绑定 ----

    /**
     * 绑定所有 DOM 事件
     */
    _bindEvents() {
      // 清空全部按钮
      if (this.btnClearFavorites) {
        this.btnClearFavorites.addEventListener('click', () => {
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
     * 从 Store 加载收藏列表并渲染
     */
    _loadAndRender() {
      const store = window.Store
      const logger = window.Logger

      if (!store || !this.favoritesList) return

      try {
        // 获取收藏的 ID 列表
        const favoriteIds = store.getFavorites()
        logger && logger.debug('FavoritesPage', `加载收藏列表: ${favoriteIds.length} 条`)

        // 清空列表
        this.favoritesList.innerHTML = ''

        if (favoriteIds.length === 0) {
          // 显示空状态插图
          if (this.favoritesEmpty) {
            var illustrations = window.Illustrations
            this.favoritesEmpty.innerHTML = illustrations
              ? illustrations.empty('还没有收藏任何解读，去发现有趣的典故吧')
              : '<p>暂无收藏</p><p class="empty-hint">解读后点击 ☆ 即可收藏</p>'
            this.favoritesEmpty.style.display = ''
          }
          return
        }

        // 隐藏空状态
        if (this.favoritesEmpty) this.favoritesEmpty.style.display = 'none'

        // 从历史记录中查找收藏项的详细信息
        const history = store.getHistory()
        const historyMap = new Map()
        history.forEach((item) => {
          if (item.id) {
            historyMap.set(item.id, item)
          }
        })

        // 构建收藏项列表
        let favoriteItems = favoriteIds.map((id) => {
          const item = historyMap.get(id)
          return item ? { id, item } : null
        }).filter(Boolean)

        // 按类型筛选
        if (this.currentFilter !== '全部') {
          favoriteItems = favoriteItems.filter(({ item }) => item.inputType === this.currentFilter)
        }

        // 渲染收藏列表
        favoriteItems.forEach(({ id, item }) => {
          const el = this._createFavoriteItem(item)
          if (el) {
            this.favoritesList.appendChild(el)
          }
        })

        // 处理找不到详情的降级条目（仅在"全部"筛选时显示）
        if (this.currentFilter === '全部') {
          favoriteIds.forEach((id) => {
            if (!historyMap.has(id)) {
              const el = this._createFallbackItem(id)
              if (el) {
                this.favoritesList.appendChild(el)
              }
            }
          })
        }

        // 如果所有收藏都找不到详情，显示空状态
        if (this.favoritesList.children.length === 0) {
          if (this.favoritesEmpty) {
            var illustrations = window.Illustrations
            this.favoritesEmpty.innerHTML = illustrations
              ? illustrations.empty('还没有收藏任何解读，去发现有趣的典故吧')
              : '<p>暂无收藏</p><p class="empty-hint">解读后点击 ☆ 即可收藏</p>'
            this.favoritesEmpty.style.display = ''
          }
        }

      } catch (err) {
        logger && logger.error('FavoritesPage', '加载收藏列表失败', err.message)
        if (this.favoritesEmpty) this.favoritesEmpty.style.display = ''
      }
    }

    /**
     * 创建收藏条目 DOM 元素
     * @param {object} item - 历史记录项（包含 resultData）
     * @returns {HTMLElement}
     */
    _createFavoriteItem(item) {
      const logger = window.Logger

      try {
        const el = document.createElement('div')
        el.className = 'favorite-item'
        el.dataset.id = item.id || ''

        // 从 resultData 或 item 中提取信息
        const resultData = item.resultData || {}
        const title = resultData.allusion_title || item.title || '未知典故'
        const source = resultData.source || '来源不详'
        const credibility = resultData.credibility || item.credibility || '中等'

        el.innerHTML = `
          <div class="favorite-item-content">
            <p class="favorite-item-title">${this._escapeHtml(title)}</p>
            <div class="favorite-item-meta">
              <span class="favorite-item-source">${this._escapeHtml(source)}</span>
              <span class="favorite-item-credibility">${this._escapeHtml(credibility)}</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-unfavorite" title="取消收藏">✕</button>
        `

        // 点击条目跳转到结果页
        el.addEventListener('click', (e) => {
          // 如果点击的是取消收藏按钮，不跳转
          if (e.target.closest('.btn-unfavorite')) return
          this._onItemClick(item)
        })

        // 取消收藏按钮
        const unfavBtn = el.querySelector('.btn-unfavorite')
        if (unfavBtn) {
          unfavBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this._onUnfavoriteClick(item.id, el)
          })
        }

        return el
      } catch (err) {
        logger && logger.error('FavoritesPage', '创建收藏条目失败', err.message)
        return null
      }
    }

    /**
     * 创建降级收藏条目（当历史中找不到详情时）
     * @param {string} id - 收藏 ID
     * @returns {HTMLElement}
     */
    _createFallbackItem(id) {
      try {
        const el = document.createElement('div')
        el.className = 'favorite-item'
        el.dataset.id = id

        el.innerHTML = `
          <div class="favorite-item-content">
            <p class="favorite-item-title">收藏项 ${this._escapeHtml(id)}</p>
            <div class="favorite-item-meta">
              <span class="favorite-item-source">详情已过期</span>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm btn-unfavorite" title="取消收藏">✕</button>
        `

        // 取消收藏按钮
        const unfavBtn = el.querySelector('.btn-unfavorite')
        if (unfavBtn) {
          unfavBtn.addEventListener('click', (e) => {
            e.stopPropagation()
            this._onUnfavoriteClick(id, el)
          })
        }

        return el
      } catch {
        return null
      }
    }

    // ---- 交互处理 ----

    /**
     * 收藏条目点击回调：跳转到结果页
     * @param {object} item - 历史记录项
     */
    _onItemClick(item) {
      const logger = window.Logger
      logger && logger.info('FavoritesPage', '点击收藏条目', { id: item.id })

      // 将数据写入临时状态，跳转到结果页
      window.DFDState = window.DFDState || {}
      window.DFDState.inputText = item.inputText || ''
      window.DFDState.inputType = item.inputType || '通用'
      window.DFDState.resultData = item.resultData || null

      window.Router.navigate('result')
    }

    /**
     * 取消收藏按钮回调
     * @param {string} id - 收藏 ID
     * @param {HTMLElement} el - 对应的 DOM 元素
     */
    _onUnfavoriteClick(id, el) {
      const store = window.Store
      const logger = window.Logger

      if (!store || !id) return

      try {
        // 切换收藏状态（取消收藏）
        store.toggleFavorite(id)

        // 从 DOM 中移除
        if (el && el.parentNode) {
          el.parentNode.removeChild(el)
        }

        // 检查是否需要显示空状态
        const remaining = store.getFavorites()
        if (remaining.length === 0 && this.favoritesEmpty) {
          this.favoritesEmpty.style.display = ''
        }

        logger && logger.info('FavoritesPage', '已取消收藏', id)

        // 显示提示 T3
        if (window.Toast) {
          window.Toast.showPreset('T3')
        }
      } catch (err) {
        logger && logger.error('FavoritesPage', '取消收藏失败', err.message)
      }
    }

    /**
     * 清空全部按钮回调
     */
    _onClearAllClick() {
      const logger = window.Logger
      const modal = window.Modal

      if (modal && typeof modal.showConfirmClearModal === 'function') {
        modal.showConfirmClearModal('收藏').then((action) => {
          if (action === 'confirm') {
            this._clearAllFavorites()
          }
        })
      } else if (modal && typeof modal.show === 'function') {
        // 兼容旧版 Modal 接口
        modal.show({
          title: '确认清空',
          content: '<p class="modal-warning-text">确定要清空所有收藏吗？此操作不可撤销。</p>',
          confirmText: '清空',
          cancelText: '取消',
          confirmClass: 'modal-btn-danger',
          closable: true,
          onConfirm: () => {
            this._clearAllFavorites()
          },
        })
      } else {
        // Modal 不可用时直接执行清空（降级方案）
        logger && logger.warn('FavoritesPage', 'Modal 模块不可用，直接执行清空')
        this._clearAllFavorites()
      }
    }

    /**
     * 执行清空收藏
     */
    _clearAllFavorites() {
      const store = window.Store
      const logger = window.Logger

      if (store) {
        store.clear('favorites')
        logger && logger.info('FavoritesPage', '收藏已清空')
      }

      // 重新渲染
      this._loadAndRender()

      // 显示提示
      if (window.Toast) {
        window.Toast.show('收藏已清空')
      }
    }

    // ---- 工具方法 ----

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
  window.DFDPages.favorites = new FavoritesPage()
})()
