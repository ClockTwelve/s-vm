## 当我谈Vue的数据绑定时我谈些什么?

>~~内标题取自某村姓文学大师的某书.如有雷同,纯属我闲的~~

>本文基于Vue 2.0+写就,主要参考自Vue的源码.内容主要是我对``Vue``数据绑定这块儿的理解思路,其中并未涉及模版编译和虚拟DOM部分的具体代码,也没有具体实现``Vue-like``的框架.
>
>具体内容包括``data``的``reactive``,``computed``和``watch``的逻辑,以及简要的模版绑定原理.最后的是我比较好奇的``Vue``数据绑定中一些细节实现.
>
>(本篇的代码均能在我的[~~gayhub~~Github](https://github.com/ClockTwelve/s-vm)上找到)

### 楔子
接触过Vue的朋友都知道,Vue的重要功能之一就是响应式的数据绑定.即在我们变更数据后,依赖于这个数据的DOM结构会自动以变更后的数据去同步,而你不用再写下任何逻辑去更新Dom.

在Vue中数据绑定分两种:
1. **单向绑定**: 逻辑层变更引起视图层更新.更新变量后,DOM自动同步更新.
2. **双向绑定**: 在单向绑定的基础上,增加视图层引起逻辑层的同步.

下面来看两个*来自Vue官网*的例子:

**单向绑定**:
```html
<div id="app">
  <p>{{ message }}</p>
  <button v-on:click="reverseMessage">Reverse Message</button>
</div>
```
```javascript
new Vue({
  el: '#app',
  data: {
    message: 'Hello Vue.js!'
  },
  methods: {
    reverseMessage: function () {
      this.message = this.message.split('').reverse().join('')
    }
  }
})
```
点击``button``后,DOM会自动更新``<p>..</p>``中的字符串会自动变为``!sj.euV olleH``.

**双向绑定**:
```html
<div id="app">
  <p>{{ message }}</p>
  <input v-model="message">
</div>
```
```javascript
var app = new Vue({
  el: '#app',
  data: {
    message: 'Hello Vue!'
  }
})
```
任何输入到``input``框中的值,会立即同步到``<p></p>``中.

早在三皇（ARV）威震江湖之前,jQuery独霸天下的时代,我们如果想做到同样的功能,就需要我们添加额外的逻辑代码直接去修改DOM结构.而在Vue中直接修改变量的值就可以直接做到,那就一定是因为``Vue``帮我们完成了这些逻辑.
那么问题就来了,``Vue``中是怎么实现的?
### 数据绑定的原理
现在,让我们一步步的思考``Vue``是如何做到的.

我们先从单向绑定开始分析.
#### 首先是数据劫持
很多情况下,我们在``Vue``中是通过这样的方式修改数据的:``this.someData = 'some data'``.这本是一个很常规的赋值操作.而在``Vue``中却能够触发依赖这个数据的视图或代码更新,那么说明Vue在对赋值这一步做了一些处理.

这个处理就是**数据劫持**.即拦截到对数据的操作,取值或者赋值,在实际值操作前或后完成别的一些操作.

在``Vue``中,数据劫持的核心方法是``Object.defineProperty``.这个方法并不支持polyfill,**所以这也是为什么``Vue``最低只支持到IE9的原因**.(*不熟悉这个方法的朋友可以参考MDN*).

``Vue``利用这个方法拦截了对变量的``get``和``set``操作,像下面这样:

```javascript
function defineReactive(
  obj,
  key
) {
  let val = obj[key]
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function() {
      console.log('Someone is trying to get my value!')
      return val
    },
    set: function(newVal) {
      console.log(`Someone is trying to change my value!`)
      val = newVal
    }
  })
}
let data = {
  message: 'Im a ruthless message'
}
defineReactive(data, 'message')
let msg = data.message // log: Someone is trying to get my value!
data.message = 'Im a happy message' // log: Someone is trying to change my value!
```
从上面可以看出,我们已经拦截到了对data.message的值获取或者修改的操作.同时这里还需要注意的一点是:``Object.defineProperty``第一个参数是个``Object``,它是基于一个对象去拦截对该对象属性的操作的.所以在vue中data这个选项必须是一个对象或者是一个返回对象的函数.

现在我们有了这个方法后,就可以知道什么时候有代码去``set/get``某一个值了.而想要做到响应式更新,我们就还要知道“是谁”动了这个值.

#### 然后是收集依赖

灵性的朋友应该直接想到了: “谁”获取了这个值就是谁依赖这个值.所以我们应该在get这个拦截方法中去做.像下面这样:
```javascript
function defineReactive(
  obj,
  key
) {
  let val = obj[key]
  let dep = new Dep()
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function() {
      console.log('Someone is trying to get my value!')
      dep.addSub(who?)
      return val
    },
    set: function(newVal) {
      console.log(`Someone is trying to change my value!`)
      val = newVal
    }
  })
}
```
从上面可以看出每次调用这个方法,我们都利用一个叫``Dep``的构造函数用来管理依赖.在每一次调用``defineReactive``的时候,我们会去``new Dep()``.这样每个被``defineReactive``的值都有自己的``dep``.
同时细心的朋友应发现了:每次``defineReactive``这里都形成了一个闭包,所以只要这个属性存在,这个``dep``也就会一直存在.

虽然闭包解决了持久化的问题,但也带了另一个问题: 这是个闭包,那我们要如何确定``addSub``添加的是谁?

大家都知道js是个单线程运行的语言,所以同一时间必定只会有一个"东西"在获取某个值,我们把去订阅这个值变化的东西叫做``Subscriber``,那我们只需要保证全局共用一个变量保存当前的``Subscriber``就能解决之前所说的问题.像下面这样:
```javascript
function defineReactive(
  obj,
  key
) {
  let val = obj[key]
  let dep = new Dep()
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
    }
  })
}


function Dep() {
    this.subs = []
}
Dep.prototype = {
  // 添加
  addSub(sub) {
    if(subs.indexOf(sub) === -1) {
      this.subs.push(sub)
    }
  },
  // 删除
  removeSub(sub) {
    const subs = this.subs
    if (subs.length) {
      const index = subs.indexOf(sub)
      if (index > -1) {
        return subs.splice(index, 1)
      }
    }
  }
}
```
这里用``Dep.target``保存当前的依赖.只要做到每次取值前先把当前``Subscriber``赋值给``Dep.target``,那在``get``拦截函数里面就可以``addSub``这个``Subscriber``了.

至此,我们就最简单的完成了一个依赖收集功能.目前为止我们可以知道谁获取了谁,
那么下一步要做的就是在某个值被修改时通知依赖它的``Subscriber``.

#### 发布修改

在上具体代码之前,我们先简单分析下.

在``Vue``中响应式的数据绑定一般是三种形式:
1. ``computed``
2. ``watch``
3. ``template``,基于模版的数据绑定.

其中``computed``和``watch``的创建都是在``js``里完成的.``computed``是定义一个方法,它的值等于这个方法返回的值,所以``computed``不仅依赖着其它值同时也被其它地方所依赖着;``watch``是直接监听某一个依赖的变化,从而再变化后调用定义的``callback``;那模版是一串字符串或者html,它是怎么被处理的?

熟悉``Vue``的朋友知道,所有的模版都会经过Vue的编译,最终每个``Component``会生成一个``this._render``的内部方法.同可用参数 ``render``([https://vuejs.org/v2/guide/render-function.html]) 类似.那么在调用``this._render()``时就会去获取模版所依赖的值了.而这样就可以``computed``和``watch``做类似的处理了.

##### ``watch``
这里创建了一个叫``Subscriber``的构造函数让每一个收集的依赖都是它的实例(``Vue``中叫``Watch``).接下来让我们来思考一下:收集的这些依赖到底都具备什么功能.

首先,需要一个``update``方法用来完成值更新后的相应操作;其次我们需要保存一些当前``sub``的信息,例如:值改变后的对应的回调等;最后还需要一个``get``方法去获取值.所以简化版的看起来是这样:
```javascript
function Subscriber(vm, exp, callback) {
  // 依赖的值所在的对象
  this.vm = vm
  // 依赖的值对应的表达式
  this.exp = exp
  // 值更新后的回调
  this.cb = callback
  // 初始化依赖关系
  this.value = this.get()
}
Subscriber.prototype = {
  get () {

    // 把当前Subscriber设置给Dep.target
    let value
    Dep.target = this
    //获取值
    value = this.vm[this.exp]
    // 删除当前Subscriber设置给Dep.target
    Dep.target = null
    return value
  },
  update() {
    this.run()
  },
  run() {
    let oldValue,newValue
    oldValue = this.value
    newValue = this.get()
    if(oldValue !== newValue && this.cb) {
      this.cb.call(this.vm, oldValue, newValue)
    }
  }
}
```
从上面可以看到我们在初始化每一个``Subscriber``的时候去获取了一下值.这一步的作用就是更新依赖关系,因为只有在获取值时
才会调用``dep.addSub``去存储相应的依赖.

与此同时,``Dep``和``defineReactive``也需要添加一些相应的处理代码:
```javascript
// 省略号代表代码和上面相同
Dep.prototype = {
  addSub(sub) { ... },
  removeSub(sub) { ... },
  notify() {
    // 通知存的所有的Subscriber值更新了
    const subs = this.subs.slice()
    for (let i = 0, l = subs.length; i < l; i++) {
      subs[i].update()
    }
  }
}

function defineReactive(
  obj,
  key
) {
  let val = obj[key]
  let dep = new Dep()
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function() {...},
    set: function(newVal) {
      val = newVal
      // 通知所有Subscriber去更新
      dep.notify()
    }
  })
}
```
至此,最最最简化版的数据绑定就实现了.现在可以这样使用:

```javascript
function watch(vm, key, cb) {
  return new Subscriber(vm, key, cb)
}
let data = {
  message: 'Im a ruthless message'
}
defineReactive(data, 'message')
watch(data, 'message', (oVal, nVal) => {
  console.log(`message already be changed, oldValue:${oVal}, newValue:${nVal}`)
})
data.message = 'Im a happy message' 
// message already be changed, oldValue:Im a ruthless message, newValue:Im a happy message
```
看起来是不是有一些眼熟?是的,这就是最简陋的**Vue中的watch实现**.接下来,让我们想想``computed``是如何实现.

##### ``computed``

在上代码之前,先考虑一个问题``Vue``中的``computed``到底是什么?

``computed``在``Vue``中是基于一些基础数据(``data``或者其它``computed``)计算后返回一个新的值,可用来避免模版过于膨胀或逻辑复用.也就是说它**本身依赖一些值,返回一个可以被其它代码依赖的值**.

在上``computed``的代码之前,我们先修改一下**数据劫持**部分的代码.目前,``defineReactive``函数一次只能定义data中的一个属性,像这样:
```javascript
defineReactive(data, 'message')
```
下面让我们包装另外一个函数``observe``,使这个函数可以循环的``defineReactive``某个对象中的所有属性(*这里先不考虑数组和嵌套对象*).
```javascript
function observe(data) {
  Object.keys(data).forEach(key => {
    defineReactive(data, key)
  })
}
```
我们在这里输出一个叫``compute``的函数,用来输出计算属性.
```javascript
function compute(vm, name, getter) {
  let dep = new Dep()
  let computed = watch(vm, getter, () => {
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
```
可以看到``compute``函数把``computed``属性定义到vm上并收集了依赖于``computed``属性自身的``Subscriber``.``computed``值的变化并不是因为手动修改其的值,而是它依赖的值变化导致的.所以它本身也是一个``Subscriber``.这个地方和``Vue``的实现有一些出入,``Vue``的做法是**computed依赖的值变化时去更新依赖这个computed的代码**,没有监听``computed``本身这一说,此处为了简化代码所以采用这种方法.

与此同时,也有些代码需要做相应的修改:
```javascript
function Subscriber(vm, expOrFn, callback) {
  // 依赖的值所在的对象
  this.vm = vm
  // 依赖的值对应的表达式
  this.exp = expOrFn
  // 把表达式和函数做统一处理
  this.getter = typeof expOrFn === 'function' ? 
    exp : function(vm, exp) { return vm[exp] }
  // 值更新后的回调
  this.cb = callback
  // 初始化依赖关系
  this.value = this.get()
}
Subscriber.prototype = {
  get () {

    // 把当前Subscriber设置给Dep.target
    let value, vm = this.vm
    Dep.target = this

    value = this.getter.call(vm, vm, this.exp)
    // 删除当前Subscriber设置给Dep.target
    Dep.target = null
    return value
  }
  ...
}
```
现在就我们可以这么使用``computed``的了.
```javascript
compute(data, 'computedMessage', function getter() {
  return this.message + ',' + this.anotherMessage
})
```
当``message``或者``anotherMessage``变化时,``compute.computedMessage``也会相应的变化了.

##### 关于模版

之前说过,**``Vue``中实际上把每个``component``的模版编译成了一个各自的``_render``方法**.这个方法每次调用会返回一个``VNode``,也就是该组件的**虚拟DOM**.然后再根据这个**虚拟DOM**进行**diff算法**等逻辑,最终达到选择性的更新真正的``DOM``.

所以,在``Vue``里把包装后的``vm._render``方法作为``Subscriber``的``getter``就可以动态的更新``VNode``了.像这样:
```javascript
function updateComponet() {
    updateRelDOM(_someRender())
}
new Subscriber(vm, updateComponent);
```
``someRender``依赖了一些被``defineReactive``值,这些值变化时会让这个``Subscriber``去调用``updateComponent``,从而达到更新组件的目的.也就是说,``Vue``中的DOM更新也是一个特殊的``Subscriber``.(*``Vue``中的虚拟DOM和``diff``算法是挺大的一块儿,这篇先按下不表,之后或许会单开一篇讲讲我自己的思路*)

这里还要顺便说一句:**一个``component``只有一个``_render``方法,而``_render``方法也只存在于``component``中**.所以当这个``component``的模版依赖的值变化后,每次都会调用``_render``去生成一遍整个``component``模版的虚拟DOM.

有兴趣的朋友可以去看``Vue``源码中的``src/core/instance/lifecycle.js``文件.

#### 双向绑定?

细心的朋友应该有注意到``Vue``中的内置默认的双向绑定都离不开``v-model``这个``directive``.实际上呢,``Vue``内部是把``v-model``转化成了``:value="someData"``和``@change="someData = $event.target.value"``.像这样:
```html
<div id="app">
  <p>{{ message }}</p>
  <input v-model="message">
</div>
// 约等于
<div id="app">
  <p>{{ message }}</p>
  <input :value="message" @change="message = $event.target.value">
</div>
```
这样就实现了双向绑定了.

当然,根据``input``的``type``的不同,各自的逻辑处理也有一些区别,有兴趣的朋友可以自行查看``src/platforms/web/compiler/directives/model.js``.

#### 总结

到目前为止,我对数据绑定的相关思路就分享的差不多了.

有些朋友或许会说这里都是一块块的零碎,为什么会说已经结束了.因为我相信以大家的聪明才智,应该可以自己把这些组合起来,写出属于自己的数据绑定模块.毕竟自己实现一遍或者自己理清一下思路才能真正的掌握(~~绝不是因为我懒~~).


### 扩展

从本节开始,我将谈谈一些我对``Vue``数据绑定这块儿中感到好奇的地方.如果对这里某小部分不感兴趣,可尽情跳过.

##### Vue.set/this.$set

应该来说大部分用过``Vue``的朋友都接触过``Vue.set``.这个方法是用来在组件初始化后,**动态**的往``data``上**添加响应式的属性**.因为直接添加的话,这个添加上去的值并不是响应式的.

细心的朋友应该发现了原因: 在初始化``data``的时候,我们``observe``了``data``中的每一个属性,但是**初始化后,即``observe``函数调用结束后,添加上去的属性却并没有被defineReactive过**.所以导致后添加的属性不是响应式的.
那么``Vue.set``代码逻辑就很清晰了,即这个方法的时候就是把这个新的值``defineReactive``一下.
```javascript
function set (target, key, val) {
  ...
  // 如果属性key已经存在于target上就赋值并直接返回
  if (key in target && !(key in Object.prototype)) {
    target[key] = val;
    return val
  }
  ...
  defineReactive(ob.value, key, val);
  ...
  return val
}
```
这段代码来自``Vue``源码,中间省略了一些逻辑,包括:通知依赖于target这个对象的代码更新等.

这段代码主要逻辑就是先判断``key``是否存在于``target``上,如果存在就直接返回,如果不存在就``defineReactive``.让这个新来的属性重新熟悉下``reactive``的这条道儿上的规矩.

##### 更新队列

从``computed``那一节的例子出发,试想这么一段代码:
```javascript
compute(data, 'computedMessage', function getter() {
  return this.message + ',' + this.anotherMessage
})
watch(data, 'computedMessage', function(oVal, nVal) {
  console.log(`oVal: ${oVal};   nVal: ${nVal}`)
})
data.message = 'Im a happy message'
data.anotherMessage = 'no, you\'re not'
```
这里``data.computedMessage``依赖了``data.message``和``data.computedMessage``.之后我们连续改变了``data.message``和``data.anotherMesssage``.大家应该可以想到结果,``watch``中的``console``会打印两遍,意味着``data.computedMessage``变化了两次.

这就造成了一个问题: **``data.computedMessage``多了一次没有必要的``update``**.而这个问题衍生出去是很严重的.比如我们某个组件的模版依赖了5个值,我们在某个方法里把5个值都修改了,那么这个组件就会调用``_render``五次,导致浪费很多的性能.

所以我们需要一个优化方案能让某个时间段之内需要更新的``Subscriber``一起执行,并保证该时间段内的相同``Subscriber``只重新``get``一次值.``Vue``中的做法是利用了一个更新队列.

首先,既然要保证同一个``Subscriber``在某个更新流中只获取一次值.那么势必需要加个``id``以作区分.
```javascript
  var uniqueId = 0
  function Subscriber(vm, exp, callback) {
    this.id = ++uniqueId
    ...
  }
```
这里保证每个``Subscriber``的id随着不断的创建是不断自增的.至于这么做的原因,后文会提到.大家可以先自己思考一番.

现在每个``Subscriber``有自己的id,那我们就需要在修改它更新时的代码,**把它本身加入更新队列**.像这样:
```javascript
  Subscriber.prototype = {
    ...
    update() {
      queueSub(this)
      // this.run()
    },
    ...
  }
```
这里可以看到我们把实例本身作为参数调用了``queueSub``.而``queueSub``这个方法长这样:
```javascript
  // 更新队列
  var queue = [],
  // queue中当前正在执行的sub对应的在queue中的下标
  index = 0,
  // 标志位,代表是否正有queue在执行.
  flushing = false,
  waitingForQueueExec = false,
  has = {}
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
```
这个方法主要逻辑很简单:
![image](02FB1663DC5B44648B00BA14289EE575)
我着重谈谈其中特定的两步:
##### 1.把当前sub根据创建顺序添加进入目前正在执行的队列

这一步指的是:
```javascript
    var i = queue.length - 1
    //index表示当前队列中正在执行的Subscriber的所对应的下标
    while(i > index && id > queue[i].id) {
      i--
    }
    // 把sub插入到当前位置
    queue.splice(i + 1, 0, sub)
```
这段代码的意思是:把传入到``queueSub``中的``Subscriber``插入到队列中未执行且所有``id``大于它的``Subscriber``之前.

试想这么一个例子: 队列当前正在执行某个``Subscriber``的回调里修改了一个值,从而导致依赖这个值的``computed``的值变化.接下来这个``computed``会进入更新队列.如果当前队列中有未执行的``Subscriber``,比如模版,依赖这个``computed``的值,我们当然是希望这些未执行的``Subscriber``能基于新的``computed``的值去更新.

**所以这个``computed``对应的``Subscriber``应该先于 <i>当前队列中未执行且有可能依赖它的``Subscriber``</i> 去执行,也就是在队列中插入到这些``Subscriber``的前面**.

那我们怎么去确定可能的依赖关系呢?这个地方就利用到了上文提到过的**每个``Subscriber``实例的自增id**.被依赖的值或者``computed``一定会比依赖它的值先创建,所以它们的``id``一定小于依赖它的``Subscriber``.

##### 2.等到当前执行栈结束后,执行当前队列

这一步指的是:
```javascript
setTimeout(flushQueue, 0)
```
这里用``setTimeout``的原因是为了等到当前执行栈结束再去遍历更新队列.因为``js``是单线程的语言,如果不这样做,在触发更新的同一时间立马就会去触发更新队列,直到更新队列清空完成又回到刚才更新值地方继续执行.这就和我们优化前并无二样了.

PS: ``Vue``源码中利用的是``Vue.nextTick``方法,这里为了避免非相关内容就采用了``setTimeout(fn,0)``(``setTimeout``也是``Vue.nextTick``内部实现之一).

最后贴一下``flushQueue``的代码:
```javascript
  function flushQueue() {
    flushing = true
    
    queue.sort(function(a, b) { return a.id > b.id })
    for(; index < queue.length; index++) {
      var sub = queue[index]
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
```
### 写在最后

到目前为止,这篇文章就算结束了.写本文的目的主要在二:一是借鉴自费曼学习法,内化自己阅读源码形成的思路.二是做抛砖引玉,希望在惠及自己时也能稍微引起大家的思考.即使这思考是对这篇的批评,那也算是皆大欢喜,不负此工.

这是第一次正经在网络发文,所以本文中肯定有我未注意到的不严谨和错误的地方,还请海涵.如愿斧正,不胜感激.

