(function() {
  // 更新队列
  var queue = [],
  // queue中当前正在执行的sub对应的在queue中的下标
  index = 0,
  // 标志位,代表是否正有queue在执行.
  flushing = false,
  waitingForQueueExec = false,
  has = {}

  function flushQueue() {
    flushing = true
    
    queue.sort(function(a, b) { return a.id > b.id })
    for(var i = 0; i < queue.length; i++) {
      var sub = queue[i]
      has[sub.id] = null
      sub.run()
    }
    resetQueue()
  }

  function resetQueue() {
    queue = []
    index = 0
    flushing = waitingForQueueExec = false
    has = {}
  }
  function queueSub(sub) {
    var id = sub.id
    // 队列中没有才添加
    if(!has[id]) {
      has[id] = true
      if(!flushing) {
        // 如果当前队列没在执行就直接push入队列
        queue.push(sub)
      } else {

        var i = queue.length - 1
        while(i > index && id > queue[i].id) {
          i--
        }
        // 把sub插入到当前位置
        queue.splice(i + 1, 0, sub)
      }
      if(!waitingForQueueExec) {
        waitingForQueueExec = true
        setTimeout(flushQueue, 0)
      }
    }
  }
  this.queueSub = queueSub
}).call(this)