(function() {
  var uniqueId = 0
  function Subscriber(vm, exp, callback) {
    this.id = ++uniqueId
    // 依赖的值所在的对象
    this.vm = vm
    // 依赖的值对应的表达式
    this.exp = exp
    this.getter = typeof exp === 'function' ? 
      exp : function(vm, exp) { return vm[exp] }
    // 值更新后的回调
    this.cb = callback
    // 初始化依赖关系
    this.value = this.get()
  }
  Subscriber.prototype = {
    get () {
  
      // 把当前Subscriber设置给Dep.target
      var value, vm = this.vm
      Dep.target = this
  
      value = this.getter.call(vm, vm, this.exp)
      // 删除当前Subscriber设置给Dep.target
      Dep.target = null
      return value
    },
    update() {
      queueSub(this)
      // this.run()
    },
    run() {
      var oldValue,newValue
      oldValue = this.value
      this.value = newValue = this.get()
      if(oldValue !== newValue && this.cb) {
        this.cb.call(this.vm, oldValue, newValue)
      }
    }
  }


  this.Subscriber = Subscriber

}).call(this)