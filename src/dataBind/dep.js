(function() {
  function Dep() {
    this.subs = []
  }
  Dep.prototype = {
    addSub(sub) {
      if(this.subs.indexOf(sub) === -1) {
        this.subs.push(sub)
      }
    },
    removeSub(sub) {
      var subs = this.subs
      if (subs.length) {
        var index = subs.indexOf(sub)
        if (index > -1) {
          return subs.splice(index, 1)
        }
      }
    },
    notify() {
      var subs = this.subs.slice()
      for (var i = 0, l = subs.length; i < l; i++) {
        subs[i].update()
      }
    }
  }
  this.Dep = Dep
}).call(this)