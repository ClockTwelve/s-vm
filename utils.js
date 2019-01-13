function watch(vm, key, cb) {
  return new Subscriber(vm, key, cb)
}

function compute(vm, name, getter) {
  var dep = new Dep()
  var computed = watch(vm, getter, function() {
    dep.notify()
  })
  Object.defineProperty(vm, name, {
    enumerable: true,
    configurable: true,
    get: function() {
      if(Dep.target) {
        dep.addSub(Dep.target)
      }
      return computed.value
    }
  })
  return name
}
