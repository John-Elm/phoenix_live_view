import {
  CHECKABLE_INPUTS,
  DEBOUNCE_PREV_KEY,
  DEBOUNCE_TRIGGER,
  FOCUSABLE_INPUTS,
  PHX_COMPONENT,
  PHX_EVENT_CLASSES,
  PHX_HAS_FOCUSED,
  PHX_HAS_SUBMITTED,
  PHX_MAIN,
  PHX_NO_FEEDBACK_CLASS,
  PHX_PARENT_ID,
  PHX_PRIVATE,
  PHX_REF,
  PHX_REF_SRC,
  PHX_ROOT_ID,
  PHX_SESSION,
  PHX_STATIC,
  PHX_UPLOAD_REF,
  PHX_VIEW_SELECTOR,
  PHX_STICKY,
  THROTTLED
} from "./constants"

import JS from "./js"

import {
  logError
} from "./utils"

let DOM = {
  byId(id){ return document.getElementById(id) || logError(`no id found for ${id}`) },

  removeClass(el, className){
    el.classList.remove(className)
    if(el.classList.length === 0){ el.removeAttribute("class") }
  },

  all(node, query, callback){
    if(!node){ return [] }
    let array = Array.from(node.querySelectorAll(query))
    return callback ? array.forEach(callback) : array
  },

  childNodeLength(html){
    let template = document.createElement("template")
    template.innerHTML = html
    return template.content.childElementCount
  },

  isUploadInput(el){ return el.type === "file" && el.getAttribute(PHX_UPLOAD_REF) !== null },

  isAutoUpload(inputEl){ return inputEl.hasAttribute("data-phx-auto-upload") },

  findUploadInputs(node){
    const formId = node.id
    const inputsOutsideForm = this.all(document, `input[type="file"][${PHX_UPLOAD_REF}][form="${formId}"]`)
    return this.all(node, `input[type="file"][${PHX_UPLOAD_REF}]`).concat(inputsOutsideForm)
  },

  findComponentNodeList(node, cid){
    return this.filterWithinSameLiveView(this.all(node, `[${PHX_COMPONENT}="${cid}"]`), node)
  },

  isPhxDestroyed(node){
    return node.id && DOM.private(node, "destroyed") ? true : false
  },

  wantsNewTab(e){
    let wantsNewTab = e.ctrlKey || e.shiftKey || e.metaKey || (e.button && e.button === 1)
    let isDownload = (e.target instanceof HTMLAnchorElement && e.target.hasAttribute("download"))
    let isTargetBlank = e.target.hasAttribute("target") && e.target.getAttribute("target").toLowerCase() === "_blank"
    return wantsNewTab || isTargetBlank || isDownload
  },

  isUnloadableFormSubmit(e){
    // Ignore form submissions intended to close a native <dialog> element
    // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog#usage_notes
    let isDialogSubmit = (e.target && e.target.getAttribute("method") === "dialog") ||
      (e.submitter && e.submitter.getAttribute("formmethod") === "dialog")

    if(isDialogSubmit){
      return false
    } else {
      return !e.defaultPrevented && !this.wantsNewTab(e)
    }
  },

  isNewPageClick(e, currentLocation){
    let href = e.target instanceof HTMLAnchorElement ? e.target.getAttribute("href") : null
    let url

    if(e.defaultPrevented || href === null || this.wantsNewTab(e)){ return false }
    if(href.startsWith("mailto:") || href.startsWith("tel:")){ return false }
    if(e.target.isContentEditable){ return false }

    try {
      url = new URL(href)
    } catch(e) {
      try {
        url = new URL(href, currentLocation)
      } catch(e) {
        // bad URL, fallback to let browser try it as external
        return true
      }
    }

    if(url.host === currentLocation.host && url.protocol === currentLocation.protocol){
      if(url.pathname === currentLocation.pathname && url.search === currentLocation.search){
        return url.hash === "" && !url.href.endsWith("#")
      }
    }
    return url.protocol.startsWith("http")
  },

  markPhxChildDestroyed(el){
    if(this.isPhxChild(el)){ el.setAttribute(PHX_SESSION, "") }
    this.putPrivate(el, "destroyed", true)
  },

  findPhxChildrenInFragment(html, parentId){
    let template = document.createElement("template")
    template.innerHTML = html
    return this.findPhxChildren(template.content, parentId)
  },

  isIgnored(el, phxUpdate){
    return (el.getAttribute(phxUpdate) || el.getAttribute("data-phx-update")) === "ignore"
  },

  isPhxUpdate(el, phxUpdate, updateTypes){
    return el.getAttribute && updateTypes.indexOf(el.getAttribute(phxUpdate)) >= 0
  },

  findPhxSticky(el){ return this.all(el, `[${PHX_STICKY}]`) },

  findPhxChildren(el, parentId){
    return this.all(el, `${PHX_VIEW_SELECTOR}[${PHX_PARENT_ID}="${parentId}"]`)
  },

  findParentCIDs(node, cids){
    let initial = new Set(cids)
    let parentCids =
      cids.reduce((acc, cid) => {
        let selector = `[${PHX_COMPONENT}="${cid}"] [${PHX_COMPONENT}]`

        this.filterWithinSameLiveView(this.all(node, selector), node)
          .map(el => parseInt(el.getAttribute(PHX_COMPONENT)))
          .forEach(childCID => acc.delete(childCID))

        return acc
      }, initial)

    return parentCids.size === 0 ? new Set(cids) : parentCids
  },

  filterWithinSameLiveView(nodes, parent){
    if(parent.querySelector(PHX_VIEW_SELECTOR)){
      return nodes.filter(el => this.withinSameLiveView(el, parent))
    } else {
      return nodes
    }
  },

  withinSameLiveView(node, parent){
    while(node = node.parentNode){
      if(node.isSameNode(parent)){ return true }
      if(node.getAttribute(PHX_SESSION) !== null){ return false }
    }
  },

  private(el, key){ return el[PHX_PRIVATE] && el[PHX_PRIVATE][key] },

  deletePrivate(el, key){ el[PHX_PRIVATE] && delete (el[PHX_PRIVATE][key]) },

  putPrivate(el, key, value){
    if(!el[PHX_PRIVATE]){ el[PHX_PRIVATE] = {} }
    el[PHX_PRIVATE][key] = value
  },

  updatePrivate(el, key, defaultVal, updateFunc){
    let existing = this.private(el, key)
    if(existing === undefined){
      this.putPrivate(el, key, updateFunc(defaultVal))
    } else {
      this.putPrivate(el, key, updateFunc(existing))
    }
  },

  copyPrivates(target, source){
    if(source[PHX_PRIVATE]){
      target[PHX_PRIVATE] = source[PHX_PRIVATE]
    }
  },

  putTitle(str){
    let titleEl = document.querySelector("title")
    if(titleEl){
      let {prefix, suffix} = titleEl.dataset
      document.title = `${prefix || ""}${str}${suffix || ""}`
    } else {
      document.title = str
    }
  },

  debounce(el, event, phxDebounce, defaultDebounce, phxThrottle, defaultThrottle, asyncFilter, callback){
    let debounce = el.getAttribute(phxDebounce)
    let throttle = el.getAttribute(phxThrottle)

    if(debounce === ""){ debounce = defaultDebounce }
    if(throttle === ""){ throttle = defaultThrottle }
    let value = debounce || throttle
    switch(value){
      case null: return callback()

      case "blur":
        if(this.once(el, "debounce-blur")){
          el.addEventListener("blur", () => callback())
        }
        return

      default:
        let timeout = parseInt(value)
        let trigger = (blur) => {
          if(blur){
            // if the input is blurred, we need to cancel the next throttle timeout
            // therefore we store the timer id in the THROTTLED private attribute
            if(throttle && this.private(el, THROTTLED)){
              clearTimeout(this.private(el, THROTTLED))
              this.deletePrivate(el, THROTTLED)
            }
            // on debounce we just trigger the callback
            return callback()
          }
          // no blur, remove the throttle attribute if we are in throttle mode
          if(throttle) this.deletePrivate(el, THROTTLED)
          // always call the callback to ensure that the latest event is processed,
          // even when throttle is active
          callback()
        }
        let currentCycle = this.incCycle(el, DEBOUNCE_TRIGGER, trigger)
        if(isNaN(timeout)){ return logError(`invalid throttle/debounce value: ${value}`) }
        if(throttle){
          let newKeyDown = false
          if(event.type === "keydown"){
            let prevKey = this.private(el, DEBOUNCE_PREV_KEY)
            this.putPrivate(el, DEBOUNCE_PREV_KEY, event.key)
            newKeyDown = prevKey !== event.key
          }

          if(!newKeyDown && this.private(el, THROTTLED)){
            return false
          } else {
            callback()
            // store the throttle timer id in the THROTTLED private attribute,
            // so that we can cancel it if the input is blurred
            // otherwise, when new events happen after blur, but before the old
            // timeout is triggered, we would actually trigger the callback multiple times
            const t = setTimeout(() => {
              if(asyncFilter()){ this.triggerCycle(el, DEBOUNCE_TRIGGER) }
            }, timeout)
            this.putPrivate(el, THROTTLED, t)
          }
        } else {
          setTimeout(() => {
            if(asyncFilter()){ this.triggerCycle(el, DEBOUNCE_TRIGGER, currentCycle) }
          }, timeout)
        }

        let form = el.form
        if(form && this.once(form, "bind-debounce")){
          form.addEventListener("submit", () => {
            Array.from((new FormData(form)).entries(), ([name]) => {
              let input = form.querySelector(`[name="${name}"]`)
              this.incCycle(input, DEBOUNCE_TRIGGER)
              this.deletePrivate(input, THROTTLED)
            })
          })
        }
        if(this.once(el, "bind-debounce")){
          el.addEventListener("blur", () => this.triggerCycle(el, DEBOUNCE_TRIGGER, null, [true]))
        }
    }
  },

  triggerCycle(el, key, currentCycle, params=[]){
    let [cycle, trigger] = this.private(el, key)
    if(!currentCycle){ currentCycle = cycle }
    if(currentCycle === cycle){
      this.incCycle(el, key)
      trigger(...params)
    }
  },

  once(el, key){
    if(this.private(el, key) === true){ return false }
    this.putPrivate(el, key, true)
    return true
  },

  incCycle(el, key, trigger = function (){ }){
    let [currentCycle] = this.private(el, key) || [0, trigger]
    currentCycle++
    this.putPrivate(el, key, [currentCycle, trigger])
    return currentCycle
  },

  maybeAddPrivateHooks(el, phxViewportTop, phxViewportBottom){
    if(el.hasAttribute && (el.hasAttribute(phxViewportTop) || el.hasAttribute(phxViewportBottom))){
      el.setAttribute("data-phx-hook", "Phoenix.InfiniteScroll")
    }
  },

  isFeedbackContainer(el, phxFeedbackFor){
    return el.hasAttribute && el.hasAttribute(phxFeedbackFor)
  },

  maybeHideFeedback(container, feedbackContainers, phxFeedbackFor, phxFeedbackGroup){
    // because we can have multiple containers with the same phxFeedbackFor value
    // we perform the check only once and store the result;
    // we often have multiple containers, because we push both fromEl and toEl in dompatch
    // when a container is updated
    const feedbackResults = {}
    feedbackContainers.forEach(el => {
      // skip elements that are not in the DOM
      if(!container.contains(el)) return
      const feedback = el.getAttribute(phxFeedbackFor)
      if(!feedback){
        // the container previously had phx-feedback-for, but now it doesn't
        // remove the class from the container (if it exists)
        JS.addOrRemoveClasses(el, [], [PHX_NO_FEEDBACK_CLASS])
        return
      }
      if(feedbackResults[feedback] === true){
        this.hideFeedback(el)
        return
      }
      feedbackResults[feedback] = this.shouldHideFeedback(container, feedback, phxFeedbackGroup)
      if(feedbackResults[feedback] === true){
        this.hideFeedback(el)
      }
    })
  },

  hideFeedback(container){
    JS.addOrRemoveClasses(container, [PHX_NO_FEEDBACK_CLASS], [])
  },

  shouldHideFeedback(container, nameOrGroup, phxFeedbackGroup){
    const query = `[name="${nameOrGroup}"],
                   [name="${nameOrGroup}[]"],
                   [${phxFeedbackGroup}="${nameOrGroup}"]`
    let focused = false
    DOM.all(container, query, (input) => {
      if(this.private(input, PHX_HAS_FOCUSED) || this.private(input, PHX_HAS_SUBMITTED)){
        focused = true
      }
    })
    return !focused
  },

  feedbackSelector(input, phxFeedbackFor, phxFeedbackGroup){
    let query = `[${phxFeedbackFor}="${input.name}"],
                 [${phxFeedbackFor}="${input.name.replace(/\[\]$/, "")}"]`
    if(input.getAttribute(phxFeedbackGroup)){
      query += `,[${phxFeedbackFor}="${input.getAttribute(phxFeedbackGroup)}"]`
    }
    return query
  },

  resetForm(form, phxFeedbackFor, phxFeedbackGroup){
    Array.from(form.elements).forEach(input => {
      let query = this.feedbackSelector(input, phxFeedbackFor, phxFeedbackGroup)
      this.deletePrivate(input, PHX_HAS_FOCUSED)
      this.deletePrivate(input, PHX_HAS_SUBMITTED)
      this.all(document, query, feedbackEl => {
        JS.addOrRemoveClasses(feedbackEl, [PHX_NO_FEEDBACK_CLASS], [])
      })
    })
  },

  showError(inputEl, phxFeedbackFor, phxFeedbackGroup){
    if(inputEl.name){
      let query = this.feedbackSelector(inputEl, phxFeedbackFor, phxFeedbackGroup)
      this.all(document, query, (el) => {
        JS.addOrRemoveClasses(el, [], [PHX_NO_FEEDBACK_CLASS])
      })
    }
  },

  isPhxChild(node){
    return node.getAttribute && node.getAttribute(PHX_PARENT_ID)
  },

  isPhxSticky(node){
    return node.getAttribute && node.getAttribute(PHX_STICKY) !== null
  },

  isChildOfAny(el, parents){
    return !!parents.find(parent => parent.contains(el))
  },

  firstPhxChild(el){
    return this.isPhxChild(el) ? el : this.all(el, `[${PHX_PARENT_ID}]`)[0]
  },

  dispatchEvent(target, name, opts = {}){
    let defaultBubble = true
    let isUploadTarget = target.nodeName === "INPUT" && target.type === "file"
    if(isUploadTarget && name === "click"){
      defaultBubble = false
    }
    let bubbles = opts.bubbles === undefined ? defaultBubble : !!opts.bubbles
    let eventOpts = {bubbles: bubbles, cancelable: true, detail: opts.detail || {}}
    let event = name === "click" ? new MouseEvent("click", eventOpts) : new CustomEvent(name, eventOpts)
    target.dispatchEvent(event)
  },

  cloneNode(node, html){
    if(typeof (html) === "undefined"){
      return node.cloneNode(true)
    } else {
      let cloned = node.cloneNode(false)
      cloned.innerHTML = html
      return cloned
    }
  },

  // merge attributes from source to target
  // if an element is ignored, we only merge data attributes
  // including removing data attributes that are no longer in the source
  mergeAttrs(target, source, opts = {}){
    let exclude = new Set(opts.exclude || [])
    let isIgnored = opts.isIgnored
    let sourceAttrs = source.attributes
    for(let i = sourceAttrs.length - 1; i >= 0; i--){
      let name = sourceAttrs[i].name
      if(!exclude.has(name)){
        const sourceValue = source.getAttribute(name)
        if(target.getAttribute(name) !== sourceValue && (!isIgnored || (isIgnored && name.startsWith("data-")))){
          target.setAttribute(name, sourceValue)
        }
      } else {
        // We exclude the value from being merged on focused inputs, because the
        // user's input should always win.
        // We can still assign it as long as the value property is the same, though.
        // This prevents a situation where the updated hook is not being triggered
        // when an input is back in its "original state", because the attribute
        // was never changed, see:
        // https://github.com/phoenixframework/phoenix_live_view/issues/2163
        if(name === "value" && target.value === source.value){
          // actually set the value attribute to sync it with the value property
          target.setAttribute("value", source.getAttribute(name))
        }
      }
    }

    let targetAttrs = target.attributes
    for(let i = targetAttrs.length - 1; i >= 0; i--){
      let name = targetAttrs[i].name
      if(isIgnored){
        if(name.startsWith("data-") && !source.hasAttribute(name) && ![PHX_REF, PHX_REF_SRC].includes(name)){ target.removeAttribute(name) }
      } else {
        if(!source.hasAttribute(name)){ target.removeAttribute(name) }
      }
    }
  },

  mergeFocusedInput(target, source){
    // skip selects because FF will reset highlighted index for any setAttribute
    if(!(target instanceof HTMLSelectElement)){ DOM.mergeAttrs(target, source, {exclude: ["value"]}) }

    if(source.readOnly){
      target.setAttribute("readonly", true)
    } else {
      target.removeAttribute("readonly")
    }
  },

  hasSelectionRange(el){
    return el.setSelectionRange && (el.type === "text" || el.type === "textarea")
  },

  restoreFocus(focused, selectionStart, selectionEnd){
    if(focused instanceof HTMLSelectElement){ focused.focus() }
    if(!DOM.isTextualInput(focused)){ return }

    let wasFocused = focused.matches(":focus")
    if(focused.readOnly){ focused.blur() }
    if(!wasFocused){ focused.focus() }
    if(this.hasSelectionRange(focused)){
      focused.setSelectionRange(selectionStart, selectionEnd)
    }
  },

  isFormInput(el){ return /^(?:input|select|textarea)$/i.test(el.tagName) && el.type !== "button" },

  syncAttrsToProps(el){
    if(el instanceof HTMLInputElement && CHECKABLE_INPUTS.indexOf(el.type.toLocaleLowerCase()) >= 0){
      el.checked = el.getAttribute("checked") !== null
    }
  },

  isTextualInput(el){ return FOCUSABLE_INPUTS.indexOf(el.type) >= 0 },

  isNowTriggerFormExternal(el, phxTriggerExternal){
    return el.getAttribute && el.getAttribute(phxTriggerExternal) !== null
  },

  syncPendingRef(fromEl, toEl, disableWith){
    let ref = fromEl.getAttribute(PHX_REF)
    if(ref === null){ return true }
    let refSrc = fromEl.getAttribute(PHX_REF_SRC)

    if(DOM.isFormInput(fromEl) || fromEl.getAttribute(disableWith) !== null){
      if(DOM.isUploadInput(fromEl)){ DOM.mergeAttrs(fromEl, toEl, {isIgnored: true}) }
      DOM.putPrivate(fromEl, PHX_REF, toEl)
      return false
    } else {
      PHX_EVENT_CLASSES.forEach(className => {
        fromEl.classList.contains(className) && toEl.classList.add(className)
      })
      toEl.setAttribute(PHX_REF, ref)
      toEl.setAttribute(PHX_REF_SRC, refSrc)
      return true
    }
  },

  cleanChildNodes(container, phxUpdate){
    if(DOM.isPhxUpdate(container, phxUpdate, ["append", "prepend"])){
      let toRemove = []
      container.childNodes.forEach(childNode => {
        if(!childNode.id){
          // Skip warning if it's an empty text node (e.g. a new-line)
          let isEmptyTextNode = childNode.nodeType === Node.TEXT_NODE && childNode.nodeValue.trim() === ""
          if(!isEmptyTextNode){
            logError("only HTML element tags with an id are allowed inside containers with phx-update.\n\n" +
              `removing illegal node: "${(childNode.outerHTML || childNode.nodeValue).trim()}"\n\n`)
          }
          toRemove.push(childNode)
        }
      })
      toRemove.forEach(childNode => childNode.remove())
    }
  },

  replaceRootContainer(container, tagName, attrs){
    let retainedAttrs = new Set(["id", PHX_SESSION, PHX_STATIC, PHX_MAIN, PHX_ROOT_ID])
    if(container.tagName.toLowerCase() === tagName.toLowerCase()){
      Array.from(container.attributes)
        .filter(attr => !retainedAttrs.has(attr.name.toLowerCase()))
        .forEach(attr => container.removeAttribute(attr.name))

      Object.keys(attrs)
        .filter(name => !retainedAttrs.has(name.toLowerCase()))
        .forEach(attr => container.setAttribute(attr, attrs[attr]))

      return container

    } else {
      let newContainer = document.createElement(tagName)
      Object.keys(attrs).forEach(attr => newContainer.setAttribute(attr, attrs[attr]))
      retainedAttrs.forEach(attr => newContainer.setAttribute(attr, container.getAttribute(attr)))
      newContainer.innerHTML = container.innerHTML
      container.replaceWith(newContainer)
      return newContainer
    }
  },

  getSticky(el, name, defaultVal){
    let op = (DOM.private(el, "sticky") || []).find(([existingName, ]) => name === existingName)
    if(op){
      let [_name, _op, stashedResult] = op
      return stashedResult
    } else {
      return typeof(defaultVal) === "function" ? defaultVal() : defaultVal
    }
  },

  deleteSticky(el, name){
    this.updatePrivate(el, "sticky", [], ops => {
      return ops.filter(([existingName, _]) => existingName !== name)
    })
  },

  putSticky(el, name, op){
    let stashedResult = op(el)
    this.updatePrivate(el, "sticky", [], ops => {
      let existingIndex = ops.findIndex(([existingName, ]) => name === existingName)
      if(existingIndex >= 0){
        ops[existingIndex] = [name, op, stashedResult]
      } else {
        ops.push([name, op, stashedResult])
      }
      return ops
    })
  },

  applyStickyOperations(el){
    let ops = DOM.private(el, "sticky")
    if(!ops){ return }

    ops.forEach(([name, op, _stashed]) => this.putSticky(el, name, op))
  }
}

export default DOM
