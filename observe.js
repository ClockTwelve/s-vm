(function() {

  function defineReactive(
    obj,
    key
  ) {
    var val = obj[key]
    var dep = new Dep()
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      get: function() {
        if(Dep.target) {
          dep.addSub(Dep.target)
        }
        return val
      },
      set: function(newVal) {
        val = newVal
        dep.notify()
      }
    })
  }
  
  function observe(data) {
    Object.keys(data).forEach(key => {
      defineReactive(data, key)
    })
  }
  this.observe = observe
  this.defineReactive = defineReactive
}).call(this)