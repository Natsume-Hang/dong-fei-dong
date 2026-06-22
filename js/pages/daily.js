/**
 * daily.js - 懂非懂 (DongFeiDong) 每日一辨详情页模块
 *
 * 基于 IIFE + PageObject 模式，负责每日辟谣内容的展示与交互：
 * 1. 从 SeedDB 加载 misconception 类别的数据
 * 2. 使用日期种子选取当日辟谣条目
 * 3. 展示误传版本、真相还原、来源考证
 * 4. 支持"昨日"/"明日"按钮浏览其他条目
 * 5. 返回按钮导航回首页
 *
 * 依赖: window.Logger, window.Store, window.Router
 *       window.SeedDB
 * 导出: window.DFDPages.daily
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

  /** 一天的毫秒数 */
  const MS_PER_DAY = 24 * 60 * 60 * 1000

  // ==================== DailyPage 类 ====================

  class DailyPage extends PageObject {
    constructor() {
      super('#page-daily')

      // 缓存 DOM 元素引用
      this.btnBack = this.$('#btn-daily-back')
      this.detailContent = this.$('#daily-detail-content')

      // 当前浏览的日期偏移（0=今天，-1=昨天，1=明天）
      this._dateOffset = 0

      // 缓存的 misconception 数据
      this._misconceptions = []

      // 绑定事件
      this._bindEvents()
    }

    // ---- 生命周期 ----

    /**
     * 页面显示时：加载今日辟谣内容
     */
    async onShow() {
      const logger = window.Logger
      logger && logger.info('DailyPage', '页面显示')

      // 重置为今天
      this._dateOffset = 0

      // 加载数据并渲染（异步等待 SeedDB 加载完成）
      await this._loadAndRender()
    }

    /**
     * 页面隐藏时的清理逻辑
     */
    onHide() {
      const logger = window.Logger
      logger && logger.debug('DailyPage', '页面隐藏')
    }

    // ---- 事件绑定 ----

    /**
     * 绑定所有 DOM 事件
     */
    _bindEvents() {
      // 返回按钮
      if (this.btnBack) {
        this.btnBack.addEventListener('click', () => {
          window.Router.navigate('home')
        })
      }
    }

    // ---- 数据加载与渲染 ----

    /**
     * 加载 misconception 数据并渲染当前日期的条目
     * 异步方法：先确保 SeedDB 数据已加载
     */
    async _loadAndRender() {
      const logger = window.Logger

      try {
        // 确保 SeedDB 数据已加载
        const seedDB = window.SeedDB
        if (seedDB && typeof seedDB.load === 'function') {
          await seedDB.load()
        }

        // 加载 misconception 数据
        if (seedDB && typeof seedDB.getByCategory === 'function') {
          this._misconceptions = seedDB.getByCategory('misconception') || []
          logger && logger.debug('DailyPage', `加载 misconception 数据: ${this._misconceptions.length} 条`)
        } else {
          logger && logger.warn('DailyPage', 'SeedDB 不可用')
          this._renderError('数据加载失败，请稍后重试')
          return
        }

        if (this._misconceptions.length === 0) {
          this._renderError('暂无每日辨析内容')
          return
        }

        // 渲染当前偏移日期的条目
        this._renderDailyItem()
      } catch (err) {
        logger && logger.error('DailyPage', '加载每日辨析失败', err.message)
        this._renderError('加载失败，请稍后重试')
      }
    }

    /**
     * 渲染指定偏移日期的每日一辨条目
     */
    _renderDailyItem() {
      const logger = window.Logger

      if (!this.detailContent || this._misconceptions.length === 0) return

      try {
        // 计算目标日期
        const targetDate = this._getTargetDate()
        const dateStr = targetDate.toISOString().slice(0, 10)

        // 用日期字符串作为种子选取条目
        const index = this._dateHash(dateStr) % this._misconceptions.length
        const item = this._misconceptions[index]

        if (!item) {
          this._renderError('内容加载异常')
          return
        }

        // 格式化日期显示
        const displayDate = this._formatDateDisplay(targetDate)

        // 构建内容 HTML
        const html = `
          <div class="daily-detail-card">
            <div class="daily-detail-date">${this._escapeHtml(displayDate)}</div>

            <div class="daily-detail-section">
              <h3 class="daily-detail-label">误传版本</h3>
              <p class="daily-detail-text daily-misconception">${this._escapeHtml(item.question || item.misconception || '暂无内容')}</p>
            </div>

            <div class="daily-detail-section">
              <h3 class="daily-detail-label">真相还原</h3>
              <p class="daily-detail-text daily-truth">${this._escapeHtml(item.truth || item.answer || item.interpretation || '暂无内容')}</p>
            </div>

            ${item.source || item.verification ? `
            <div class="daily-detail-section">
              <h3 class="daily-detail-label">来源考证</h3>
              <p class="daily-detail-text daily-source">${this._escapeHtml(item.source || item.verification || '暂无来源信息')}</p>
            </div>
            ` : ''}

            <div class="daily-nav-buttons">
              <button class="btn btn-secondary btn-sm" id="btn-daily-prev">← 昨日</button>
              <button class="btn btn-secondary btn-sm" id="btn-daily-today" ${this._dateOffset === 0 ? 'disabled' : ''}>回到今日</button>
              <button class="btn btn-secondary btn-sm" id="btn-daily-next">明日 →</button>
            </div>
          </div>
        `

        this.detailContent.innerHTML = html

        // 绑定导航按钮事件
        this._bindNavButtons()

        logger && logger.debug('DailyPage', `已渲染每日一辨: ${dateStr}`, { index, title: item.question || item.title })

      } catch (err) {
        logger && logger.error('DailyPage', '渲染每日一辨失败', err.message)
        this._renderError('内容渲染失败')
      }
    }

    /**
     * 绑定日期导航按钮事件
     */
    _bindNavButtons() {
      const logger = window.Logger

      const btnPrev = this.detailContent.querySelector('#btn-daily-prev')
      const btnNext = this.detailContent.querySelector('#btn-daily-next')
      const btnToday = this.detailContent.querySelector('#btn-daily-today')

      if (btnPrev) {
        btnPrev.addEventListener('click', () => {
          this._dateOffset--
          logger && logger.info('DailyPage', `浏览昨日内容，偏移: ${this._dateOffset}`)
          this._renderDailyItem()
        })
      }

      if (btnNext) {
        btnNext.addEventListener('click', () => {
          this._dateOffset++
          logger && logger.info('DailyPage', `浏览明日内容，偏移: ${this._dateOffset}`)
          this._renderDailyItem()
        })
      }

      if (btnToday) {
        btnToday.addEventListener('click', () => {
          this._dateOffset = 0
          logger && logger.info('DailyPage', '回到今日内容')
          this._renderDailyItem()
        })
      }
    }

    /**
     * 渲染错误状态
     * @param {string} message - 错误信息
     */
    _renderError(message) {
      if (this.detailContent) {
        this.detailContent.innerHTML = `
          <div class="daily-detail-error">
            <p>${this._escapeHtml(message || '加载失败')}</p>
          </div>
        `
      }
    }

    // ---- 工具方法 ----

    /**
     * 获取目标偏移日期的 Date 对象
     * @returns {Date}
     */
    _getTargetDate() {
      const now = new Date()
      const target = new Date(now.getTime() + this._dateOffset * MS_PER_DAY)
      return target
    }

    /**
     * 格式化日期为可读显示
     * @param {Date} date
     * @returns {string}
     */
    _formatDateDisplay(date) {
      const year = date.getFullYear()
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      const weekDays = ['日', '一', '二', '三', '四', '五', '六']
      const weekDay = weekDays[date.getDay()]

      let label = ''
      if (this._dateOffset === 0) {
        label = '今天'
      } else if (this._dateOffset === -1) {
        label = '昨天'
      } else if (this._dateOffset === 1) {
        label = '明天'
      } else if (this._dateOffset < 0) {
        label = `${Math.abs(this._dateOffset)} 天前`
      } else {
        label = `${this._dateOffset} 天后`
      }

      return `${year}年${month}月${day}日 星期${weekDay}（${label}）`
    }

    /**
     * 日期字符串哈希（用于固定选取条目）
     * @param {string} dateStr - 日期字符串（如 "2026-06-18"）
     * @returns {number}
     */
    _dateHash(dateStr) {
      let hash = 0
      for (let i = 0; i < dateStr.length; i++) {
        const char = dateStr.charCodeAt(i)
        hash = ((hash << 5) - hash) + char
        hash |= 0
      }
      return Math.abs(hash)
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
  window.DFDPages.daily = new DailyPage()
})()
